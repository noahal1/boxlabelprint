import { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Table, Tag, Button, Empty, Spin, Typography, Space } from 'antd';
import {
  FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined,
  PlusOutlined, UnorderedListOutlined, InboxOutlined, SnippetsOutlined,
  RightOutlined, ReloadOutlined, SettingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { BoxLabel, BoxType } from '../types';
import { BOX_TYPE_LABELS } from '../types';

const { Text } = Typography;

// 根据时间返回问候语
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

// 主题色的柔和渐变
const CARD_COLORS: Record<string, { bg: string; iconBg: string; color: string }> = {
  total:   { bg: 'linear-gradient(135deg, #e6f4ff 0%, #f0f5ff 100%)', iconBg: '#1677ff', color: '#1677ff' },
  printed: { bg: 'linear-gradient(135deg, #f6ffed 0%, #e8f8e0 100%)', iconBg: '#52c41a', color: '#52c41a' },
  pending: { bg: 'linear-gradient(135deg, #fffbe6 0%, #fff7cc 100%)', iconBg: '#faad14', color: '#faad14' },
  inner:   { bg: 'linear-gradient(135deg, #e6f4ff 0%, #e0efff 100%)', iconBg: '#1677ff', color: '#1677ff' },
  outer:   { bg: 'linear-gradient(135deg, #f9f0ff 0%, #f0e0ff 100%)', iconBg: '#722ed1', color: '#722ed1' },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, printed: 0, pending: 0, inner: 0, outer: 0 });
  const [recentLabels, setRecentLabels] = useState<BoxLabel[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (!window.electronAPI) return;
      const allLabels = await window.electronAPI.getBoxLabels();
      setStats({
        total: allLabels.length,
        printed: allLabels.filter((l) => l.status === 'printed').length,
        pending: allLabels.filter((l) => l.status === 'pending').length,
        inner: allLabels.filter((l) => l.box_type === 'inner').length,
        outer: allLabels.filter((l) => l.box_type === 'outer').length,
      });
      setRecentLabels(allLabels.slice(0, 8));
    } catch (err) {
      console.error('加载失败:', err);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  // 今天创建的箱牌数
  const todayCount = useMemo(() => {
    const today = new Date().toLocaleDateString();
    return recentLabels.filter((l) => {
      const d = l.created_at?.split(' ')[0];
      return d === today || new Date(l.created_at).toLocaleDateString() === today;
    }).length;
  }, [recentLabels]);

  // 打印完成率
  const completionRate = stats.total > 0 ? Math.round((stats.printed / stats.total) * 100) : 0;

  const columns = [
    {
      title: '箱号', dataIndex: 'box_number', key: 'box_number', width: 150,
      render: (val: string) => (
        <Text code strong style={{ fontSize: 12, color: '#1677ff', background: '#e6f4ff', border: 'none', padding: '2px 6px' }}>
          {val}
        </Text>
      ),
    },
    {
      title: '箱型', dataIndex: 'box_type', key: 'box_type', width: 60,
      render: (val: BoxType) => (
        <Tag color={val === 'inner' ? 'blue' : 'purple'}
          style={{ borderRadius: 4, fontSize: 11, lineHeight: '18px', margin: 0 }}>
          {BOX_TYPE_LABELS[val]}
        </Tag>
      ),
    },
    {
      title: '供应商代码', key: 'supplier_code', width: 120, ellipsis: true,
      render: (_: any, r: BoxLabel) => r.custom_fields?.supplier_code || <span style={{ color: '#ddd' }}>-</span>,
    },
    {
      title: '物料编码', key: 'material_code', width: 120, ellipsis: true,
      render: (_: any, r: BoxLabel) => r.custom_fields?.material_code || <span style={{ color: '#ddd' }}>-</span>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 72,
      render: (s: string) => s === 'printed'
        ? <Tag color="success" style={{ borderRadius: 4, margin: 0 }}>已打印</Tag>
        : <Tag color="warning" className="pulse-glow" style={{ borderRadius: 4, margin: 0 }}>待打印</Tag>,
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 150,
      render: (val: string) => <span style={{ color: '#666', fontSize: 12 }}>{val}</span>,
    },
  ];

  const statCards = [
    {
      key: 'total', icon: <FileTextOutlined />, title: '箱牌总数',
      value: stats.total, color: CARD_COLORS.total, suffix: '个',
    },
    {
      key: 'printed', icon: <CheckCircleOutlined />, title: '已打印',
      value: stats.printed, color: CARD_COLORS.printed,
      suffix: stats.total > 0 ? `/${stats.total}` : '',
    },
    {
      key: 'pending', icon: <ClockCircleOutlined />, title: '待打印',
      value: stats.pending, color: CARD_COLORS.pending, suffix: '个',
    },
    {
      key: 'inner', icon: <InboxOutlined />, title: '内箱',
      value: stats.inner, color: CARD_COLORS.inner, suffix: '个',
    },
    {
      key: 'outer', icon: <SnippetsOutlined />, title: '外箱',
      value: stats.outer, color: CARD_COLORS.outer, suffix: '个',
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="加载中..." fullscreen />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* ====== 欢迎横幅 ====== */}
      <div style={{
        background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 50%, #003eb3 100%)',
        borderRadius: 16,
        padding: '28px 32px',
        marginBottom: 20,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* 装饰圆 */}
        <div style={{
          position: 'absolute', top: -40, right: -20,
          width: 160, height: 160,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, right: 80,
          width: 200, height: 200,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
        }} />

        <Row align="middle" justify="space-between" wrap>
          <Col>
            <Space direction="vertical" size={4}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 22, fontWeight: 700, letterSpacing: 0.5 }}>
                {getGreeting()}！👋
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>
                今天是 {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
              </Text>
            </Space>
          </Col>
          <Col style={{ marginTop: 8 }}>
            <Space size={24}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 2 }}>今日新增</div>
                <div style={{ color: '#fff', fontSize: 26, fontWeight: 700 }}>{todayCount}</div>
              </div>
              <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.15)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 2 }}>完成率</div>
                <div style={{ color: '#fff', fontSize: 26, fontWeight: 700 }}>{completionRate}%</div>
              </div>
              <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.15)' }} />
              <Button
                icon={<ReloadOutlined />}
                onClick={loadData}
                style={{
                  background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff', borderRadius: 8, height: 34,
                }}
              >
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* ====== 统计卡片 ====== */}
      <Row gutter={[14, 14]} justify="center">
        {statCards.map((card) => (
          <Col xs={12} sm={8} lg={4} key={card.key}>
            <div className="hover-card" style={{
              background: card.color.bg,
              borderRadius: 14,
              padding: '18px 16px',
              transition: 'all 0.25s ease',
              cursor: 'default',
              border: '1px solid rgba(0,0,0,0.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4, fontWeight: 500 }}>{card.title}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: card.color.color, lineHeight: 1.2 }}>
                    {card.value}
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{card.suffix}</div>
                </div>
                <div style={{
                  width: 38, height: 38,
                  background: card.color.iconBg,
                  borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  opacity: 0.15,
                  fontSize: 20,
                  color: '#fff',
                }}>
                  {card.icon}
                </div>
              </div>
              {/* 迷你进度条（仅已打印/待打印卡展示） */}
              {(card.key === 'printed' || card.key === 'pending') && stats.total > 0 && (
                <div style={{
                  marginTop: 10,
                  height: 3,
                  background: 'rgba(0,0,0,0.06)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${(card.key === 'printed' ? stats.printed : stats.pending) / stats.total * 100}%`,
                    height: '100%',
                    background: card.key === 'printed' ? '#52c41a' : '#faad14',
                    borderRadius: 2,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              )}
            </div>
          </Col>
        ))}
      </Row>

      {/* ====== 快捷操作 ====== */}
      <Row gutter={[14, 14]} style={{ marginTop: 14 }}>
        <Col xs={24} lg={14}>
          <Card
            style={{ borderRadius: 14, border: '1px solid #f0f0f0' }}
            bodyStyle={{ padding: '20px 24px' }}
          >
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 15, color: '#1f1f1f' }}>快捷操作</Text>
              <Text style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>常用功能快速入口</Text>
            </div>
            <Row gutter={[12, 12]}>
              <Col span={8}>
                <div
                  onClick={() => navigate('/create')}
                  className="hover-card"
                  style={{
                    background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
                    borderRadius: 12,
                    padding: '18px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                  }}
                >
                  <PlusOutlined style={{ fontSize: 24, color: '#fff', marginBottom: 6 }} />
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>新建箱牌</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>创建新标签</div>
                </div>
              </Col>
              <Col span={8}>
                <div
                  onClick={() => navigate('/list')}
                  className="hover-card"
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    padding: '18px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: '1px solid #f0f0f0',
                    transition: 'all 0.25s ease',
                  }}
                >
                  <UnorderedListOutlined style={{ fontSize: 24, color: '#1677ff', marginBottom: 6 }} />
                  <div style={{ color: '#1f1f1f', fontSize: 14, fontWeight: 600 }}>箱牌管理</div>
                  <div style={{ color: '#999', fontSize: 11, marginTop: 2 }}>查看/搜索/删除</div>
                </div>
              </Col>
              <Col span={8}>
                <div
                  onClick={() => navigate('/settings')}
                  className="hover-card"
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    padding: '18px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: '1px solid #f0f0f0',
                    transition: 'all 0.25s ease',
                  }}
                >
                  <SettingOutlined style={{ fontSize: 24, color: '#722ed1', marginBottom: 6 }} />
                  <div style={{ color: '#1f1f1f', fontSize: 14, fontWeight: 600 }}>系统设置</div>
                  <div style={{ color: '#999', fontSize: 11, marginTop: 2 }}>打印机/模板/字段</div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            style={{ borderRadius: 14, border: '1px solid #f0f0f0', height: '100%' }}
            bodyStyle={{ padding: '20px 24px' }}
          >
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 15, color: '#1f1f1f' }}>数据概览</Text>
            </div>
            <Space direction="vertical" size={0} style={{ width: '100%' }}>
              {[
                { label: '总箱牌数', value: stats.total, color: '#1677ff' },
                { label: '已打印', value: stats.printed, color: '#52c41a' },
                { label: '待打印', value: stats.pending, color: '#faad14' },
                { label: '内箱', value: stats.inner, color: '#1677ff' },
                { label: '外箱', value: stats.outer, color: '#722ed1' },
              ].map((item) => (
                <div key={item.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 0',
                  borderBottom: '1px solid #f5f5f5',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color }} />
                    <span style={{ fontSize: 13, color: '#666' }}>{item.label}</span>
                  </div>
                  <Text strong style={{ fontSize: 14, color: item.color }}>{item.value}</Text>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* ====== 最近箱牌 ====== */}
      <Card
        title={
          <Space>
            <div style={{ width: 4, height: 18, background: '#1677ff', borderRadius: 2 }} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>最近创建的箱牌</span>
            <Tag style={{ borderRadius: 4, fontSize: 11, lineHeight: '20px' }}>{recentLabels.length}</Tag>
          </Space>
        }
        style={{ marginTop: 14, borderRadius: 14, border: '1px solid #f0f0f0' }}
        bodyStyle={{ padding: 0 }}
        extra={
          <Button type="link" size="small" onClick={() => navigate('/list')} style={{ fontSize: 13 }}>
           查看全部 <RightOutlined style={{ fontSize: 11 }} />
          </Button>
        }
      >
        {recentLabels.length > 0 ? (
          <Table
            dataSource={recentLabels}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="middle"
            style={{ borderRadius: 14 }}
            onRow={() => ({
              style: { cursor: 'pointer', transition: 'background 0.15s' },
            })}
            components={{
              header: {
                cell: (props: any) => (
                  <th {...props} style={{ ...props?.style, background: '#fafafa', color: '#666', fontWeight: 600, fontSize: 12 }} />
                ),
              },
            }}
          />
        ) : (
          <div style={{ padding: '48px 0' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" size={12}>
                  <Text style={{ color: '#999' }}>还没有创建任何箱牌</Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/create')}
                    style={{ borderRadius: 8, height: 36 }}>
                    创建第一个箱牌
                  </Button>
                </Space>
              }
            />
          </div>
        )}
      </Card>

      {/* ====== 底部信息 ====== */}
      <div style={{ textAlign: 'center', padding: '16px 0 8px', color: '#bbb', fontSize: 11 }}>
        箱牌打印管理系统 · 数据实时更新
      </div>
    </div>
  );
}
