import { useState, useEffect, useCallback } from 'react';
import {
  Form, Input, InputNumber, Button, Card, Row, Col,
  message, Space, Typography, Divider, Spin, Tag, Select,
} from 'antd';
import { SaveOutlined, QrcodeOutlined, ReloadOutlined } from '@ant-design/icons';
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
          <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder={`请输入${field.label}`} />
        </Form.Item>
      );
    }
    return (
      <Form.Item key={field.key} name={field.key} label={field.label} rules={rules}
        tooltip={field.required ? '必填' : '可选'}>
        <Input placeholder={`请输入${field.label}`} maxLength={100} />
      </Form.Item>
    );
  };

  if (!fieldsReady) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" tip="加载字段配置..." fullscreen /></div>;
  }

  const leftFields = fieldDefs.filter((_, i) => i % 2 === 0);
  const rightFields = fieldDefs.filter((_, i) => i % 2 === 1);

  return (
    <div>
      <Row gutter={24}>
        <Col xs={24} lg={24}>
          <Card
            style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            title={
              <Space>
                <div style={{ width: 6, height: 24, background: 'linear-gradient(180deg, #1677ff, #69b1ff)', borderRadius: 3 }} />
                <span style={{ fontSize: 16, fontWeight: 600 }}>新建箱牌</span>
                <Tag color={boxType === 'inner' ? 'blue' : 'purple'} style={{ borderRadius: 4, fontSize: 12, lineHeight: '22px' }}>
                  {BOX_TYPE_LABELS[boxType]}
                </Tag>
              </Space>
            }
            extra={
              <Space>
                <Text type="secondary" style={{ fontSize: 13 }}>箱型：</Text>
                <Select value={boxType} onChange={(val) => setBoxType(val as BoxType)}
                  options={BOX_TYPE_OPTIONS} style={{ width: 100 }}
                  dropdownStyle={{ borderRadius: 8 }} />
              </Space>
            }
          >
            <Form form={form} layout="vertical" onFinish={handleSubmit}
              style={{ maxWidth: 700 }}>

              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', background: '#fafafa', borderRadius: 10, padding: '16px 20px', marginBottom: 8 }}>
                <Form.Item label={<span style={{ fontWeight: 500 }}>箱号</span>} required help="" style={{ marginBottom: 0, flex: 1 }}>
                  <Input value={boxNumber} onChange={(e) => setBoxNumber(e.target.value)}
                    suffix={<Button size="small" type="text" icon={<ReloadOutlined />} loading={generating} onClick={generateBoxNumber} />}
                    style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 15 }} />
                </Form.Item>
                <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', paddingBottom: 4 }}>
                  系统自动生成
                </Text>
              </div>

              <Divider style={{ margin: '16px 0' }} />

              <Row gutter={24}>
                <Col span={12}>{leftFields.map(renderField)}</Col>
                <Col span={12}>{rightFields.map(renderField)}</Col>
              </Row>

              <Divider style={{ margin: '8px 0 16px' }} />

              <Space size={16}>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} size="large"
                  style={{ height: 44, borderRadius: 10, padding: '0 28px', fontWeight: 600, boxShadow: '0 4px 12px rgba(22,119,255,0.3)' }}>
                  保存箱牌
                </Button>
                <Button icon={<QrcodeOutlined />} onClick={handlePreview} size="large"
                  style={{ height: 44, borderRadius: 10, padding: '0 28px' }}>
                  预览标签
                </Button>
              </Space>
            </Form>
          </Card>
      </Col>
      </Row>

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
