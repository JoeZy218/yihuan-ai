import React from 'react';
import { ArcDiskData } from '../types';

interface ArcDiskCardProps {
  data: ArcDiskData;
}

const ArcDiskCard: React.FC<ArcDiskCardProps> = ({ data }) => {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: 20,
      margin: '8px 0',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      border: '1px solid #e8e8e8',
    }}>
      <h3 style={{ margin: '0 0 4px 0', color: '#1a1a2e', fontSize: 16 }}>
        {data.character} 配装推荐
      </h3>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        {data.element}元素 · {data.role}
      </div>

      {/* AI分析总结 */}
      {data.ai_analysis && (
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 10,
          padding: 16,
          color: '#fff',
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <span style={{
              background: '#ffd700',
              color: '#1a1a2e',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              marginRight: 8,
            }}>
              AI分析
            </span>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            {data.ai_analysis}
          </div>
        </div>
      )}

      {/* 弧盘（专武） */}
      <div style={{
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        borderRadius: 10,
        padding: 16,
        color: '#fff',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <span style={{
            background: '#ffd700',
            color: '#1a1a2e',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            marginRight: 8,
          }}>
            专武
          </span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{data.arcdisk.name}</span>
        </div>

        <div style={{ fontSize: 12, marginBottom: 6 }}>
          <span style={{ marginRight: 12 }}>{data.arcdisk.element}元素</span>
          <span style={{ marginRight: 12 }}>{data.arcdisk.rarity}</span>
        </div>

        <div style={{ fontSize: 13, marginBottom: 6 }}>
          属性: {data.arcdisk.main_attr || '-'}
        </div>

        <div style={{
          fontSize: 12,
          padding: '8px 10px',
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 6,
        }}>
          <strong>效果「{data.arcdisk.effect}」：</strong>{data.arcdisk.effect_desc}
        </div>
      </div>

      {/* 卡带 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 10,
        padding: 16,
        color: '#fff',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <span style={{
            background: '#00d9ff',
            color: '#1a1a2e',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            marginRight: 8,
          }}>
            卡带
          </span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{data.set.name}</span>
        </div>

        <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
          <div><strong>2件套：</strong>{data.set.set2}</div>
          <div><strong>4件套：</strong>{data.set.set4}</div>
        </div>

        <div style={{ fontSize: 12, marginBottom: 8 }}>
          <strong>主属性推荐：</strong>
          {Object.entries(data.set.main_stats).map(([pos, stat]) => {
            // 将 position_1 转换为 1号位
            const posLabel = pos.replace('position_', '') + '号位';
            return (
              <span key={pos} style={{
                display: 'inline-block',
                padding: '1px 6px',
                margin: '2px 3px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: 4,
              }}>
                {posLabel}：{stat}
              </span>
            );
          })}
        </div>

        <div style={{ fontSize: 12, marginBottom: 8 }}>
          <strong>副词条优先级：</strong>
          {data.set.sub_priority.join(' > ')}
        </div>

        {data.set.reason && (
          <div style={{
            fontSize: 12,
            padding: '8px 10px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 6,
          }}>
            <strong>选择理由：</strong>{data.set.reason}
          </div>
        )}
      </div>

      {/* 备选卡带 */}
      {data.alternatives && data.alternatives.map((alt, idx) => (
        <div key={idx} style={{
          background: '#f8f9fa',
          borderRadius: 10,
          padding: 14,
          marginBottom: 8,
          border: '1px solid #e8e8e8',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <span style={{
              background: '#95a5a6',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              marginRight: 8,
            }}>
              备选{idx + 1}
            </span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{alt.name}</span>
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: '#555' }}>
            <div><strong>2件套：</strong>{alt.set2}</div>
            <div><strong>4件套：</strong>{alt.set4}</div>
          </div>
          {alt.main_stats && Object.keys(alt.main_stats).length > 0 && (
            <div style={{ fontSize: 12, marginTop: 6, color: '#555' }}>
              <strong>主属性推荐：</strong>
              {Object.entries(alt.main_stats).map(([pos, stat]) => {
                const posLabel = pos.replace('position_', '') + '号位';
                return (
                  <span key={pos} style={{
                    display: 'inline-block',
                    padding: '1px 6px',
                    margin: '2px 3px',
                    background: '#e8e8e8',
                    borderRadius: 4,
                  }}>
                    {posLabel}：{stat}
                  </span>
                );
              })}
            </div>
          )}
          {alt.sub_priority && alt.sub_priority.length > 0 && (
            <div style={{ fontSize: 12, marginTop: 4, color: '#555' }}>
              <strong>副词条优先级：</strong>{alt.sub_priority.join(' > ')}
            </div>
          )}
          {alt.reason && <div style={{ marginTop: 6, fontSize: 12, color: '#888', fontStyle: 'italic' }}>{alt.reason}</div>}
        </div>
      ))}
    </div>
  );
};

export default ArcDiskCard;
