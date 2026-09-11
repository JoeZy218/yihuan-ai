import React, { useState, useEffect } from 'react';
import { getPieChartData, getFavoriteCharacter, resetStats } from '../api';

interface StatsData {
  labels: string[];
  values: number[];
  viewCounts: number[];
  queryCounts: number[];
}

interface Slice {
  label: string;
  value: number;
  viewCount: number;
  queryCount: number;
  percent: number;
  color: string;
  startAngle: number;
  endAngle: number;
}

const CharacterStatsChart: React.FC = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [favorite, setFavorite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pieData, favData] = await Promise.all([
        getPieChartData(),
        getFavoriteCharacter(),
      ]);
      setStats(pieData);
      setFavorite(favData);
    } catch (err) {
      console.error('加载统计数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetStats = async () => {
    if (!confirm('确定要重置所有统计数据吗？此操作不可恢复。')) {
      return;
    }
    try {
      await resetStats();
      setStats(null);
      setFavorite(null);
      alert('统计数据已重置');
    } catch (err) {
      console.error('重置统计数据失败:', err);
      alert('重置失败，请稍后重试');
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>;
  }

  if (!stats || stats.labels.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <div>暂无统计数据</div>
        <div style={{ fontSize: 12, marginTop: 8 }}>点击角色图鉴或向AI查询角色来生成统计</div>
      </div>
    );
  }

  const total = stats.values.reduce((sum, val) => sum + val, 0);
  const colors = [
    '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe',
    '#43e97b', '#fa709a', '#fee140', '#30cfd0', '#a8edea'
  ];

  // 生成饼图数据
  let currentAngle = 0;
  const slices: Slice[] = stats.labels.map((label, i) => {
    const percent = (stats.values[i] / total) * 100;
    const angle = (stats.values[i] / total) * 360;
    const slice: Slice = {
      label,
      value: stats.values[i],
      viewCount: stats.viewCounts[i],
      queryCount: stats.queryCounts[i],
      percent,
      color: colors[i % colors.length],
      startAngle: currentAngle,
      endAngle: currentAngle + angle,
    };
    currentAngle += angle;
    return slice;
  });

  // SVG饼图函数
  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} L ${x} ${y} Z`;
  };

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  return (
    <div style={{ padding: 24 }}>
      {/* 最喜好角色展示 */}
      {favorite && favorite.character_name && (
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 12,
          padding: '20px 24px',
          marginBottom: 24,
          color: '#fff',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
        }}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>🏆 您的最喜好角色</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              fontSize: 48,
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '50%',
              width: 80,
              height: 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              ⭐
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{favorite.character_name}</div>
              <div style={{ fontSize: 14, opacity: 0.9 }}>
                总互动次数：{favorite.total_count} 次
              </div>
            </div>
          </div>
          <div style={{
            marginTop: 16,
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 8,
            fontSize: 13,
          }}>
            💡 AI助手将会以 <strong>{favorite.character_name}</strong> 为核心为您推荐角色和配队方案
          </div>
        </div>
      )}

      {/* 交互式饼图 */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
            角色互动统计
          </h3>
          <button
            onClick={handleResetStats}
            style={{
              padding: '6px 14px',
              background: '#dc3545',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            重置统计
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {/* SVG饼图 */}
          <div style={{ position: 'relative' }}>
            <svg width="320" height="320" viewBox="0 0 320 320" style={{ overflow: 'visible' }}>
              {/* 阴影效果 */}
              <defs>
                <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                  <feOffset dx="2" dy="2" result="offsetblur"/>
                  <feComponentTransfer>
                    <feFuncA type="linear" slope="0.3"/>
                  </feComponentTransfer>
                  <feMerge>
                    <feMergeNode/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              {/* 饼图扇形 */}
              {slices.map((slice, i) => {
                const isHovered = hoveredSlice === i;
                const radius = isHovered ? 150 : 140;
                const midAngle = (slice.startAngle + slice.endAngle) / 2;
                const offset = isHovered ? 10 : 0;
                const offsetRad = (midAngle - 90) * Math.PI / 180;
                const offsetX = offset * Math.cos(offsetRad);
                const offsetY = offset * Math.sin(offsetRad);
                
                return (
                  <g key={i} 
                    onMouseEnter={() => setHoveredSlice(i)}
                    onMouseLeave={() => setHoveredSlice(null)}
                    style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                  >
                    <path
                      d={describeArc(160 + offsetX, 160 + offsetY, radius, slice.startAngle, slice.endAngle)}
                      fill={slice.color}
                      stroke="#fff"
                      strokeWidth="2"
                      filter="url(#shadow)"
                      style={{
                        opacity: hoveredSlice !== null && !isHovered ? 0.6 : 1,
                        transition: 'all 0.3s ease',
                      }}
                    />
                    {/* 百分比标签 */}
                    {slice.percent > 5 && (
                      <text
                        x={160 + offsetX + (radius * 0.7 * Math.cos((midAngle - 90) * Math.PI / 180))}
                        y={160 + offsetY + (radius * 0.7 * Math.sin((midAngle - 90) * Math.PI / 180))}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#fff"
                        fontSize={isHovered ? '16' : '13'}
                        fontWeight="bold"
                        style={{ pointerEvents: 'none', transition: 'all 0.3s ease' }}
                      >
                        {slice.percent.toFixed(1)}%
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            
            {/* 悬停提示框 */}
            {hoveredSlice !== null && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'rgba(0,0,0,0.85)',
                color: '#fff',
                padding: '12px 16px',
                borderRadius: 8,
                fontSize: 13,
                pointerEvents: 'none',
                zIndex: 100,
                minWidth: 180,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: slices[hoveredSlice].color }}>
                  {slices[hoveredSlice].label}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>📖 词条访问：</span>
                  <span style={{ fontWeight: 600 }}>{slices[hoveredSlice].viewCount} 次</span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px solid rgba(255,255,255,0.2)',
                  fontSize: 15,
                  fontWeight: 700,
                }}>
                  <span>占比：</span>
                  <span>{slices[hoveredSlice].percent.toFixed(1)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 详细数据表 */}
      <div>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>
          详细统计
        </h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>角色</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>词条访问</th>
              </tr>
            </thead>
            <tbody>
              {slices.map((slice, i) => (
                <tr 
                  key={i} 
                  style={{ 
                    background: i % 2 === 0 ? '#fff' : '#f8f9fa',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={() => setHoveredSlice(i)}
                  onMouseLeave={() => setHoveredSlice(null)}
                >
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #dee2e6', fontWeight: 600, color: '#1a1a2e' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: slice.color,
                        flexShrink: 0,
                      }} />
                      {slice.label}
                    </div>
                  </td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #dee2e6', textAlign: 'right', color: '#667eea', fontWeight: 600 }}>
                    {slice.viewCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CharacterStatsChart;
