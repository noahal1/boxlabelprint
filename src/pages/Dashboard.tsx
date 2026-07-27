import { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Table, Tag, Button, Empty, Spin, Typography, Space } from 'antd';
import {
  FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined,
  PlusOutlined, InboxOutlined, SnippetsOutlined,
  RightOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { BoxLabel, BoxType } from '../types';
import { BOX_TYPE_LABELS } from '../types';

const { Text } = Typography;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

/* ---- Fluent 2 统计卡配色 ---- */
const STAT_STYLES: Record<string, { gradient: string; icon: string; accent: string }> = {
  total:   { gradient: 'linear-gradient(135deg, #deecf9 0%, #f0f6fc 100%)', icon: '#0078d4', accent: '#0078d4' },
  printed: { gradient: 'linear-gradient(135deg, #dff6dd 0%, #ecf9eb 100%)', icon: '#107c10', accent: '#107c10' },
  pending: { gradient: 'linear-gradient(135deg, #fff4ce 0%, #fff9e6 100%)', icon: '#ff8c00', accent: '#ff8c00' },
  inner:   { gradient: 'linear-gradient(135deg, #e0f2ff 0%, #ecf7ff 100%)', icon: '#0078d4', accent: '#0078d4' },
  outer:   { gradient: 'linear-gradient(135deg, #f0e6ff 0%, #f5f0ff 100%)', icon: '#8764b8', accent: '#8764b8' },
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
      // 并行加载：统计用 SQL COUNT，最近列表用 LIMIT 8
      const [statsResult, recentResult] = await Promise.all([
        window.electronAPI.getBoxLabelStats(),
        window.electronAPI.getBoxLabels({ limit: 8 }),
      ]);
      setStats(statsResult);
      setRecentLabels(recentResult);
    } catch (err) {
      console.error('加载失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const todayCount = useMemo(() => {
    const today = new Date().toLocaleDateString();
    return recentLabels.filter((l) => {
      const d = l.created_at?.split(' ')[0];
      return d === today || new Date(l.created_at).toLocaleDateString() === today;
    }).length;
  }, [recentLabels]);

  const completionRate = stats.total > 0 ? Math.round((stats.printed / stats.total) * 100) : 0;

  /* ---- 表格列 ---- */
  const columns = [
    {
      title: '箱号',
      dataIndex: 'box_number',
      key: 'box_number',
      width: 150,
      render: (val: string) => (
        <Text
          code
          strong
          style={{
            fontSize: 12,
            color: '#0078d4',
            background: '#deecf9',
            border: 'none',
            padding: '2px 8px',
            borderRadius: 4,
          }}
        >
          {val}
        </Text>
      ),
    },
    {
      title: '箱型',
      dataIndex: 'box_type',
      key: 'box_type',
      width: 56,
      render: (val: BoxType) => (
        <Tag
          color={val === 'inner' ? 'blue' : 'purple'}
          style={{ borderRadius: 4, fontSize: 11, lineHeight: '18px', margin: 0 }}
        >
          {BOX_TYPE_LABELS[val]}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 68,
      render: (s: string) =>
        s === 'printed' ? (
          <Tag color="success" style={{ borderRadius: 4, margin: 0 }}>
            已打印
          </Tag>
        ) : (
          <Tag color="warning" className="fluent-pulse" style={{ borderRadius: 4, margin: 0 }}>
            待打印
          </Tag>
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 130,
      render: (val: string) => {
        const short = val?.length > 10 ? val.slice(0, 10) : val;
        return <span style={{ color: '#605e5c', fontSize: 12 }}>{short}</span>;
      },
    },
  ];

  /* ---- 统计卡片数据 ---- */
  const statCards = [
    { key: 'total', icon: <FileTextOutlined />, title: '箱牌总数', value: stats.total, suffix: '个' },
    { key: 'printed', icon: <CheckCircleOutlined />, title: '已打印', value: stats.printed, suffix: stats.total > 0 ? `/${stats.total}` : '' },
    { key: 'pending', icon: <ClockCircleOutlined />, title: '待打印', value: stats.pending, suffix: '个' },
    { key: 'inner', icon: <InboxOutlined />, title: '内箱', value: stats.inner, suffix: '个' },
    { key: 'outer', icon: <SnippetsOutlined />, title: '外箱', value: stats.outer, suffix: '个' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* ==============================================================
          Fluent 2 欢迎横幅 — 渐变亚克力
          ============================================================== */}
      <div
        className="fluent-card"
        style={{
          padding: '28px 32px',
          marginBottom: 20,
          position: 'relative',
          overflow: 'hidden',
          background:
            'linear-gradient(135deg, rgba(0,120,212,0.92) 0%, rgba(0,90,158,0.92) 50%, rgba(0,60,120,0.92) 100%)',
          backdropFilter: 'blur(24px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        {/* 装饰光晕 */}
        <div
          style={{
            position: 'absolute',
            top: -60,
            right: -40,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            right: 60,
            width: 260,
            height: 260,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
            pointerEvents: 'none',
          }}
        />

        <Row align="middle" justify="space-between" wrap>
          <Col>
            <Space direction="vertical" size={4}>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.92)',
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                }}
              >
                {getGreeting()}！
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 400 }}>
                今天是{' '}
                {new Date().toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })}
              </Text>
            </Space>
          </Col>
          <Col style={{ marginTop: 8 }}>
            <Space size={24}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 2, fontWeight: 500 }}>
                  今日新增
                </div>
                <div className="fluent-count" style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>
                  {todayCount}
                </div>
              </div>
              <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.15)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 2, fontWeight: 500 }}>
                  完成率
                </div>
                <div className="fluent-count" style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>
                  {completionRate}%
                </div>
              </div>
              <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.15)' }} />
              <Button
                icon={<ReloadOutlined />}
                onClick={loadData}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  borderRadius: 6,
                  height: 32,
                  boxShadow: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.18)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }}
              >
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* ==============================================================
          Fluent 2 统计卡片（flex 等分，无右侧空白）
          ============================================================== */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {statCards.map((card) => {
          const s = STAT_STYLES[card.key];
          const barRatio =
            card.key === 'printed'
              ? stats.total > 0
                ? stats.printed / stats.total
                : 0
              : card.key === 'pending'
              ? stats.total > 0
                ? stats.pending / stats.total
                : 0
              : null;
          return (
            <div
              key={card.key}
              style={{ flex: '1 1 0%', minWidth: 140, display: 'flex' }}
            >
              <div
                className="hover-lift"
                style={{
                  background: s.gradient,
                  borderRadius: 14,
                  padding: '18px 16px',
                  border: '1px solid rgba(255,255,255,0.6)',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'default',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flex: 1 }}>
                  <div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: '#605e5c',
                        marginBottom: 4,
                        fontWeight: 500,
                        letterSpacing: 0.2,
                      }}
                    >
                      {card.title}
                    </div>
                    <div
                      className="fluent-stat"
                      style={{ color: s.accent }}
                    >
                      {card.value}
                    </div>
                    <div style={{ fontSize: 11, color: '#8a8886', marginTop: 1 }}>{card.suffix}</div>
                  </div>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      background: s.icon,
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      opacity: 0.12,
                      fontSize: 20,
                      color: '#fff',
                    }}
                  >
                    {card.icon}
                  </div>
                </div>
                {/* 进度条或占位 — 保证所有卡片高度一致 */}
                {barRatio !== null ? (
                  <div className="fluent-progress-mini">
                    <div
                      className="fluent-progress-mini-bar"
                      style={{
                        width: `${barRatio * 100}%`,
                        background: card.key === 'printed' ? '#107c10' : '#ff8c00',
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ height: 13 }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ==============================================================
          Fluent 2 最近箱牌 & 数据概览（同一行，更紧凑）
          ============================================================== */}
      <Row gutter={[14, 14]} style={{ marginTop: 14 }}>
        {/* 左侧：最近箱牌表格 */}
        <Col xs={24} lg={14} style={{ display: 'flex' }}>
          <Card
            title={
              <Space>
                <div
                  style={{
                    width: 3,
                    height: 18,
                    background: 'linear-gradient(180deg, #0078d4, #60cdff)',
                    borderRadius: 2,
                  }}
                />
                <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1f' }}>最近创建的箱牌</span>
                <Tag style={{ borderRadius: 4, fontSize: 11, lineHeight: '20px', margin: 0 }}>{recentLabels.length}</Tag>
              </Space>
            }
            style={{
              width: '100%',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.6)',
              background: 'rgba(255,255,255,0.8)',
              backdropFilter: 'blur(20px) saturate(1.2)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
            }}
            styles={{ body: { padding: 0 } }}
            extra={
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/list')}
                style={{ fontSize: 13, color: '#0078d4' }}
              >
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
            onRow={() => ({
              style: { cursor: 'pointer', transition: 'background 0.15s' },
              onMouseEnter: (e: any) => {
                if (e?.currentTarget) e.currentTarget.style.background = '#f0f6fc';
              },
              onMouseLeave: (e: any) => {
                if (e?.currentTarget) e.currentTarget.style.background = '';
              },
            })}
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
        ) : (
          <div style={{ padding: '48px 0' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" size={12}>
                  <Text style={{ color: '#8a8886' }}>还没有创建任何箱牌</Text>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => navigate('/create')}
                    style={{ borderRadius: 6, height: 34 }}
                  >
                    创建第一个箱牌
                  </Button>
                </Space>
              }
            />
          </div>
        )}
      </Card>

        </Col>

        {/* 右侧：数据概览 */}
        <Col xs={24} lg={10} style={{ display: 'flex' }}>
          <div className="fluent-card" style={{ padding: '20px 24px', width: '100%' }}>
            <div className="fluent-section-title" style={{ marginBottom: 14 }}>
              数据概览
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                { label: '总箱牌数', value: stats.total, color: '#0078d4' },
                { label: '已打印', value: stats.printed, color: '#107c10' },
                { label: '待打印', value: stats.pending, color: '#ff8c00' },
                { label: '内箱', value: stats.inner, color: '#0078d4' },
                { label: '外箱', value: stats.outer, color: '#8764b8' },
              ].map((item) => (
                <div key={item.label} className="fluent-data-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`fluent-dot`} style={{ background: item.color, boxShadow: `0 0 0 2px ${item.color}20` }} />
                    <span style={{ fontSize: 13, color: '#605e5c' }}>{item.label}</span>
                  </div>
                  <Text strong style={{ fontSize: 14, color: item.color }}>
                    {item.value}
                  </Text>
                </div>
              ))}
            </div>
          </div>
        </Col>
      </Row>

      {/* ---- 底部 ---- */}
      <div
        style={{
          textAlign: 'center',
          padding: '16px 0 8px',
          color: '#c8c6c4',
          fontSize: 11,
          letterSpacing: 0.3,
        }}
      >
        箱牌打印管理系统 · 数据实时更新
      </div>
    </div>
  );
}
