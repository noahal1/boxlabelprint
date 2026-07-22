import { useState, useEffect, useCallback } from 'react';
import {
  Form, Input, InputNumber, Button, Card, Row, Col,
  message, Space, Typography, Divider, Spin, Tag, Select,
} from 'antd';
import { SaveOutlined, QrcodeOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import PrintPreview from '../components/PrintPreview';
import { loadFieldDefinitions, getSortedFields, buildSubmitData } from '../utils/fieldConfig';
import type { FieldDefinition, BoxType } from '../types';
import { BOX_TYPE_LABELS } from '../types';

const { Text } = Typography;

const BOX_TYPE_OPTIONS = [
  { value: 'inner', label: '内箱' },
  { value: 'outer', label: '外箱' },
];

export default function BoxLabelForm() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [boxType, setBoxType] = useState<BoxType>('inner');
  const [fieldDefs, setFieldDefs] = useState<FieldDefinition[]>([]);
  const [fieldsReady, setFieldsReady] = useState(false);
  const [boxNumber, setBoxNumber] = useState('');
  const [generating, setGenerating] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const loadFields = useCallback(async (type: BoxType) => {
    setFieldsReady(false);
    form.resetFields();
    const defs = await loadFieldDefinitions(type);
    setFieldDefs(getSortedFields(defs));
    setFieldsReady(true);
  }, [form]);

  useEffect(() => { loadFields(boxType); }, [boxType, loadFields]);

  const generateBoxNumber = async () => {
    try {
      setGenerating(true);
      if (window.electronAPI) {
        setBoxNumber(await window.electronAPI.generateBoxNumber());
      }
    } catch {} finally { setGenerating(false); }
  };

  useEffect(() => { if (fieldsReady) generateBoxNumber(); }, [fieldsReady, boxType]);

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      if (!window.electronAPI) { message.error('无法连接后端'); return; }
      const submitData = buildSubmitData(boxNumber, boxType, fieldDefs, values);
      await window.electronAPI.createBoxLabel(submitData);
      message.success({ content: `[${BOX_TYPE_LABELS[boxType]}] ${boxNumber} 创建成功！`, icon: <SaveOutlined /> });
      form.resetFields();
      generateBoxNumber();
    } catch (err: any) { message.error(err?.message || '创建失败'); }
    finally { setLoading(false); }
  };

  const handlePreview = async () => {
    try {
      const values = await form.validateFields();
      setPreviewData({
        box_number: boxNumber, qr_content: boxNumber,
        displayFields: fieldDefs.map((f) => ({ key: f.key, label: f.label, value: values[f.key]?.trim() || '' })),
      });
      setPreviewVisible(true);
    } catch { message.warning('请先填写必填字段'); }
  };

  const renderField = (field: FieldDefinition) => {
    const rules = field.required ? [{ required: true, message: `请输入${field.label}` }] : [];
    if (field.type === 'number') {
      return (
        <Form.Item key={field.key} name={field.key} label={field.label} rules={rules}
          tooltip={field.required ? '必填' : '可选'}>
          <InputNumber style={{ width: '100%', borderRadius: 8 }} min={0} precision={2} placeholder={`请输入${field.label}`} />
        </Form.Item>
      );
    }
    return (
      <Form.Item key={field.key} name={field.key} label={field.label} rules={rules}
        tooltip={field.required ? '必填' : '可选'}>
        <Input placeholder={`请输入${field.label}`} maxLength={100} style={{ borderRadius: 8 }} />
      </Form.Item>
    );
  };

  if (!fieldsReady) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" tip="加载字段配置..." fullscreen /></div>;
  }

  const leftFields = fieldDefs.filter((_, i) => i % 2 === 0);
  const rightFields = fieldDefs.filter((_, i) => i % 2 === 1);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card
        style={{ borderRadius: 14, border: '1px solid #f0f0f0' }}
        bodyStyle={{ padding: '24px 28px' }}
        title={
          <Space>
            <div style={{ width: 4, height: 20, background: 'linear-gradient(180deg, #1677ff, #69b1ff)', borderRadius: 2 }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: '#1f1f1f' }}>新建箱牌</span>
            <Tag color={boxType === 'inner' ? 'blue' : 'purple'} style={{ borderRadius: 4, fontSize: 12, lineHeight: '22px', marginLeft: 4 }}>
              {BOX_TYPE_LABELS[boxType]}
            </Tag>
          </Space>
        }
        extra={
          <Space>
            <Text type="secondary" style={{ fontSize: 13 }}>箱型：</Text>
            <Select value={boxType} onChange={(val) => setBoxType(val as BoxType)}
              options={BOX_TYPE_OPTIONS} style={{ width: 100, borderRadius: 8 }}
              dropdownStyle={{ borderRadius: 8 }} />
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>

          {/* 箱号区域 */}
          <div style={{
            display: 'flex', gap: 16, alignItems: 'flex-end',
            background: 'linear-gradient(135deg, #e6f4ff 0%, #f0f5ff 100%)',
            borderRadius: 12, padding: '18px 20px', marginBottom: 8,
          }}>
            <Form.Item label={<span style={{ fontWeight: 600, fontSize: 13 }}>箱号</span>} required help="" style={{ marginBottom: 0, flex: 1 }}>
              <Input value={boxNumber} onChange={(e) => setBoxNumber(e.target.value)}
                suffix={
                  <Button size="small" type="text" icon={<ReloadOutlined />} loading={generating} onClick={generateBoxNumber}
                    style={{ color: '#1677ff' }} />
                }
                style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 15, borderRadius: 8, border: '1px solid #d9d9d9' }} />
            </Form.Item>
            <Space size={4} style={{ paddingBottom: 4 }}>
              <ThunderboltOutlined style={{ color: '#1677ff', fontSize: 13 }} />
              <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>自动生成</Text>
            </Space>
          </div>

          <Divider style={{ margin: '16px 0', borderColor: '#f0f0f0' }} />

          {/* 动态字段 */}
          <Row gutter={24}>
            <Col span={12}>{leftFields.map(renderField)}</Col>
            <Col span={12}>{rightFields.map(renderField)}</Col>
          </Row>

          <Divider style={{ margin: '12px 0 20px', borderColor: '#f0f0f0' }} />

          {/* 操作按钮 */}
          <Space size={16}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} size="large"
              style={{ height: 44, borderRadius: 10, padding: '0 28px', fontWeight: 600, boxShadow: '0 4px 12px rgba(22,119,255,0.3)' }}>
              保存箱牌
            </Button>
            <Button icon={<QrcodeOutlined />} onClick={handlePreview} size="large"
              style={{ height: 44, borderRadius: 10, padding: '0 28px', border: '1px solid #d9d9d9' }}>
              预览标签
            </Button>
          </Space>
        </Form>
      </Card>

      {previewData && (
        <PrintPreview
          visible={previewVisible}
          data={previewData}
          onClose={() => setPreviewVisible(false)}
          onPrint={() => { setPreviewVisible(false); form.submit(); }}
        />
      )}
    </div>
  );
}
