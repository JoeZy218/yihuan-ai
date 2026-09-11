import React from 'react';
import { TeamData } from '../types';

const elementColors: Record<string, string> = {
  '冰': '#7ec8e3', '火': '#e87461', '风': '#7dcea0',
  '雷': '#c39bdb', '岩': '#d4a574', '光': '#f7dc6f',
  '暗': '#7d669e', '水': '#5dade2',
};

const roleColors: Record<string, string> = {
  '主C': '#e74c3c', '副C': '#f39c12', '辅助': '#2ecc71', '生存': '#3498db',
};

interface TeamCardProps {
  data: TeamData;
}

const TeamCard: React.FC<TeamCardProps> = ({ data }) => {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: 20,
      margin: '8px 0',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      border: '1px solid #e8e8e8',
    }}>
      <h3 style={{ margin: '0 0 16px 0', color: '#1a1a2e', fontSize: 16 }}>
        配队推荐方案
      </h3>

      {/* 队伍成员 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}>
        {data.team.map((member, idx) => (
          <div key={idx} style={{
            background: '#f8f9fa',
            borderRadius: 10,
            padding: 12,
            textAlign: 'center',
            border: '1px solid #e8e8e8',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: elementColors[member.name] || '#ccc',
              margin: '0 auto 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 'bold',
              color: '#fff',
            }}>
              {member.name[0]}
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
              {member.name}
            </div>
            <span style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 600,
              background: roleColors[member.role] || '#999',
              color: '#fff',
            }}>
              {member.role}
            </span>
            <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
              {member.reason}
            </div>
          </div>
        ))}
      </div>

      {/* 技能循环 */}
      <div style={{
        background: '#f0f4ff',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        fontSize: 13,
        lineHeight: 1.6,
      }}>
        <strong style={{ color: '#667eea' }}>技能循环：</strong>
        {data.rotation}
      </div>

      {/* 替代方案 */}
      {data.alternatives.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <strong style={{ fontSize: 13, color: '#1a1a2e' }}>替代方案：</strong>
          {data.alternatives.map((alt, idx) => (
            <div key={idx} style={{
              fontSize: 13,
              padding: '6px 0',
              borderBottom: '1px solid #f0f0f0',
            }}>
              <span style={{ color: '#e74c3c' }}>{alt.original}</span>
              {' → '}
              <span style={{ color: '#2ecc71' }}>{alt.alternative}</span>
              {'：'}{alt.reason}
            </div>
          ))}
        </div>
      )}

      {/* 推荐理由 */}
      <div style={{
        fontSize: 13,
        color: '#555',
        lineHeight: 1.6,
        padding: 10,
        background: '#fffbe6',
        borderRadius: 8,
        border: '1px solid #ffe58f',
      }}>
        <strong>推荐理由：</strong>{data.summary}
      </div>
    </div>
  );
};

export default TeamCard;