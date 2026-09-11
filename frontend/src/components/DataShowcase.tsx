import React, { useState, useEffect } from 'react';
import { logCharacterView } from '../api';

interface Character {
  id: string;
  name: string;
  element: string;
  role: string;
  rarity: string;
  skills: { normal: string; skill: string; ultimate: string };
  best_arcdisk: string;
  best_set: string;
  synergy: string[];
  picture?: string;
}

interface KnowledgeEntry {
  id: number;
  title: string;
  content: string;
  keywords: string[];
}

interface ArcDisk {
  id: string;
  name: string;
  element: string;
  rarity: string;
  effect: string;
  effect_desc: string;
  suitable: string[];
  source: string;
  picture?: string;
}

interface SetItem {
  id: string;
  name: string;
  set2: string;
  set4: string;
  main_attr: string;
  sub_attr: string[];
  suitable: string[];
  picture?: string;
}

interface MaterialItem {
  id: string;
  name: string;
  type: string;
  tier: number;
  source: string;
  source_type: string;
  element: string;
  picture?: string;
}

const elementColors: Record<string, string> = {
  '光': '#f5a623', '灵': '#9b59b6', '咒': '#e74c3c',
  '暗': '#34495e', '魂': '#27ae60', '相': '#3498db',
};

const elementBgColors: Record<string, string> = {
  '光': 'linear-gradient(135deg, #f5a623 0%, #f7d794 100%)',
  '灵': 'linear-gradient(135deg, #9b59b6 0%, #d2b4de 100%)',
  '咒': 'linear-gradient(135deg, #e74c3c 0%, #f1948a 100%)',
  '暗': 'linear-gradient(135deg, #2c3e50 0%, #5d6d7e 100%)',
  '魂': 'linear-gradient(135deg, #27ae60 0%, #82e0aa 100%)',
  '相': 'linear-gradient(135deg, #3498db 0%, #85c1e9 100%)',
};

const rarityBorders: Record<string, string> = {
  'S': '#ff9800', 'A': '#9c27b0', 'B': '#607d8b',
};

const roleIcons: Record<string, string> = {
  '主C': '⚔️', '副C': '🗡️', '辅助': '💫', '生存': '🛡️',
};

// 角色头像图片（来源：Bilibili Wiki）
const characterAvatars: Record<string, string> = {
  '九原': 'https://patchwiki.biligame.com/images/yh/0/09/rah39z9oyzcnovtf74rt298siv83f3j.png',
  '哈索尔': 'https://patchwiki.biligame.com/images/yh/1/15/snlmvqbdclan312cg4hqko1r6gzjqea.png',
  '娜娜莉': 'https://patchwiki.biligame.com/images/yh/c/c3/8oir3jfn584h0zh775iql0bohfc56tt.png',
  '安魂曲': 'https://patchwiki.biligame.com/images/yh/d/d6/svbtyw3lo908ztuwz6ffh4ab2vyqfnr.png',
  '小吱': 'https://patchwiki.biligame.com/images/yh/3/35/ipme2ponysrtq62cs0p1yl1aw9z0h8t.png',
  '异能者·零': 'https://patchwiki.biligame.com/images/yh/8/85/auyvpe0ekqxmxxnewyjp67qwdb9gwlj.png',
  '早雾': 'https://patchwiki.biligame.com/images/yh/f/fc/emv8y40kj53273nwimccilvvqnk37t7.png',
  '法帝娅': 'https://patchwiki.biligame.com/images/yh/b/b9/ech2yrngjpf4hcynz4bzmfma179j5mk.png',
  '浔': 'https://patchwiki.biligame.com/images/yh/a/aa/r81bdrgl44rc8c0stchwube8gokl6za.png',
  '白藏': 'https://patchwiki.biligame.com/images/yh/0/0d/chndpw06zj4h1ab9hpylm07ui2kxm97.png',
  '达芙蒂尔': 'https://patchwiki.biligame.com/images/yh/5/57/8cyvizzuzjvnqpofikrd5641293e2jc.png',
  '哈尼娅': 'https://patchwiki.biligame.com/images/yh/d/dc/02osd16ivxwlz43vvaogtv3p2zk8gkx.png',
  '埃德嘉': 'https://patchwiki.biligame.com/images/yh/c/ce/9cd29mhpdmhgk2j5e9ivdrk7ysjtf53.png',
  '海月': 'https://patchwiki.biligame.com/images/yh/d/d9/0j6ozyw5v22iszr8m3jpgyhqigod7bk.png',
  '翳': 'https://patchwiki.biligame.com/images/yh/6/63/fuod207lk311swr0sjx9wffyn08ky37.png',
  '薄荷': 'https://patchwiki.biligame.com/images/yh/0/0a/7t6vp54molwgulzn9005d9fgfblp0t1.png',
  '阿德勒': 'https://patchwiki.biligame.com/images/yh/b/b6/74a8avaslusbu49c9kekaktt70bw9gk.png',
};

const DataShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState('characters');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [arcdisks, setArcdisks] = useState<ArcDisk[]>([]);
  const [sets, setSets] = useState<SetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [selectedDisk, setSelectedDisk] = useState<ArcDisk | null>(null);
  const [selectedSet, setSelectedSet] = useState<SetItem | null>(null);
  const [expandedKnowledge, setExpandedKnowledge] = useState<number | null>(null);

  // Filters
  const [filterElement, setFilterElement] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterRarity, setFilterRarity] = useState<string>('all');

  useEffect(() => { loadAllData(); }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [charRes, arcRes, setRes, matRes, kbRes] = await Promise.all([
        fetch('/api/admin/characters'),
        fetch('/api/admin/arcdisks'),
        fetch('/api/admin/sets'),
        fetch('/api/admin/materials'),
        fetch('/api/admin/knowledge'),
      ]);
      setCharacters(await charRes.json());
      setArcdisks(await arcRes.json());
      setSets(await setRes.json());
      setMaterials(await matRes.json());
      setKnowledge(await kbRes.json());
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredChars = characters.filter(c => {
    if (filterElement !== 'all' && c.element !== filterElement) return false;
    if (filterRole !== 'all' && c.role !== filterRole) return false;
    if (filterRarity !== 'all' && c.rarity !== filterRarity) return false;
    return true;
  });

  const filteredDisks = arcdisks.filter(d => {
    if (filterElement !== 'all' && d.element !== filterElement) return false;
    return true;
  });

  const elements = [...new Set(characters.map(c => c.element))];
  const roles = [...new Set(characters.map(c => c.role))];
  const rarities = [...new Set(characters.map(c => c.rarity))];

  const tabs = [
    { key: 'characters', label: '角色图鉴', icon: '👤' },
    { key: 'arcdisks', label: '弧盘图鉴', icon: '💎' },
    { key: 'sets', label: '卡带图鉴', icon: '🎯' },
    { key: 'materials', label: '材料图鉴', icon: '📦' },
    { key: 'knowledge', label: '攻略百科', icon: '📚' },
  ];

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Wiki风格顶部导航 */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderRadius: 12,
        padding: '4px',
        marginBottom: 20,
        display: 'flex',
        gap: 2,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelectedChar(null); setSelectedDisk(null); setSelectedSet(null); }}
            style={{
              flex: 1,
              padding: '10px 8px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === tab.key ? 'rgba(102, 126, 234, 0.4)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 700 : 400,
              transition: 'all 0.2s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          加载图鉴数据中...
        </div>
      )}

      {/* ========== 角色图鉴 ========== */}
      {!loading && activeTab === 'characters' && !selectedChar && (
        <div>
          {/* 筛选栏 */}
          <div style={{
            background: '#fff', borderRadius: 10, padding: '12px 16px', marginBottom: 16,
            display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <span style={{ fontSize: 12, color: '#999', fontWeight: 600 }}>筛选</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <FilterBtn label="全部" active={filterElement === 'all'} onClick={() => setFilterElement('all')} />
              {elements.map(e => <FilterBtn key={e} label={e} active={filterElement === e} onClick={() => setFilterElement(e)} color={elementColors[e]} />)}
            </div>
            <div style={{ width: 1, height: 20, background: '#e8e8e8' }} />
            <div style={{ display: 'flex', gap: 4 }}>
              <FilterBtn label="全部" active={filterRole === 'all'} onClick={() => setFilterRole('all')} />
              {roles.map(r => <FilterBtn key={r} label={r} active={filterRole === r} onClick={() => setFilterRole(r)} />)}
            </div>
            <div style={{ width: 1, height: 20, background: '#e8e8e8' }} />
            <div style={{ display: 'flex', gap: 4 }}>
              <FilterBtn label="全部" active={filterRarity === 'all'} onClick={() => setFilterRarity('all')} />
              {rarities.map(r => <FilterBtn key={r} label={r} active={filterRarity === r} onClick={() => setFilterRarity(r)} color={rarityBorders[r]} />)}
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#999' }}>{filteredChars.length} / {characters.length}</span>
          </div>

          {/* 角色卡片网格 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {filteredChars.map(char => (
              <div
                key={char.id}
                onClick={() => { setSelectedChar(char); logCharacterView(char.name); }}
                style={{
                  cursor: 'pointer',
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: `2px solid ${rarityBorders[char.rarity] || '#ddd'}`,
                  background: '#fff',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)'; }}
              >
                {/* 角色头部 - 头像展示 */}
                <div style={{
                  background: elementBgColors[char.element] || 'linear-gradient(135deg, #667eea, #764ba2)',
                  height: 100,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {(char.picture || characterAvatars[char.name]) ? (
                    <img
                      src={char.picture || characterAvatars[char.name]}
                      alt={char.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
                    />
                  ) : (
                    <span style={{ fontSize: 32 }}>{roleIcons[char.role] || '👤'}</span>
                  )}
                  {/* 稀有度角标 */}
                  <span style={{
                    position: 'absolute', top: 4, right: 4,
                    background: 'rgba(0,0,0,0.6)', color: rarityBorders[char.rarity] || '#fff',
                    padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                  }}>{char.rarity}</span>
                  {/* 属性角标 */}
                  <span style={{
                    position: 'absolute', top: 4, left: 4,
                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                    padding: '1px 6px', borderRadius: 4, fontSize: 10,
                  }}>{char.element}</span>
                </div>
                {/* 角色名称 */}
                <div style={{ padding: '8px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{char.name}</div>
                  <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{char.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 角色详情面板 */}
      {!loading && activeTab === 'characters' && selectedChar && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          {/* 顶部横幅 */}
          <div style={{
            background: elementBgColors[selectedChar.element] || 'linear-gradient(135deg, #667eea, #764ba2)',
            padding: '24px 30px',
            color: '#fff',
            position: 'relative',
          }}>
            <button onClick={() => setSelectedChar(null)} style={{
              position: 'absolute', top: 12, left: 12,
              background: 'rgba(0,0,0,0.3)', color: '#fff', border: 'none',
              borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12,
            }}>← 返回列表</button>
            <div style={{ textAlign: 'center', paddingTop: 16 }}>
              {(selectedChar.picture || characterAvatars[selectedChar.name]) ? (
                <img src={selectedChar.picture || characterAvatars[selectedChar.name]} alt={selectedChar.name}
                  style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top', border: '3px solid rgba(255,255,255,0.5)', marginBottom: 8 }} />
              ) : (
                <div style={{ fontSize: 42, marginBottom: 8 }}>{roleIcons[selectedChar.role] || '👤'}</div>
              )}
              <h2 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 6px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>{selectedChar.name}</h2>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <span style={{ background: 'rgba(255,255,255,0.25)', padding: '3px 12px', borderRadius: 20, fontSize: 12 }}>{selectedChar.element}属性</span>
                <span style={{ background: 'rgba(255,255,255,0.25)', padding: '3px 12px', borderRadius: 20, fontSize: 12 }}>{selectedChar.role}</span>
                <span style={{ background: 'rgba(255,255,255,0.25)', padding: '3px 12px', borderRadius: 20, fontSize: 12 }}>{selectedChar.rarity}级</span>
              </div>
            </div>
          </div>
          {/* 详细信息 */}
          <div style={{ padding: '24px 30px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* 技能 */}
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 12, borderBottom: '2px solid #667eea', paddingBottom: 6 }}>技能信息</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <SkillRow label="普通攻击" desc={selectedChar.skills.normal} color="#3498db" />
                  <SkillRow label="战技" desc={selectedChar.skills.skill} color="#e67e22" />
                  <SkillRow label="终结技" desc={selectedChar.skills.ultimate} color="#e74c3c" />
                </div>
              </div>
              {/* 装备推荐 */}
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 12, borderBottom: '2px solid #764ba2', paddingBottom: 6 }}>装备推荐</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedChar.best_arcdisk && (
                    <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 12, borderLeft: '3px solid #667eea' }}>
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>推荐弧盘</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{selectedChar.best_arcdisk}</div>
                    </div>
                  )}
                  {selectedChar.best_set && (
                    <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 12, borderLeft: '3px solid #764ba2' }}>
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>推荐卡带</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{selectedChar.best_set}</div>
                    </div>
                  )}
                  {selectedChar.synergy && selectedChar.synergy.length > 0 && (
                    <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 12, borderLeft: '3px solid #27ae60' }}>
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>协同角色</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {selectedChar.synergy.map((s, i) => (
                          <span key={i} style={{ padding: '3px 10px', background: '#e8f8f5', borderRadius: 4, fontSize: 12, color: '#27ae60', fontWeight: 600 }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== 弧盘图鉴 ========== */}
      {!loading && activeTab === 'arcdisks' && !selectedDisk && (
        <div>
          {/* 筛选 */}
          <div style={{
            background: '#fff', borderRadius: 10, padding: '12px 16px', marginBottom: 16,
            display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <span style={{ fontSize: 12, color: '#999', fontWeight: 600 }}>属性筛选</span>
            <FilterBtn label="全部" active={filterElement === 'all'} onClick={() => setFilterElement('all')} />
            {[...new Set(arcdisks.map(d => d.element).filter(Boolean))].map(e => (
              <FilterBtn key={e} label={e} active={filterElement === e} onClick={() => setFilterElement(e)} color={elementColors[e]} />
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#999' }}>{filteredDisks.length} / {arcdisks.length}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {filteredDisks.map(disk => (
              <div
                key={disk.id}
                onClick={() => setSelectedDisk(disk)}
                style={{
                  cursor: 'pointer', borderRadius: 10, overflow: 'hidden',
                  border: `2px solid ${rarityBorders[disk.rarity] || '#ddd'}`,
                  background: '#fff', transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)'; }}
              >
                <div style={{
                  background: elementBgColors[disk.element] || 'linear-gradient(135deg, #667eea, #764ba2)',
                  height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', overflow: 'hidden',
                }}>
                  {disk.picture ? (
                    <img src={disk.picture} alt={disk.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
                  ) : (
                    <span style={{ fontSize: 26 }}>💎</span>
                  )}
                  <span style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '1px 6px', borderRadius: 4, fontSize: 9 }}>{disk.rarity}</span>
                  {disk.element && <span style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '1px 6px', borderRadius: 4, fontSize: 9 }}>{disk.element}</span>}
                </div>
                <div style={{ padding: '8px 8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{disk.name}</div>
                  <div style={{ fontSize: 10, color: '#999', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{disk.effect || ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 弧盘详情 */}
      {!loading && activeTab === 'arcdisks' && selectedDisk && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          <div style={{
            background: elementBgColors[selectedDisk.element] || 'linear-gradient(135deg, #667eea, #764ba2)',
            padding: '20px 30px', color: '#fff', position: 'relative',
          }}>
            <button onClick={() => setSelectedDisk(null)} style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.3)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>← 返回列表</button>
            <div style={{ textAlign: 'center', paddingTop: 10 }}>
              {selectedDisk.picture ? (
                <img src={selectedDisk.picture} alt={selectedDisk.name} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '2px solid rgba(255,255,255,0.4)', marginBottom: 6 }} />
              ) : (
                <div style={{ fontSize: 36, marginBottom: 6 }}>💎</div>
              )}
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px 0' }}>{selectedDisk.name}</h2>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <span style={{ background: 'rgba(255,255,255,0.25)', padding: '3px 12px', borderRadius: 20, fontSize: 12 }}>{selectedDisk.element}属性</span>
                <span style={{ background: 'rgba(255,255,255,0.25)', padding: '3px 12px', borderRadius: 20, fontSize: 12 }}>{selectedDisk.rarity}级</span>
              </div>
            </div>
          </div>
          <div style={{ padding: '24px 30px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <h4 style={{ fontSize: 14, color: '#1a1a2e', marginBottom: 10, borderBottom: '2px solid #667eea', paddingBottom: 6 }}>武器效果</h4>
                <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 6 }}>{selectedDisk.effect}</div>
                  <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7 }}>{selectedDisk.effect_desc}</div>
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: 14, color: '#1a1a2e', marginBottom: 10, borderBottom: '2px solid #764ba2', paddingBottom: 6 }}>获取与适用</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 12, borderLeft: '3px solid #e67e22' }}>
                    <div style={{ fontSize: 11, color: '#999' }}>获取途径</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginTop: 2 }}>{selectedDisk.source || '暂无'}</div>
                  </div>
                  {selectedDisk.suitable && selectedDisk.suitable.length > 0 && (
                    <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 12, borderLeft: '3px solid #27ae60' }}>
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>适用角色</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(Array.isArray(selectedDisk.suitable) ? selectedDisk.suitable : []).map((s, i) => (
                          <span key={i} style={{ padding: '3px 10px', background: '#e8f8f5', borderRadius: 4, fontSize: 12, color: '#27ae60', fontWeight: 600 }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== 卡带图鉴 ========== */}
      {!loading && activeTab === 'sets' && !selectedSet && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {sets.map(set => (
            <div
              key={set.id}
              onClick={() => setSelectedSet(set)}
              style={{
                cursor: 'pointer', background: '#fff', borderRadius: 10,
                overflow: 'hidden', border: '1px solid #e8e8e8',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)'; }}
            >
              <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)', padding: '14px 16px', color: '#fff' }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{set.name}</div>
              </div>
              <div style={{ padding: '12px 16px', fontSize: 12, lineHeight: 1.7 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '1px 6px', borderRadius: 3, fontWeight: 600, fontSize: 10, flexShrink: 0 }}>2件</span>
                  <span style={{ color: '#555' }}>{set.set2 || '-'}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ background: '#fff3e0', color: '#e65100', padding: '1px 6px', borderRadius: 3, fontWeight: 600, fontSize: 10, flexShrink: 0 }}>4件</span>
                  <span style={{ color: '#555' }}>{set.set4 || '-'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 卡带详情 */}
      {!loading && activeTab === 'sets' && selectedSet && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)', padding: '24px 30px', color: '#fff', position: 'relative' }}>
            <button onClick={() => setSelectedSet(null)} style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>← 返回列表</button>
            <div style={{ textAlign: 'center', paddingTop: 8 }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>🎯</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{selectedSet.name}</h2>
            </div>
          </div>
          <div style={{ padding: '24px 30px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <h4 style={{ fontSize: 14, color: '#1a1a2e', marginBottom: 12, borderBottom: '2px solid #2e7d32', paddingBottom: 6 }}>卡带效果</h4>
                <div style={{ background: '#f1f8e9', borderRadius: 8, padding: 14, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: '#2e7d32', fontWeight: 700, marginBottom: 4 }}>2件套效果</div>
                  <div style={{ fontSize: 13, color: '#333' }}>{selectedSet.set2}</div>
                </div>
                <div style={{ background: '#fff3e0', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, color: '#e65100', fontWeight: 700, marginBottom: 4 }}>4件套效果</div>
                  <div style={{ fontSize: 13, color: '#333' }}>{selectedSet.set4}</div>
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: 14, color: '#1a1a2e', marginBottom: 12, borderBottom: '2px solid #764ba2', paddingBottom: 6 }}>词条与适用</h4>
                {selectedSet.main_attr && (
                  <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 12, marginBottom: 10, borderLeft: '3px solid #667eea' }}>
                    <div style={{ fontSize: 11, color: '#999' }}>推荐主词条</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginTop: 2 }}>{selectedSet.main_attr}</div>
                  </div>
                )}
                {selectedSet.sub_attr && selectedSet.sub_attr.length > 0 && (
                  <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 12, marginBottom: 10, borderLeft: '3px solid #e74c3c' }}>
                    <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>推荐副词条</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(Array.isArray(selectedSet.sub_attr) ? selectedSet.sub_attr : []).map((s, i) => (
                        <span key={i} style={{ padding: '2px 8px', background: '#fce4ec', borderRadius: 3, fontSize: 11, color: '#c62828' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedSet.suitable && selectedSet.suitable.length > 0 && (
                  <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 12, borderLeft: '3px solid #27ae60' }}>
                    <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>适用角色</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(Array.isArray(selectedSet.suitable) ? selectedSet.suitable : []).map((s, i) => (
                        <span key={i} style={{ padding: '3px 10px', background: '#e8f8f5', borderRadius: 4, fontSize: 12, color: '#27ae60', fontWeight: 600 }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== 材料图鉴 ========== */}
      {!loading && activeTab === 'materials' && (
        <div>
          {(() => {
            const grouped: Record<string, MaterialItem[]> = {};
            materials.forEach(mat => { const key = mat.type || '其他'; if (!grouped[key]) grouped[key] = []; grouped[key].push(mat); });
            const typeLabels: Record<string, { label: string; icon: string; color: string }> = {
              'ascension': { label: '突破材料', icon: '⬆️', color: '#667eea' },
              'common': { label: '通用材料', icon: '🟦', color: '#3498db' },
              'skill': { label: '技能材料', icon: '📖', color: '#e67e22' },
              'skill_material': { label: '技能材料', icon: '📖', color: '#e67e22' },
              'weekly': { label: '周本材料', icon: '👹', color: '#e74c3c' },
              'arcdisk': { label: '弧盘材料', icon: '💎', color: '#9b59b6' },
            };
            return Object.entries(grouped).map(([type, mats]) => {
              const meta = typeLabels[type] || { label: type, icon: '📦', color: '#666' };
              return (
                <div key={type} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${meta.color}` }}>
                    <span style={{ fontSize: 18 }}>{meta.icon}</span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>{meta.label}</h3>
                    <span style={{ fontSize: 12, color: '#999' }}>({mats.length})</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                    {mats.map(mat => (
                      <div key={mat.id} style={{
                        background: '#fff', borderRadius: 8, padding: '10px 12px',
                        border: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 6,
                          background: `${meta.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, flexShrink: 0,
                        }}>{meta.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mat.name}</div>
                          <div style={{ fontSize: 10, color: '#999', marginTop: 1 }}>
                            {mat.source}
                            {mat.element && <span style={{ color: elementColors[mat.element] || '#667eea' }}> · {mat.element}</span>}
                          </div>
                        </div>
                        {mat.tier && <span style={{
                          padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                          background: mat.tier >= 3 ? '#fff3e0' : mat.tier >= 2 ? '#e8f5e9' : '#f5f5f5',
                          color: mat.tier >= 3 ? '#e65100' : mat.tier >= 2 ? '#2e7d32' : '#999',
                        }}>T{mat.tier}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* ========== 攻略百科 ========== */}
      {!loading && activeTab === 'knowledge' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {knowledge.map(entry => (
            <div key={entry.id} style={{
              background: '#fff', borderRadius: 10, overflow: 'hidden',
              border: expandedKnowledge === entry.id ? '1px solid #667eea' : '1px solid #e8e8e8',
              transition: 'border-color 0.2s',
            }}>
              <div
                onClick={() => setExpandedKnowledge(expandedKnowledge === entry.id ? null : entry.id)}
                style={{
                  padding: '14px 20px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: expandedKnowledge === entry.id ? '#f8f9ff' : '#fff',
                }}
              >
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', margin: '0 0 6px 0' }}>📄 {entry.title}</h3>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {entry.keywords && entry.keywords.map((kw, i) => (
                      <span key={i} style={{ padding: '1px 8px', background: '#f0f4ff', color: '#667eea', borderRadius: 3, fontSize: 10 }}>{kw}</span>
                    ))}
                  </div>
                </div>
                <span style={{ fontSize: 14, color: '#999', transition: 'transform 0.3s', transform: expandedKnowledge === entry.id ? 'rotate(180deg)' : 'none' }}>▼</span>
              </div>
              {expandedKnowledge === entry.id && (
                <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f0f0f0' }}>
                  <div style={{ fontSize: 13, color: '#444', lineHeight: 2, whiteSpace: 'pre-wrap', paddingTop: 16 }}>
                    {entry.content}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 筛选按钮组件
const FilterBtn: React.FC<{ label: string; active: boolean; onClick: () => void; color?: string }> = ({ label, active, onClick, color }) => (
  <button onClick={onClick} style={{
    padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: active ? 700 : 400,
    border: active ? `1.5px solid ${color || '#667eea'}` : '1px solid #e8e8e8',
    background: active ? `${color || '#667eea'}15` : '#fff',
    color: active ? (color || '#667eea') : '#666',
    cursor: 'pointer', transition: 'all 0.15s',
  }}>{label}</button>
);

// 技能行组件
const SkillRow: React.FC<{ label: string; desc: string; color: string }> = ({ label, desc, color }) => (
  <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 12, borderLeft: `3px solid ${color}` }}>
    <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 13, color: '#333', lineHeight: 1.5 }}>{desc || '-'}</div>
  </div>
);

export default DataShowcase;
