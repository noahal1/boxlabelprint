import { useState, useEffect } from 'react';
import {
  Table, Card, Button, Tag, Space, Input, Select, Popconfirm, message, Modal, Typography, Row, Col, Statistic, Tooltip,
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, DeleteOutlined, ReloadOutlined, FileTextOutlined,
  HistoryOutlined, InboxOutlined, SnippetsOutlined, DownloadOutlined,
} from '@ant-design/icons';
import type { BoxLabel, FieldDefinition, BoxType } from '../types';
import { BOX_TYPE_LABELS } from '../types';
import { loadFieldDefinitions, getSortedFields, extractDisplayValues } from '../utils/fieldConfig';
import PrintPreview from '../components/PrintPreview';

const { Text } = Typography;

export default function BoxLabelList() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BoxLabel[]>([]);
  const [fieldDefs, setFieldDefs] = useState<FieldDefinition[]>([]);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<BoxType | undefined>(undefined);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [printLogs, setPrintLogs] = useState<any[]>([]);
  const [logsVisible, setLogsVisible] = useState(false);

  useEffect(() => {
    loadFieldDefinitions('inner').then((defs) => setFieldDefs(getSortedFields(defs)));
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      if (!window.electronAPI) return;
      let labels = await window.electronAPI.getBoxLabels({ keyword: keyword || undefined, status: statusFilter });
      if (typeFilter) labels = labels.filter((l) => l.box_type === typeFilter);
      setData(labels);
    } catch { message.error('加载数据失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [statusFilter, typeFilter]);

  const handleSearch = () => loadData();
  const handleDelete = async (id: number) => {
    try { if (window.electronAPI) { await window.electronAPI.deleteBoxLabel(id); message.success('删除成功'); loadData(); } } catch { message.error('删除失败'); }
  };

  const handlePrint = async (record: BoxLabel) => {
    const defs = await loadFieldDefinitions(record.box_type);
    setPreviewData({
      box_number: record.box_number, qr_content: record.qr_content || record.box_number,
      displayFields: extractDisplayValues(record, defs),
    });
    setPreviewVisible(true);
  };

  const handlePrintConfirm = async (record: BoxLabel) => {
    try {
      if (!window.electronAPI) return;
      const printerName = await window.electronAPI.getSetting('printer_name');
      if (!printerName) { message.warning('请先配置打印机'); return; }
      await window.electronAPI.markPrinted(record.id, printerName);
      message.success(`箱牌 ${record.box_number} 打印完成`);
      loadData();
    } catch (err: any) { message.error('打印失败: ' + (err?.message || '')); }
  };

  const columns: any[] = [
    {
      title: '箱号', dataIndex: 'box_number', key: 'box_number', width: 140, fixed: 'left',
      render: (val: string) => <Text code strong style={{ fontSize: 13, color: '#1677ff' }}>{val}</Text>,
    },
    {
      title: '箱型', dataIndex: 'box_type', key: 'box_type', width: 64,
      render: (val: BoxType) => <Tag color={val === 'inner' ? 'blue' : 'purple'} style={{ borderRadius: 4 }}>{BOX_TYPE_LABELS[val]}</Tag>,
    },
    ...fieldDefs.slice(0, 5).map((f) => ({
      title: f.label, key: f.key, width: 120, ellipsis: true,
      render: (_: any, record: BoxLabel) => record.custom_fields?.[f.key] || <span style={{ color: '#ddd' }}>-</span>,
    })),
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 68,
      render: (s: string) => s === 'printed'
        ? <Tag color="success" style={{ borderRadius: 4 }}>已打印</Tag>
        : <Tag color="warning" style={{ borderRadius: 4, animation: 'pulseGlow 2s infinite' }}>待打印</Tag>,
    },
    { title: '打印', dataIndex: 'print_count', key: 'print_count', width: 48, align: 'center' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 148 },
    {
      title: '操作', key: 'action', width: 150, fixed: 'right',
      render: (_: any, record: BoxLabel) => (
        <Space size="small">
          <Tooltip title="打印标签">
            <Button type="primary" size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record)}
              style={{ borderRadius: 6 }}>打印</Button>
          </Tooltip>
          <Tooltip title="打印记录">
            <Button size="small" icon={<HistoryOutlined />} onClick={async () => {
              if (window.electronAPI) {
                setPrintLogs(await window.electronAPI.getPrintLogs(record.id));
                setLogsVisible(true);
              }
            }} style={{ borderRadius: 6 }} />
          </Tooltip>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }} justify="center">
        {[
          { title: '全部', value: data.length, color: '#1677ff', icon: <FileTextOutlined /> },
          { title: '内箱', value: data.filter(d => d.box_type === 'inner').length, color: '#1677ff', icon: <InboxOutlined /> },
          { title: '外箱', value: data.filter(d => d.box_type === 'outer').length, color: '#722ed1', icon: <SnippetsOutlined /> },
          { title: '已打印', value: data.filter(d => d.status === 'printed').length, color: '#52c41a', icon: <DownloadOutlined /> },
          { title: '待打印', value: data.filter(d => d.status === 'pending').length, color: '#faad14', icon: <PrinterOutlined /> },
        ].map((s) => (
          <Col span={4} key={s.title}>
            <Card className="stat-card" bodyStyle={{ padding: '14px 16px' }} style={{ borderRadius: 10 }}>
              <Statistic title={<span style={{ fontSize: 12, color: '#999' }}>{s.title}</span>}
                value={s.value} valueStyle={{ color: s.color, fontSize: 22, fontWeight: 700 }} prefix={s.icon} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 操作栏 */}
      <Card bodyStyle={{ padding: '12px 16px' }} style={{ marginBottom: 16, borderRadius: 10 }}>
        <Space wrap>
          <Input placeholder="搜索箱号/字段内容" prefix={<SearchOutlined />} value={keyword}
            onChange={e => setKeyword(e.target.value)} onPressEnter={handleSearch}
            style={{ width: 240, borderRadius: 6 }} allowClear />
          <Select placeholder="箱型" value={typeFilter} onChange={setTypeFilter} allowClear style={{ width: 90 }}
            options={[{ value: 'inner', label: '内箱' }, { value: 'outer', label: '外箱' }]} />
          <Select placeholder="状态" value={statusFilter} onChange={setStatusFilter} allowClear style={{ width: 90 }}
            options={[{ value: 'pending', label: '待打印' }, { value: 'printed', label: '已打印' }]} />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} style={{ borderRadius: 6 }}>搜索</Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} style={{ borderRadius: 6 }}>刷新</Button>
          {selectedRowKeys.length > 0 && (
            <Popconfirm title={`确认删除 ${selectedRowKeys.length} 个？`} onConfirm={async () => {
              if (window.electronAPI) {
                for (const id of selectedRowKeys) await window.electronAPI.deleteBoxLabel(id as number);
                message.success(`已删除 ${selectedRowKeys.length} 个`); setSelectedRowKeys([]); loadData();
              }
            }}>
              <Button danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }}>批量删除 ({selectedRowKeys.length})</Button>
            </Popconfirm>
          )}
        </Space>
      </Card>

      {/* 表格 */}
      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 10, overflow: 'hidden' }}>
        <Table dataSource={data} columns={columns} rowKey="id" loading={loading}
          scroll={{ x: fieldDefs.length * 100 + 700 }}
          rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
          size="middle"
          pagination={{
            pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
            style: { marginRight: 8 },
          }}
          onRow={() => ({
            style: { transition: 'background 0.15s' },
            onMouseEnter: (e) => { if (e?.currentTarget) e.currentTarget.style.background = '#f5f5f5'; },
            onMouseLeave: (e) => { if (e?.currentTarget) e.currentTarget.style.background = ''; },
          })} />
      </Card>

      {previewData && <PrintPreview visible={previewVisible} data={previewData} onClose={() => setPreviewVisible(false)}
        onPrint={() => handlePrintConfirm(previewData)} />}

      <Modal title="打印记录" open={logsVisible} onCancel={() => setLogsVisible(false)} footer={null} width={600}
        style={{ borderRadius: 12 }}>
        {printLogs.length > 0 ? (
          <Table dataSource={printLogs} columns={[
            { title: '打印机', dataIndex: 'printer_name', key: 'printer_name' },
            { title: '时间', dataIndex: 'printed_at', key: 'printed_at' },
            { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) =>
              s === 'success' ? <Tag color="success">成功</Tag> : <Tag color="error">失败</Tag> },
          ]} rowKey="id" pagination={false} size="small" />
        ) : <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>暂无打印记录</div>}
      </Modal>
    </div>
  );
}
