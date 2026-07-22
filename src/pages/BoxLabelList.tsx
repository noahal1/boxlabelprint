import { useState, useEffect } from 'react';
import {
  Table, Card, Button, Tag, Space, Input, Select, Popconfirm, message, Modal, Typography, Row, Col, Tooltip,
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

const STAT_STYLES: Record<string, { gradient: string; icon: string; accent: string }> = {
  all:     { gradient: 'linear-gradient(135deg, #deecf9 0%, #f0f6fc 100%)', icon: '#0078d4', accent: '#0078d4' },
  inner:   { gradient: 'linear-gradient(135deg, #e0f2ff 0%, #ecf7ff 100%)', icon: '#0078d4', accent: '#0078d4' },
  outer:   { gradient: 'linear-gradient(135deg, #f0e6ff 0%, #f5f0ff 100%)', icon: '#8764b8', accent: '#8764b8' },
  printed: { gradient: 'linear-gradient(135deg, #dff6dd 0%, #ecf9eb 100%)', icon: '#107c10', accent: '#107c10' },
  pending: { gradient: 'linear-gradient(135deg, #fff4ce 0%, #fff9e6 100%)', icon: '#ff8c00', accent: '#ff8c00' },
};

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
    } catch {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, typeFilter]);

  const handleSearch = () => loadData();
  const handleDelete = async (id: number) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.deleteBoxLabel(id);
        message.success('删除成功');
        loadData();
      }
    } catch {
      message.error('删除失败');
    }
  };

  const handlePrint = async (record: BoxLabel) => {
    const defs = await loadFieldDefinitions(record.box_type);
    setPreviewData({
      box_number: record.box_number,
      qr_content: record.qr_content || record.box_number,
      displayFields: extractDisplayValues(record, defs),
    });
    setPreviewVisible(true);
  };

  const handlePrintConfirm = async (record: BoxLabel) => {
    try {
      if (!window.electronAPI) return;
      const printerName = await window.electronAPI.getSetting('printer_name');
      if (!printerName) {
        message.warning('请先配置打印机');
        return;
      }
      await window.electronAPI.markPrinted(record.id, printerName);
      message.success(`箱牌 ${record.box_number} 打印完成`);
      loadData();
    } catch (err: any) {
      message.error('打印失败: ' + (err?.message || ''));
    }
  };

  const statItems = [
    { key: 'all',     title: '全部',  value: data.length, icon: <FileTextOutlined /> },
    { key: 'inner',   title: '内箱',  value: data.filter(d => d.box_type === 'inner').length, icon: <InboxOutlined /> },
    { key: 'outer',   title: '外箱',  value: data.filter(d => d.box_type === 'outer').length, icon: <SnippetsOutlined /> },
    { key: 'printed', title: '已打印', value: data.filter(d => d.status === 'printed').length, icon: <DownloadOutlined /> },
    { key: 'pending', title: '待打印', value: data.filter(d => d.status === 'pending').length, icon: <PrinterOutlined /> },
  ];

  const columns: any[] = [
    {
      title: '箱号', dataIndex: 'box_number', key: 'box_number', width: 140, fixed: 'left',
      render: (val: string) => (
        <Text code strong style={{ fontSize: 13, color: '#0078d4', background: '#deecf9', border: 'none', padding: '2px 8px', borderRadius: 4 }}>
          {val}
        </Text>
      ),
    },
    {
      title: '箱型', dataIndex: 'box_type', key: 'box_type', width: 64,
      render: (val: BoxType) => (
        <Tag color={val === 'inner' ? 'blue' : 'purple'} style={{ borderRadius: 4, margin: 0 }}>
          {BOX_TYPE_LABELS[val]}
        </Tag>
      ),
    },
    ...fieldDefs.slice(0, 5).map((f) => ({
      title: f.label, key: f.key, width: 120, ellipsis: true,
      render: (_: any, record: BoxLabel) => record.custom_fields?.[f.key] || <span style={{ color: '#ddd' }}>-</span>,
    })),
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 68,
      render: (s: string) =>
        s === 'printed' ? (
          <Tag color="success" style={{ borderRadius: 4, margin: 0 }}>已打印</Tag>
        ) : (
          <Tag color="warning" className="fluent-pulse" style={{ borderRadius: 4, margin: 0 }}>待打印</Tag>
        ),
    },
    {
      title: '打印', dataIndex: 'print_count', key: 'print_count', width: 48, align: 'center' as const,
      render: (v: number) => <Text style={{ color: v > 0 ? '#107c10' : '#ccc', fontWeight: 600 }}>{v || 0}</Text>,
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 148,
      render: (val: string) => <span style={{ color: '#605e5c', fontSize: 12 }}>{val}</span>,
    },
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
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* ====== Fluent 2 统计卡片 ====== */}
      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        {statItems.map((s) => {
          const c = STAT_STYLES[s.key];
          return (
            <Col span={4} key={s.key}>
              <div className="hover-lift" style={{
                background: c.gradient,
                borderRadius: 14,
                padding: '16px 14px',
                border: '1px solid rgba(255,255,255,0.6)',
                cursor: 'default',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11.5, color: '#605e5c', marginBottom: 2, fontWeight: 500 }}>{s.title}</div>
                    <div className="fluent-stat" style={{ color: c.accent, fontSize: 24 }}>{s.value}</div>
                  </div>
                  <div style={{
                    width: 34, height: 34, background: c.icon, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, opacity: 0.12, fontSize: 18, color: '#fff',
                  }}>
                    {s.icon}
                  </div>
                </div>
              </div>
            </Col>
          );
        })}
      </Row>

      {/* ====== Fluent 2 操作栏 ====== */}
      <div className="fluent-card" style={{ padding: '14px 18px', marginBottom: 14 }}>
        <Space wrap size={10}>
          <Input
            placeholder="搜索箱号/字段内容"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 240, borderRadius: 6 }}
            allowClear
          />
          <Select
            placeholder="箱型"
            value={typeFilter}
            onChange={setTypeFilter}
            allowClear
            style={{ width: 90, borderRadius: 6 }}
            options={[{ value: 'inner', label: '内箱' }, { value: 'outer', label: '外箱' }]}
          />
          <Select
            placeholder="状态"
            value={statusFilter}
            onChange={setStatusFilter}
            allowClear
            style={{ width: 90, borderRadius: 6 }}
            options={[{ value: 'pending', label: '待打印' }, { value: 'printed', label: '已打印' }]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} style={{ borderRadius: 6, height: 32 }}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} style={{ borderRadius: 6, height: 32 }}>
            刷新
          </Button>
          {selectedRowKeys.length > 0 && (
            <Popconfirm title={`确认删除 ${selectedRowKeys.length} 个？`} onConfirm={async () => {
              if (window.electronAPI) {
                for (const id of selectedRowKeys) await window.electronAPI.deleteBoxLabel(id as number);
                message.success(`已删除 ${selectedRowKeys.length} 个`);
                setSelectedRowKeys([]);
                loadData();
              }
            }}>
              <Button danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }}>
                批量删除 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {/* ====== Fluent 2 表格 ====== */}
      <div className="fluent-card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: fieldDefs.length * 100 + 700 }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          size="middle"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            style: { marginRight: 8 },
          }}
          components={{
            header: {
              cell: (props: any) => (
                <th {...props} style={{ ...props?.style, background: '#faf9f8', color: '#605e5c', fontWeight: 600, fontSize: 12 }} />
              ),
            },
          }}
          onRow={() => ({
            style: { transition: 'background 0.15s' },
            onMouseEnter: (e: any) => {
              if (e?.currentTarget) e.currentTarget.style.background = '#f0f6fc';
            },
            onMouseLeave: (e: any) => {
              if (e?.currentTarget) e.currentTarget.style.background = '';
            },
          })}
        />
      </div>

      {/* ====== 打印预览 ====== */}
      {previewData && (
        <PrintPreview
          visible={previewVisible}
          data={previewData}
          onClose={() => setPreviewVisible(false)}
          onPrint={() => handlePrintConfirm(previewData)}
        />
      )}

      {/* ====== 打印记录弹窗 ====== */}
      <Modal
        title={<Space><HistoryOutlined /><span>打印记录</span></Space>}
        open={logsVisible}
        onCancel={() => setLogsVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        {printLogs.length > 0 ? (
          <Table
            dataSource={printLogs}
            columns={[
              { title: '打印机', dataIndex: 'printer_name', key: 'printer_name' },
              { title: '时间', dataIndex: 'printed_at', key: 'printed_at' },
              {
                title: '状态', dataIndex: 'status', key: 'status',
                render: (s: string) =>
                  s === 'success' ? <Tag color="success">成功</Tag> : <Tag color="error">失败</Tag>,
              },
            ]}
            rowKey="id"
            pagination={false}
            size="small"
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 32, color: '#8a8886' }}>
            <FileTextOutlined style={{ fontSize: 32, color: '#c8c6c4', marginBottom: 8 }} />
            <div>暂无打印记录</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
