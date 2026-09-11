import React, { useState } from 'react';
import { MaterialsData, MaterialItem } from '../types';

interface MaterialTableProps {
  data: MaterialsData;
}

const SKILL_LABELS: Record<string, string> = {
  normal: '普攻',
  skill: '战技',
  ultimate: '大招'
};

const MaterialTable: React.FC<MaterialTableProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'total' | 'ascension' | 'exp' | 'skills'>('total');

  const tabs = [
    { key: 'total', label: '材料汇总' },
    { key: 'ascension', label: '突破材料' },
    { key: 'exp', label: '经验书' },
    { key: 'skills', label: '技能材料' },
  ] as const;

  const renderMaterialRow = (mat: MaterialItem, idx: number) => (
    <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
      <td style={{ padding: '8px 12px' }}>
        <span style={{ marginRight: 8 }}>{mat.count > 0 ? '📦' : '✅'}</span>
        {mat.name}
      </td>
      <td style={{
        padding: '8px 12px',
        textAlign: 'center',
        fontWeight: 600,
        color: mat.count > 0 ? '#e74c3c' : '#27ae60',
      }}>
        {mat.count > 0 ? mat.count : '—'}
      </td>
      <td style={{ padding: '8px 12px', color: '#666', fontSize: 12 }}>
        {mat.source}
      </td>
    </tr>
  );

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
        {data.character} 养成材料清单
      </h3>

      <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
        元素：{data.element} | 稀有度：{data.rarity} | 
        等级：{data.ascension.from} → {data.ascension.to}
      </div>

      {/* 技能等级概览 */}
      <div style={{ marginBottom: 16, fontSize: 13 }}>
        {Object.entries(data.skills).map(([name, skill]) => (
          <span key={name} style={{
            display: 'inline-block',
            padding: '4px 10px',
            margin: '2px 4px',
            background: skill.from < skill.to ? '#fff3cd' : '#f0f4ff',
            borderRadius: 6,
            fontSize: 12,
          }}>
            {SKILL_LABELS[name] || name}：{skill.from} → {skill.to}
          </span>
        ))}
      </div>

      {/* 标签页导航 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '2px solid #e8e8e8' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '6px 14px',
              border: 'none',
              background: 'none',
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? '#1a1a2e' : '#999',
              borderBottom: activeTab === tab.key ? '2px solid #1a1a2e' : '2px solid transparent',
              marginBottom: -2,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 材料汇总表 */}
      {activeTab === 'total' && (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{
            width: '100%',
            minWidth: 320,
            borderCollapse: 'collapse',
            fontSize: 13,
          }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e8e8e8' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>材料名称</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: 80 }}>数量</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>获取途径</th>
              </tr>
            </thead>
            <tbody>
              {data.total_materials.map((mat, idx) => renderMaterialRow(mat, idx))}
            </tbody>
          </table>
        </div>
      )}

      {/* 突破材料 */}
      {activeTab === 'ascension' && (
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
            每10级突破一次，消耗对应属性的T1~T4材料
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{
              width: '100%',
              minWidth: 320,
              borderCollapse: 'collapse',
              fontSize: 13,
            }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e8e8e8' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>材料名称</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: 80 }}>数量</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>获取途径</th>
              </tr>
            </thead>
            <tbody>
              {data.ascension.materials.length > 0 ? (
                data.ascension.materials.map((mat, idx) => renderMaterialRow(mat, idx))
              ) : (
                <tr><td colSpan={3} style={{ padding: 16, textAlign: 'center', color: '#999' }}>无需突破材料</td></tr>
              )}
            </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 经验书 */}
      {activeTab === 'exp' && (
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
            升级消耗经验书，等级越高需要越高阶的经验书
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{
              width: '100%',
              minWidth: 320,
              borderCollapse: 'collapse',
              fontSize: 13,
            }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e8e8e8' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>材料名称</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: 80 }}>数量</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>获取途径</th>
              </tr>
            </thead>
            <tbody>
              {data.exp_books && data.exp_books.length > 0 ? (
                data.exp_books.map((mat, idx) => renderMaterialRow(mat, idx))
              ) : (
                <tr><td colSpan={3} style={{ padding: 16, textAlign: 'center', color: '#999' }}>无需经验书</td></tr>
              )}
            </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 技能材料 */}
      {activeTab === 'skills' && (
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
            普攻/战技/大招升级消耗对应属性技能材料，8-10级额外消耗周本材料
          </div>
          {Object.entries(data.skills).map(([name, skill]) => (
            <div key={name} style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#1a1a2e' }}>
                {SKILL_LABELS[name] || name}（{skill.from} → {skill.to}）
              </h4>
              {skill.materials.length > 0 ? (
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{
                    width: '100%',
                    minWidth: 320,
                    borderCollapse: 'collapse',
                    fontSize: 13,
                  }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e8e8e8' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>材料名称</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: 80 }}>数量</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>获取途径</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skill.materials.map((mat, idx) => renderMaterialRow(mat, idx))}
                  </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 8, color: '#999', fontSize: 13 }}>无需升级</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 养成优先级 */}
      {data.priority.length > 0 && (
        <div style={{
          marginTop: 16,
          padding: 12,
          background: '#fffbe6',
          borderRadius: 8,
          border: '1px solid #ffe58f',
          fontSize: 13,
        }}>
          <strong style={{ color: '#1a1a2e' }}>养成优先级建议：</strong>
          {data.priority.map((p, idx) => (
            <div key={idx} style={{ marginTop: 4, color: '#555' }}>
              {p}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MaterialTable;