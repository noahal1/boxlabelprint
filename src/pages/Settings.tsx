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
import { loadFieldDefinitions, getDefaultFieldDefinitions, getSortedFields } from '../utils/fieldConfig';
import type { FieldDefinition, BoxType } from '../types';
import { BOX_TYPE_LABELS } from '../types';

const { Title, Text, Paragraph } = Typography;

const PRINTER_HELP = `如何获取打印机 IP 地址？\n1. 在打印机面板上打印一张"网络配置页"（Network Config / Self Test）\n2. 查找 "IP Address" 字段，通常格式如 192.168.1.xxx\n3. 将该 IP 地址填入上方，端口保持默认 9100 即可`;

type SettingsData = {
  printer_name: string;
  printer_ip: string;
  printer_port: string;
  label_width: number;
  label_height: number;
  company_name: string;
  company_logo: string;
  label_template: string;
  department_name: string;
};

const defaultSettings: SettingsData = {
  printer_name: '',
  printer_ip: '',
  printer_port: '9100',
  label_width: 100,
  label_height: 75,
  company_name: '我的公司',
  company_logo: '',
  label_template: 'factory',
  department_name: '铝箔事业一部',
};

export default function Settings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('printer');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        printer_ip: merged.printer_ip,
        printer_port: merged.printer_port || '9100',
        label_width: Number(merged.label_width),
        label_height: Number(merged.label_height),
        company_name: merged.company_name,
        label_template: merged.label_template,
        department_name: merged.department_name,
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
        printer_ip: values.printer_ip || '',
        printer_port: values.printer_port || '9100',
        label_width: String(values.label_width || 100),
        label_height: String(values.label_height || 75),
        company_name: values.company_name || '',
        company_logo: logoPreview,
        label_template: values.label_template || 'factory',
        department_name: values.department_name || '',
      };
      for (const [key, value] of Object.entries(saveData)) {
        await window.electronAPI.setSetting(key, value);
      }
      setSettings(saveData as unknown as SettingsData);
      message.success('设置保存成功');
    } catch {
      message.error('保存设置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      message.error('请上传图片文件');
      return;
    }
    if (file.size > 500 * 1024) {
      message.error('Logo 图片大小不能超过 500KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoPreview(event.target?.result as string);
      message.success('Logo 已上传');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
        newDefs = fieldDefs.map((f) =>
          f.key === editingField.key ? { ...f, ...values, key: editingField.key } : f
        );
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
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  const fieldColumns = [
    { title: '序号', key: 'sort_order', width: 50, render: (_: any, __: any, i: number) => i + 1 },
    { title: '字段标签', dataIndex: 'label', key: 'label' },
    { title: '字段键名', dataIndex: 'key', key: 'key' },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 80,
      render: (v: string) => (v === 'number' ? '数字' : '文本'),
    },
    {
      title: '必填', dataIndex: 'required', key: 'required', width: 60,
      render: (v: boolean) => (v ? '是' : '否'),
    },
    {
      title: '操作', key: 'action', width: 160,
      render: (_: any, __: any, i: number) => (
        <Space size="small">
          <Button size="small" icon={<ArrowUpOutlined />} disabled={i === 0}
            onClick={() => handleMoveField(i, 'up')} style={{ borderRadius: 6 }} />
          <Button size="small" icon={<ArrowDownOutlined />} disabled={i === fieldDefs.length - 1}
            onClick={() => handleMoveField(i, 'down')} style={{ borderRadius: 6 }} />
          <Button size="small" onClick={() => handleEditField(fieldDefs[i])}
            style={{ borderRadius: 6 }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDeleteField(fieldDefs[i].key)}>
            <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* ---- Fluent 2 页面标题 ---- */}
      <div style={{ marginBottom: 20 }}>
        <div className="fluent-section-title" style={{ fontSize: 18 }}>
          系统设置
          <span style={{ fontSize: 13, fontWeight: 400, color: '#8a8886', marginLeft: 4 }}>
            打印机 / 标签模板 / Logo / 字段配置
          </span>
        </div>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={15}>
          {/* ---- Fluent 2 设置主卡片 (Acrylic) ---- */}
          <div
            className="fluent-card"
            style={{ padding: 0, overflow: 'hidden' }}
          >
            {/* Fluent 2 Tabs */}
            <Card
              style={{ background: 'transparent', border: 'none' }}
              styles={{ body: { padding: '20px 24px' } }}
              tabList={[
                { key: 'printer', tab: '打印机' },
                { key: 'logo', tab: '公司Logo' },
                { key: 'fields', tab: '字段配置' },
              ]}
              activeTabKey={activeTab}
              onTabChange={(key) => setActiveTab(key)}
            >
              {/* 打印机设置 */}
              {activeTab === 'printer' && (
                <Form form={form} layout="vertical" onFinish={handleSave} initialValues={defaultSettings}>
                  <Alert
                    message="打印说明"
                    description={PRINTER_HELP}
                    type="info"
                    showIcon
                    style={{ marginBottom: 24, borderRadius: 8, border: '1px solid #deecf9' }}
                  />
                  <Form.Item
                    name="printer_ip"
                    label="打印机 IP 地址"
                    required
                    rules={[
                      { required: true, message: '请输入打印机 IP 地址' },
                      {
                        pattern: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
                        message: 'IP 地址格式不正确，例：192.168.1.100',
                      },
                    ]}
                  >
                    <Input
                      placeholder="例：192.168.1.100"
                      size="large"
                      style={{ borderRadius: 6, fontFamily: 'monospace' }}
                    />
                  </Form.Item>
                  <Form.Item name="printer_port" label="端口号" tooltip="标签打印机默认端口为 9100">
                    <Input
                      placeholder="9100"
                      size="large"
                      style={{ borderRadius: 6, width: 160, fontFamily: 'monospace' }}
                    />
                  </Form.Item>
                  <Form.Item name="printer_name" label="打印机名称（仅用于显示）">
                    <Input
                      placeholder="例：一楼仓库标签打印机"
                      prefix={<PrinterOutlined />}
                      size="large"
                      style={{ borderRadius: 6 }}
                    />
                  </Form.Item>
                  <Space align="start" size={16}>
                    <Form.Item name="label_width" label="标签宽度 (mm)" rules={[{ required: true }]}>
                      <InputNumber min={20} max={300} addonAfter="mm" style={{ borderRadius: 6 }} />
                    </Form.Item>
                    <Form.Item name="label_height" label="标签高度 (mm)" rules={[{ required: true }]}>
                      <InputNumber min={10} max={300} addonAfter="mm" style={{ borderRadius: 6 }} />
                    </Form.Item>
                  </Space>
                  <Divider style={{ borderColor: '#edebe9' }} />

                  <Text strong style={{ fontSize: 14, color: '#1a1a1f' }}>公司信息</Text>
                  <Paragraph style={{ color: '#605e5c', marginTop: 4, marginBottom: 12, fontSize: 13 }}>
                    这些信息将显示在标签顶部
                  </Paragraph>
                  <Form.Item name="company_name" label="公司名称">
                    <Input placeholder="将显示在箱牌标签顶部" maxLength={50} style={{ borderRadius: 6 }} />
                  </Form.Item>
                  <Form.Item name="department_name" label="部门名称">
                    <Input placeholder="例：铝箔事业一部" maxLength={50} style={{ borderRadius: 6 }} />
                  </Form.Item>

                  <Divider style={{ borderColor: '#edebe9' }} />
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={saving}
                    size="large"
                    style={{ height: 40, borderRadius: 8, padding: '0 26px', fontWeight: 600 }}
                  >
                    保存设置
                  </Button>
                </Form>
              )}

              {/* Logo */}
              {activeTab === 'logo' && (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ fontSize: 14, color: '#1a1a1f' }}>公司 Logo 上传</Text>
                    <Paragraph style={{ color: '#605e5c', marginTop: 4, fontSize: 13 }}>
                      支持 PNG/JPG，建议 200×200px，不超过 500KB
                    </Paragraph>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 24,
                      padding: 24,
                      background: 'rgba(255,255,255,0.72)',
                      borderRadius: 12,
                      border: '1px dashed #c8c6c4',
                    }}
                  >
                    <div
                      style={{
                        width: 80,
                        height: 80,
                        border: '1px solid #edebe9',
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        background: '#fff',
                        flexShrink: 0,
                      }}
                    >
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="logo"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <EyeOutlined style={{ fontSize: 28, color: '#c8c6c4' }} />
                      )}
                    </div>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif"
                        onChange={handleLogoUpload}
                        style={{ display: 'none' }}
                        id="logo-input"
                      />
                      <Space>
                        <Button
                          icon={<UploadOutlined />}
                          onClick={() => fileInputRef.current?.click()}
                          style={{ borderRadius: 6, height: 34 }}
                        >
                          选择图片
                        </Button>
                        {logoPreview && (
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            onClick={handleRemoveLogo}
                            style={{ borderRadius: 6 }}
                          >
                            移除
                          </Button>
                        )}
                      </Space>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#8a8886' }}>
                        {logoPreview ? '已上传，保存后生效' : '未上传 Logo'}
                      </div>
                    </div>
                  </div>
                  <Divider style={{ borderColor: '#edebe9' }} />
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={() => {
                      if (window.electronAPI) {
                        window.electronAPI.setSetting('company_logo', logoPreview);
                        message.success('Logo 已保存');
                      }
                    }}
                    size="large"
                    style={{ height: 40, borderRadius: 8, padding: '0 26px', fontWeight: 600 }}
                  >
                    保存 Logo
                  </Button>
                </div>
              )}

              {/* 字段配置 */}
              {activeTab === 'fields' && (
                <div>
                  <div
                    style={{
                      marginBottom: 16,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <Space>
                      <Text strong style={{ fontSize: 14, color: '#1a1a1f' }}>字段管理</Text>
                      <Segmented
                        value={fieldBoxType}
                        onChange={(val) => switchFieldType(val as BoxType)}
                        options={[
                          { value: 'inner', label: '内箱字段' },
                          { value: 'outer', label: '外箱字段' },
                        ]}
                      />
                      <Tag
                        color={fieldBoxType === 'inner' ? 'blue' : 'purple'}
                        style={{ borderRadius: 4 }}
                      >
                        {BOX_TYPE_LABELS[fieldBoxType]}
                      </Tag>
                    </Space>
                    <Space>
                      <Button
                        icon={<PlusOutlined />}
                        type="primary"
                        onClick={handleAddField}
                        style={{ borderRadius: 6, height: 32 }}
                      >
                        添加字段
                      </Button>
                      <Popconfirm
                        title={`恢复 ${BOX_TYPE_LABELS[fieldBoxType]} 默认字段？`}
                        onConfirm={handleResetFields}
                      >
                        <Button style={{ borderRadius: 6, height: 32 }}>恢复默认</Button>
                      </Popconfirm>
                    </Space>
                  </div>

                  <Paragraph style={{ color: '#8a8886', margin: 0, marginBottom: 12, fontSize: 13 }}>
                    当前配置：{BOX_TYPE_LABELS[fieldBoxType]}，共 {fieldDefs.length} 个字段
                  </Paragraph>

                  <Table
                    dataSource={fieldDefs}
                    columns={fieldColumns}
                    rowKey="key"
                    pagination={false}
                    size="small"
                    components={{
                      header: {
                        cell: (props: any) => (
                          <th
                            {...props}
                            style={{
                              ...props?.style,
                              background: '#faf9f8',
                              color: '#605e5c',
                              fontWeight: 600,
                              fontSize: 12,
                            }}
                          />
                        ),
                      },
                    }}
                  />

                  <div
                    style={{
                      padding: 12,
                      background: '#faf9f8',
                      borderRadius: 8,
                      marginTop: 16,
                    }}
                  >
                    <Text style={{ color: '#8a8886', fontSize: 12 }}>
                      <InfoCircleOutlined style={{ marginRight: 4 }} />
                      内箱和外箱的字段配置相互独立。修改后新建页面自动更新。
                    </Text>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </Col>

        <Col xs={24} lg={9}>
          {/* ---- 当前配置摘要 ---- */}
          <div className="fluent-card" style={{ padding: '16px 20px', marginBottom: 16 }}>
            <div className="fluent-section-title" style={{ marginBottom: 14, fontSize: 14 }}>
              当前配置摘要
            </div>
            <Descriptions column={1} size="small" colon={false}>
              <Descriptions.Item label={<span style={{ color: '#605e5c' }}>打印机 IP</span>}>
                {settings.printer_ip ? (
                  <Text code style={{ fontSize: 12 }}>{settings.printer_ip}:{settings.printer_port || '9100'}</Text>
                ) : (
                  <Text style={{ color: '#8a8886' }}>未配置</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#605e5c' }}>打印机名称</span>}>
                {settings.printer_name || <Text style={{ color: '#8a8886' }}>-</Text>}
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#605e5c' }}>标签尺寸</span>}>
                {settings.label_width || 100} mm × {settings.label_height || 75} mm
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#605e5c' }}>公司名称</span>}>
                {settings.company_name || <Text style={{ color: '#8a8886' }}>未设置</Text>}
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#605e5c' }}>部门名称</span>}>
                {settings.department_name || <Text style={{ color: '#8a8886' }}>未设置</Text>}
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#605e5c' }}>标签模板</span>}>
                工厂模板
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#605e5c' }}>字段数量</span>}>
                {fieldDefs.length} 个
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#605e5c' }}>Logo</span>}>
                {settings.company_logo ? (
                  <img
                    src={settings.company_logo}
                    alt="logo"
                    style={{ height: 24, maxWidth: 80, objectFit: 'contain' }}
                  />
                ) : (
                  <Text style={{ color: '#8a8886' }}>未上传</Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          </div>

          {/* ---- 系统信息 ---- */}
          <div className="fluent-card" style={{ padding: '16px 20px' }}>
            <div className="fluent-section-title" style={{ marginBottom: 14, fontSize: 14 }}>
              系统信息
            </div>
            <Descriptions column={1} size="small" colon={false}>
              <Descriptions.Item label={<span style={{ color: '#605e5c' }}>应用名称</span>}>
                箱牌打印管理系统
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#605e5c' }}>版本号</span>}>
                <Tag color="blue" style={{ borderRadius: 4 }}>
                  v{packageJson.version}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#605e5c' }}>运行环境</span>}>
                {window.electronAPI ? 'Electron' : '浏览器'}
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#605e5c' }}>数据库</span>}>
                SQLite (本地存储)
              </Descriptions.Item>
            </Descriptions>
          </div>
        </Col>
      </Row>

      {/* 添加/编辑字段弹窗 */}
      <Modal
        title={<Space><SettingOutlined /><span>{editingField ? '编辑字段' : '添加字段'}</span></Space>}
        open={fieldModalVisible}
        onOk={handleSaveField}
        onCancel={() => setFieldModalVisible(false)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form
          form={fieldForm}
          layout="vertical"
          initialValues={{ type: 'text', required: false }}
        >
          <Form.Item
            name="label"
            label="字段显示名称"
            rules={[{ required: true, message: '请输入字段名称' }]}
          >
            <Input
              placeholder="例：供应商代码"
              maxLength={20}
              disabled={!!editingField}
              style={{ borderRadius: 6 }}
            />
          </Form.Item>
          {!editingField && (
            <Alert
              message="字段键名将根据显示名称自动生成"
              type="info"
              showIcon
              style={{ marginBottom: 16, borderRadius: 8 }}
            />
          )}
          <Form.Item name="type" label="字段类型">
            <Select
              options={[{ value: 'text', label: '文本' }, { value: 'number', label: '数字' }]}
              style={{ borderRadius: 6 }}
            />
          </Form.Item>
          <Form.Item name="required" label="是否必填" valuePropName="checked">
            <Switch checkedChildren="必填" unCheckedChildren="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
