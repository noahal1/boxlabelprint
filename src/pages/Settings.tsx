import { useState, useEffect, useRef } from 'react';
import {
  Card, Form, Input, InputNumber, Button, message, Space, Typography, Divider,
  Descriptions, Alert, Spin, Row, Col, Segmented, Table, Switch, Select, Modal, Popconfirm, Tag,
} from 'antd';
import {
  PrinterOutlined, SaveOutlined, InfoCircleOutlined, SettingOutlined,
  UploadOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import packageJson from '../../package.json';
import { templates } from '../templates';
import { loadFieldDefinitions, getDefaultFieldDefinitions, getSortedFields } from '../utils/fieldConfig';
import type { FieldDefinition, BoxType } from '../types';
import { BOX_TYPE_LABELS } from '../types';

const { Title, Text, Paragraph } = Typography;

const PRINTER_HELP = `如何获取打印机名称？\n1. 打开 Windows 设置 → 蓝牙和其他设备 → 打印机和扫描仪\n2. 找到你的不干胶打印机\n3. 复制打印机名称粘贴到上方`;

type SettingsData = {
  printer_name: string;
  label_width: number;
  label_height: number;
  company_name: string;
  company_logo: string;
  label_template: string;
};

const defaultSettings: SettingsData = {
  printer_name: '',
  label_width: 100,
  label_height: 75,
  company_name: '我的公司',
  company_logo: '',
  label_template: 'standard',
};

export default function Settings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('printer');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 字段配置（按箱型）
  const [fieldBoxType, setFieldBoxType] = useState<BoxType>('inner');
  const [fieldDefs, setFieldDefs] = useState<FieldDefinition[]>([]);
  const [fieldModalVisible, setFieldModalVisible] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const [fieldForm] = Form.useForm();

  const loadSettings = async () => {
    try {
      setLoading(true);
      if (!window.electronAPI) return;
      const allSettings = await window.electronAPI.getAllSettings();
      const merged = { ...defaultSettings, ...allSettings };
      setSettings(merged);
      setLogoPreview(merged.company_logo || '');
      form.setFieldsValue({
        printer_name: merged.printer_name,
        label_width: Number(merged.label_width),
        label_height: Number(merged.label_height),
        company_name: merged.company_name,
        label_template: merged.label_template,
      });
    } catch (err) {
      console.error('加载设置失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFieldDefs = async (type?: BoxType) => {
    const t = type || fieldBoxType;
    const defs = await loadFieldDefinitions(t);
    setFieldDefs(getSortedFields(defs));
  };

  useEffect(() => {
    loadSettings();
    loadFieldDefs();
  }, []);

  const handleSave = async (values: any) => {
    try {
      setSaving(true);
      if (!window.electronAPI) return;
      const saveData: Record<string, string> = {
        printer_name: values.printer_name || '',
        label_width: String(values.label_width || 100),
        label_height: String(values.label_height || 75),
        company_name: values.company_name || '',
        company_logo: logoPreview,
        label_template: values.label_template || 'standard',
      };
      for (const [key, value] of Object.entries(saveData)) {
        await window.electronAPI.setSetting(key, value);
      }
      setSettings(saveData as unknown as SettingsData);
      message.success('设置保存成功');
    } catch { message.error('保存设置失败'); }
    finally { setSaving(false); }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { message.error('请上传图片文件'); return; }
    if (file.size > 500 * 1024) { message.error('Logo 图片大小不能超过 500KB'); return; }
    const reader = new FileReader();
    reader.onload = (event) => { setLogoPreview(event.target?.result as string); message.success('Logo 已上传'); };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => { setLogoPreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; };

  // ===== 字段管理（按箱型）=====
  const switchFieldType = (type: BoxType) => {
    setFieldBoxType(type);
    loadFieldDefs(type);
  };

  const handleAddField = () => {
    setEditingField(null);
    fieldForm.resetFields();
    setFieldModalVisible(true);
  };

  const handleEditField = (field: FieldDefinition) => {
    setEditingField(field);
    fieldForm.setFieldsValue(field);
    setFieldModalVisible(true);
  };

  const handleSaveField = async () => {
    try {
      const values = await fieldForm.validateFields();
      let newDefs: FieldDefinition[];
      if (editingField) {
        newDefs = fieldDefs.map((f) => f.key === editingField.key ? { ...f, ...values, key: editingField.key } : f);
      } else {
        const key = values.label.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_');
        newDefs = [...fieldDefs, { ...values, key, sort_order: fieldDefs.length + 1 }];
      }
      newDefs = newDefs.map((f, i) => ({ ...f, sort_order: i + 1 }));
      setFieldDefs(newDefs);
      if (window.electronAPI) await window.electronAPI.setFieldDefinitions(fieldBoxType, newDefs);
      setFieldModalVisible(false);
      message.success(editingField ? '字段已更新' : '字段已添加');
    } catch {}
  };

  const handleDeleteField = async (key: string) => {
    const newDefs = fieldDefs.filter((f) => f.key !== key).map((f, i) => ({ ...f, sort_order: i + 1 }));
    setFieldDefs(newDefs);
    if (window.electronAPI) await window.electronAPI.setFieldDefinitions(fieldBoxType, newDefs);
    message.success('字段已删除');
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fieldDefs.length) return;
    const newDefs = [...fieldDefs];
    [newDefs[index], newDefs[newIndex]] = [newDefs[newIndex], newDefs[index]];
    const reindexed = newDefs.map((f, i) => ({ ...f, sort_order: i + 1 }));
    setFieldDefs(reindexed);
    if (window.electronAPI) window.electronAPI.setFieldDefinitions(fieldBoxType, reindexed);
  };

  const handleResetFields = async () => {
    const defaults = getDefaultFieldDefinitions(fieldBoxType);
    setFieldDefs(defaults);
    if (window.electronAPI) await window.electronAPI.setFieldDefinitions(fieldBoxType, defaults);
    message.success(`已恢复 ${BOX_TYPE_LABELS[fieldBoxType]} 默认字段`);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" tip="加载设置..." fullscreen /></div>;
  }

  const fieldColumns = [
    { title: '序号', key: 'sort_order', width: 50, render: (_: any, __: any, i: number) => i + 1 },
    { title: '字段标签', dataIndex: 'label', key: 'label' },
    { title: '字段键名', dataIndex: 'key', key: 'key' },
    { title: '类型', dataIndex: 'type', key: 'type', width: 80, render: (v: string) => v === 'number' ? '数字' : '文本' },
    { title: '必填', dataIndex: 'required', key: 'required', width: 60, render: (v: boolean) => v ? '是' : '否' },
    {
      title: '操作', key: 'action', width: 160,
      render: (_: any, __: any, i: number) => (
        <Space size="small">
          <Button size="small" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => handleMoveField(i, 'up')} style={{ borderRadius: 6 }} />
          <Button size="small" icon={<ArrowDownOutlined />} disabled={i === fieldDefs.length - 1} onClick={() => handleMoveField(i, 'down')} style={{ borderRadius: 6 }} />
          <Button size="small" onClick={() => handleEditField(fieldDefs[i])} style={{ borderRadius: 6 }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDeleteField(fieldDefs[i].key)}>
            <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 20 }}>
        <Space>
          <div style={{ width: 4, height: 22, background: '#1677ff', borderRadius: 2 }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1f1f1f' }}>系统设置</span>
        </Space>
        <Text type="secondary" style={{ marginLeft: 10, fontSize: 13 }}>打印机 / 标签模板 / Logo / 字段配置</Text>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={15}>
          <Card
            style={{ borderRadius: 14, border: '1px solid #f0f0f0' }}
            bodyStyle={{ padding: '20px 24px' }}
            tabList={[
              { key: 'printer', tab: '🖨️ 打印机' },
              { key: 'label', tab: '📋 标签模板' },
              { key: 'logo', tab: '🖼️ 公司Logo' },
              { key: 'fields', tab: '⚙️ 字段配置' },
            ]}
            activeTabKey={activeTab}
            onTabChange={(key) => setActiveTab(key)}
          >
            {/* 打印机设置 */}
            {activeTab === 'printer' && (
              <Form form={form} layout="vertical" onFinish={handleSave} initialValues={defaultSettings}>
                <Alert message="打印说明" description={PRINTER_HELP} type="info" showIcon
                  style={{ marginBottom: 24, borderRadius: 10 }} />
                <Form.Item name="printer_name" label="打印机名称" tooltip="请填写 Windows 中显示的打印机名称">
                  <Input placeholder="例：Zebra ZD421" prefix={<PrinterOutlined />}
                    size="large" style={{ borderRadius: 8 }} />
                </Form.Item>
                <Space align="start" size={16}>
                  <Form.Item name="label_width" label="标签宽度 (mm)" rules={[{ required: true }]}>
                    <InputNumber min={20} max={300} addonAfter="mm" style={{ borderRadius: 8 }} />
                  </Form.Item>
                  <Form.Item name="label_height" label="标签高度 (mm)" rules={[{ required: true }]}>
                    <InputNumber min={10} max={300} addonAfter="mm" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Space>
                <Divider style={{ borderColor: '#f0f0f0' }} />
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} size="large"
                  style={{ height: 42, borderRadius: 10, padding: '0 28px', fontWeight: 600, boxShadow: '0 4px 12px rgba(22,119,255,0.3)' }}>
                  保存设置
                </Button>
              </Form>
            )}

            {/* 标签模板 */}
            {activeTab === 'label' && (
              <Form form={form} layout="vertical" onFinish={handleSave} initialValues={defaultSettings}>
                <div style={{ marginBottom: 20 }}>
                  <Text strong style={{ fontSize: 14 }}>选择默认标签模板</Text>
                  <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 12, fontSize: 13 }}>新建箱牌时将默认使用此模板</Paragraph>

                  <Row gutter={[12, 12]}>
                    {templates.map((t) => {
                      const selected = form.getFieldValue('label_template') === t.id;
                      return (
                        <Col span={8} key={t.id}>
                          <div
                            onClick={() => form.setFieldsValue({ label_template: t.id })}
                            className="hover-card"
                            style={{
                              padding: 12,
                              background: selected ? '#e6f4ff' : '#fafafa',
                              border: `2px solid ${selected ? '#1677ff' : '#f0f0f0'}`,
                              borderRadius: 12,
                              textAlign: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <div style={{
                              height: 60,
                              background: '#fff',
                              border: '1px solid #e8e8e8',
                              borderRadius: 8,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 10,
                              color: '#999',
                              marginBottom: 8,
                            }}>
                              <div style={{
                                width: 40, height: 28,
                                border: '1px solid #d9d9d9',
                                borderRadius: 2,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                position: 'relative',
                              }}>
                                <div style={{ width: '100%', height: '100%', background: t.thumbnail.color, borderRadius: 1, opacity: 0.3 }} />
                                <span style={{ position: 'absolute', fontSize: 7, color: '#666' }}>{t.name}</span>
                              </div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: selected ? '#1677ff' : '#333' }}>{t.name}</div>
                            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{t.defaultSize.width}×{t.defaultSize.height}mm</div>
                          </div>
                        </Col>
                      );
                    })}
                  </Row>
                </div>

                <Form.Item name="company_name" label="公司名称" style={{ marginTop: 8 }}>
                  <Input placeholder="将显示在箱牌标签顶部" maxLength={50} style={{ borderRadius: 8 }} />
                </Form.Item>
                <Divider style={{ borderColor: '#f0f0f0' }} />
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} size="large"
                  style={{ height: 42, borderRadius: 10, padding: '0 28px', fontWeight: 600, boxShadow: '0 4px 12px rgba(22,119,255,0.3)' }}>
                  保存设置
                </Button>
              </Form>
            )}

            {/* Logo */}
            {activeTab === 'logo' && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ fontSize: 14 }}>公司 Logo 上传</Text>
                  <Paragraph type="secondary" style={{ marginTop: 4, fontSize: 13 }}>支持 PNG/JPG，建议 200×200px，不超过 500KB</Paragraph>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 24,
                  padding: 24, background: '#fafafa', borderRadius: 12,
                  border: '1px dashed #d9d9d9',
                }}>
                  <div style={{
                    width: 80, height: 80,
                    border: '1px solid #e8e8e8', borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', background: '#fff', flexShrink: 0,
                  }}>
                    {logoPreview
                      ? <img src={logoPreview} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <EyeOutlined style={{ fontSize: 28, color: '#ccc' }} />}
                  </div>
                  <div>
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif"
                      onChange={handleLogoUpload} style={{ display: 'none' }} id="logo-input" />
                    <Space>
                      <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}
                        style={{ borderRadius: 8, height: 36 }}>选择图片</Button>
                      {logoPreview && <Button danger icon={<DeleteOutlined />} onClick={handleRemoveLogo}
                        style={{ borderRadius: 8 }}>移除</Button>}
                    </Space>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>{logoPreview ? '已上传，保存后生效' : '未上传 Logo'}</div>
                  </div>
                </div>
                <Divider style={{ borderColor: '#f0f0f0' }} />
                <Button type="primary" icon={<SaveOutlined />} onClick={() => {
                  if (window.electronAPI) {
                    window.electronAPI.setSetting('company_logo', logoPreview);
                    message.success('Logo 已保存');
                  }
                }} size="large" style={{ height: 42, borderRadius: 10, padding: '0 28px', fontWeight: 600 }}>保存 Logo</Button>
              </div>
            )}

            {/* 字段配置 */}
            {activeTab === 'fields' && (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <Space>
                    <Text strong style={{ fontSize: 14 }}>字段管理</Text>
                    <Segmented
                      value={fieldBoxType}
                      onChange={(val) => switchFieldType(val as BoxType)}
                      options={[
                        { value: 'inner', label: '内箱字段' },
                        { value: 'outer', label: '外箱字段' },
                      ]}
                    />
                    <Tag color={fieldBoxType === 'inner' ? 'blue' : 'purple'} style={{ borderRadius: 4 }}>{BOX_TYPE_LABELS[fieldBoxType]}</Tag>
                  </Space>
                  <Space>
                    <Button icon={<PlusOutlined />} type="primary" onClick={handleAddField}
                      style={{ borderRadius: 8, height: 34 }}>添加字段</Button>
                    <Popconfirm title={`恢复 ${BOX_TYPE_LABELS[fieldBoxType]} 默认字段？`} onConfirm={handleResetFields}>
                      <Button style={{ borderRadius: 8, height: 34 }}>恢复默认</Button>
                    </Popconfirm>
                  </Space>
                </div>

                <Paragraph type="secondary" style={{ margin: 0, marginBottom: 12 }}>
                  当前配置：{BOX_TYPE_LABELS[fieldBoxType]}，共 {fieldDefs.length} 个字段
                </Paragraph>

                <Table dataSource={fieldDefs} columns={fieldColumns} rowKey="key" pagination={false} size="small"
                  components={{
                    header: {
                      cell: (props: any) => (
                        <th {...props} style={{ ...props?.style, background: '#fafafa', color: '#666', fontWeight: 600, fontSize: 12 }} />
                      ),
                    },
                  }} />

                <div style={{ padding: 12, background: '#fafafa', borderRadius: 8, marginTop: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <InfoCircleOutlined style={{ marginRight: 4 }} />
                    内箱和外箱的字段配置相互独立。修改后新建页面自动更新。
                  </Text>
                </div>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card
            title={<Space><SettingOutlined /><span style={{ fontSize: 14 }}>当前配置摘要</span></Space>}
            style={{ borderRadius: 14, border: '1px solid #f0f0f0', marginBottom: 16 }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <Descriptions column={1} size="small" colon={false}>
              <Descriptions.Item label={<span style={{ color: '#666' }}>🖨️ 打印机</span>}>
                {settings.printer_name || <Text type="secondary">未配置</Text>}
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#666' }}>📐 标签尺寸</span>}>
                {settings.label_width || 100} mm × {settings.label_height || 75} mm
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#666' }}>🏢 公司名称</span>}>
                {settings.company_name || <Text type="secondary">未设置</Text>}
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#666' }}>📄 默认模板</span>}>
                {templates.find(t => t.id === settings.label_template)?.name || '标准模板'}
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#666' }}>⚙️ 字段数量</span>}>
                {fieldDefs.length} 个
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#666' }}>🖼️ Logo</span>}>
                {settings.company_logo
                  ? <img src={settings.company_logo} alt="logo" style={{ height: 24, maxWidth: 80, objectFit: 'contain' }} />
                  : <Text type="secondary">未上传</Text>}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title={<Space><InfoCircleOutlined /><span style={{ fontSize: 14 }}>系统信息</span></Space>}
            style={{ borderRadius: 14, border: '1px solid #f0f0f0' }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <Descriptions column={1} size="small" colon={false}>
              <Descriptions.Item label={<span style={{ color: '#666' }}>应用名称</span>}>箱牌打印管理系统</Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#666' }}>版本号</span>}>
                <Tag color="blue" style={{ borderRadius: 4 }}>v{packageJson.version}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#666' }}>运行环境</span>}>
                {window.electronAPI ? 'Electron' : '🌐 浏览器'}
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#666' }}>数据库</span>}>SQLite (本地存储)</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      {/* 添加/编辑字段弹窗 */}
      <Modal
        title={
          <Space>
            <SettingOutlined />
            <span>{editingField ? '编辑字段' : '添加字段'}</span>
          </Space>
        }
        open={fieldModalVisible}
        onOk={handleSaveField}
        onCancel={() => setFieldModalVisible(false)}
        okText="保存"
        cancelText="取消"
        style={{ borderRadius: 12 }}
        destroyOnClose
      >
        <Form form={fieldForm} layout="vertical" initialValues={{ type: 'text', required: false }}>
          <Form.Item name="label" label="字段显示名称" rules={[{ required: true, message: '请输入字段名称' }]}>
            <Input placeholder="例：供应商代码" maxLength={20} disabled={!!editingField} style={{ borderRadius: 8 }} />
          </Form.Item>
          {!editingField && (
            <Alert message="字段键名将根据显示名称自动生成" type="info" showIcon style={{ marginBottom: 16, borderRadius: 8 }} />
          )}
          <Form.Item name="type" label="字段类型">
            <Select options={[{ value: 'text', label: '文本' }, { value: 'number', label: '数字' }]}
              style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="required" label="是否必填" valuePropName="checked">
            <Switch checkedChildren="必填" unCheckedChildren="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
