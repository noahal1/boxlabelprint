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

const PRINTER_HELP = `如何获取打印机名称？
1. 打开 Windows 设置 → 蓝牙和其他设备 → 打印机和扫描仪
2. 找到你的不干胶打印机
3. 复制打印机名称粘贴到上方`;

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
          <Button size="small" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => handleMoveField(i, 'up')} />
          <Button size="small" icon={<ArrowDownOutlined />} disabled={i === fieldDefs.length - 1} onClick={() => handleMoveField(i, 'down')} />
          <Button size="small" onClick={() => handleEditField(fieldDefs[i])}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDeleteField(fieldDefs[i].key)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}><SettingOutlined /> 系统设置</Title>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card
            title="基本配置"
            tabList={[
              { key: 'printer', tab: '打印机' },
              { key: 'label', tab: '标签模板' },
              { key: 'logo', tab: '公司Logo' },
              { key: 'fields', tab: '字段配置' },
            ]}
            activeTabKey={activeTab}
            onTabChange={(key) => setActiveTab(key)}
          >
            {/* 打印机设置 */}
            {activeTab === 'printer' && (
              <Form form={form} layout="vertical" onFinish={handleSave} initialValues={defaultSettings}>
                <Alert message="打印说明" description={PRINTER_HELP} type="info" showIcon style={{ marginBottom: 24 }} />
                <Form.Item name="printer_name" label="打印机名称" tooltip="请填写 Windows 中显示的打印机名称">
                  <Input placeholder="例：Zebra ZD421" prefix={<PrinterOutlined />} size="large" />
                </Form.Item>
                <Space align="start" size={16}>
                  <Form.Item name="label_width" label="标签宽度 (mm)" rules={[{ required: true }]}>
                    <InputNumber min={20} max={300} addonAfter="mm" />
                  </Form.Item>
                  <Form.Item name="label_height" label="标签高度 (mm)" rules={[{ required: true }]}>
                    <InputNumber min={10} max={300} addonAfter="mm" />
                  </Form.Item>
                </Space>
                <Divider />
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} size="large">保存设置</Button>
              </Form>
            )}

            {/* 标签模板 */}
            {activeTab === 'label' && (
              <Form form={form} layout="vertical" onFinish={handleSave} initialValues={defaultSettings}>
                <div style={{ marginBottom: 24 }}>
                  <Text strong>选择默认标签模板</Text>
                  <Paragraph type="secondary" style={{ marginTop: 4 }}>新建箱牌时将默认使用此模板</Paragraph>
                  <Form.Item name="label_template" noStyle>
                    <Segmented
                      value={form.getFieldValue('label_template') || 'standard'}
                      onChange={(val) => form.setFieldsValue({ label_template: val })}
                      options={templates.map((t) => ({
                        value: t.id,
                        label: <div style={{ padding: '4px 8px', textAlign: 'left', minWidth: 100 }}>
                          <div style={{ fontWeight: 'bold', fontSize: 13 }}>{t.name}</div>
                          <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{t.description}</div>
                        </div>,
                      }))}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {templates.map((t) => (
                    <div key={t.id}
                      style={{ width: 120, padding: 8, background: t.thumbnail.color, border: `2px solid ${form.getFieldValue('label_template') === t.id ? '#1677ff' : '#e8e8e8'}`, borderRadius: 6, textAlign: 'center', cursor: 'pointer' }}
                      onClick={() => form.setFieldsValue({ label_template: t.id })}>
                      <div style={{ height: 80, background: '#fff', border: '1px solid #d9d9d9', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#999', marginBottom: 4 }}>{t.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 'bold' }}>{t.name}</div>
                      <div style={{ fontSize: 9, color: '#999' }}>{t.defaultSize.width}×{t.defaultSize.height}mm</div>
                    </div>
                  ))}
                </div>
                <Form.Item name="company_name" label="公司名称" style={{ marginTop: 16 }}>
                  <Input placeholder="将显示在箱牌标签顶部" maxLength={50} />
                </Form.Item>
                <Divider />
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} size="large">保存设置</Button>
              </Form>
            )}

            {/* Logo */}
            {activeTab === 'logo' && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>公司 Logo 上传</Text>
                  <Paragraph type="secondary">支持 PNG/JPG，建议 200×200px，不超过 500KB</Paragraph>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 24, background: '#fafafa', borderRadius: 8, border: '1px dashed #d9d9d9' }}>
                  <div style={{ width: 80, height: 80, border: '1px solid #d9d9d9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#fff', flexShrink: 0 }}>
                    {logoPreview ? <img src={logoPreview} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <EyeOutlined style={{ fontSize: 28, color: '#ccc' }} />}
                  </div>
                  <div>
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif" onChange={handleLogoUpload} style={{ display: 'none' }} id="logo-input" />
                    <Space>
                      <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>选择图片</Button>
                      {logoPreview && <Button danger icon={<DeleteOutlined />} onClick={handleRemoveLogo}>移除</Button>}
                    </Space>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>{logoPreview ? '已上传，保存后生效' : '未上传 Logo'}</div>
                  </div>
                </div>
                <Divider />
                <Button type="primary" icon={<SaveOutlined />} onClick={() => {
                  if (window.electronAPI) {
                    window.electronAPI.setSetting('company_logo', logoPreview);
                    message.success('Logo 已保存');
                  }
                }} size="large">保存 Logo</Button>
              </div>
            )}

            {/* 字段配置（按箱型）*/}
            {activeTab === 'fields' && (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <Text strong>字段管理</Text>
                    <Segmented
                      value={fieldBoxType}
                      onChange={(val) => switchFieldType(val as BoxType)}
                      options={[
                        { value: 'inner', label: '内箱字段' },
                        { value: 'outer', label: '外箱字段' },
                      ]}
                    />
                    <Tag color={fieldBoxType === 'inner' ? 'blue' : 'purple'}>{BOX_TYPE_LABELS[fieldBoxType]}</Tag>
                  </Space>
                  <Space>
                    <Button icon={<PlusOutlined />} type="primary" onClick={handleAddField}>添加字段</Button>
                    <Popconfirm title={`恢复 ${BOX_TYPE_LABELS[fieldBoxType]} 默认字段？`} onConfirm={handleResetFields}>
                      <Button>恢复默认</Button>
                    </Popconfirm>
                  </Space>
                </div>

                <Paragraph type="secondary" style={{ margin: 0, marginBottom: 12 }}>
                  当前配置：{BOX_TYPE_LABELS[fieldBoxType]}，共 {fieldDefs.length} 个字段
                </Paragraph>

                <Table dataSource={fieldDefs} columns={fieldColumns} rowKey="key" pagination={false} size="small" />

                <Divider />

                <div style={{ padding: 12, background: '#fafafa', borderRadius: 6 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <InfoCircleOutlined style={{ marginRight: 4 }} />
                    内箱和外箱的字段配置相互独立。修改后新建页面自动更新。
                  </Text>
                </div>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="当前配置摘要">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="打印机">{settings.printer_name || <Text type="secondary">未配置</Text>}</Descriptions.Item>
              <Descriptions.Item label="标签尺寸">{settings.label_width || 100} mm × {settings.label_height || 75} mm</Descriptions.Item>
              <Descriptions.Item label="公司名称">{settings.company_name || '未设置'}</Descriptions.Item>
              <Descriptions.Item label="默认模板">{templates.find(t => t.id === settings.label_template)?.name || '标准模板'}</Descriptions.Item>
              <Descriptions.Item label="字段数量">{fieldDefs.length} 个</Descriptions.Item>
              <Descriptions.Item label="Logo">{settings.company_logo ? <img src={settings.company_logo} alt="logo" style={{ height: 24, maxWidth: 80, objectFit: 'contain' }} /> : <Text type="secondary">未上传</Text>}</Descriptions.Item>
            </Descriptions>
            <Divider />
            <Card title="系统信息" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="应用名称">箱牌打印管理系统</Descriptions.Item>
                <Descriptions.Item label="版本号">{packageJson.version}</Descriptions.Item>
                <Descriptions.Item label="运行环境">{window.electronAPI ? 'Electron' : '浏览器'}</Descriptions.Item>
                <Descriptions.Item label="数据库">SQLite (本地存储)</Descriptions.Item>
              </Descriptions>
            </Card>
          </Card>
        </Col>
      </Row>

      {/* 添加/编辑字段弹窗 */}
      <Modal
        title={editingField ? '编辑字段' : '添加字段'}
        open={fieldModalVisible}
        onOk={handleSaveField}
        onCancel={() => setFieldModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={fieldForm} layout="vertical" initialValues={{ type: 'text', required: false }}>
          <Form.Item name="label" label="字段显示名称" rules={[{ required: true, message: '请输入字段名称' }]}>
            <Input placeholder="例：供应商代码" maxLength={20} disabled={!!editingField} />
          </Form.Item>
          {!editingField && (
            <Alert message="字段键名将根据显示名称自动生成" type="info" showIcon style={{ marginBottom: 16 }} />
          )}
          <Form.Item name="type" label="字段类型">
            <Select options={[{ value: 'text', label: '文本' }, { value: 'number', label: '数字' }]} />
          </Form.Item>
          <Form.Item name="required" label="是否必填" valuePropName="checked">
            <Switch checkedChildren="必填" unCheckedChildren="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
