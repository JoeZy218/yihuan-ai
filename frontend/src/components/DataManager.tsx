import React, { useState, useEffect } from 'react';
import CharacterStatsChart from './CharacterStatsChart';

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
  attack: number;
  defense: number;
  hp: number;
  effect: string;
  effect_desc: string;
  suitable: string[];
}

interface Set {
  id: string;
  name: string;
  set2: string;
  set4: string;
  main_attr: string;
  sub_attr: string[];
  suitable: string[];
}

const DataManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('characters');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [materials, setMaterials] = useState<Record<string, any>>({});
  const [arcdisks, setArcdisks] = useState<ArcDisk[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [editingSet, setEditingSet] = useState<Set | null>(null);
  const [newSet, setNewSet] = useState({
    name: '',
    set2: '',
    set4: '',
    main_attr: '',
    sub_attr: '',
    suitable: ''
  });
  const [availableElements, setAvailableElements] = useState<string[]>(['冰', '火', '风', '雷', '岩', '光', '暗', '水']);
  
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [editingKnowledge, setEditingKnowledge] = useState<KnowledgeEntry | null>(null);
  const [editingArcDisk, setEditingArcDisk] = useState<ArcDisk | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState('');

  const [newChar, setNewChar] = useState({
    name: '',
    element: '冰',
    role: '主C',
    rarity: 'SSR',
    skillNormal: '',
    skillSkill: '',
    skillUltimate: '',
    best_arcdisk: '',
    best_set: '',
    synergy: ''
  });

  const [newKnowledge, setNewKnowledge] = useState({
    title: '',
    content: '',
    keywords: ''
  });

  const [newArcDisk, setNewArcDisk] = useState({
    name: '',
    element: '冰',
    rarity: 'SSR',
    attack: '',
    defense: '',
    hp: '',
    effect: '',
    effect_desc: '',
    suitable: ''
  });

  const roles = ['主C', '副C', '辅助', '生存'];
  const rarities = ['SSR', 'SR', 'R'];

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      if (activeTab === 'characters') {
        const res = await fetch('/api/admin/characters');
        setCharacters(await res.json());
        // 从材料数据中提取元素，追加到 availableElements
        const matRes = await fetch('/api/admin/materials');
        const matData = await matRes.json();
        const matElements = [...new Set(matData.filter((m: any) => m.element).map((m: any) => m.element))] as string[];
        if (matElements.length > 0) {
          setAvailableElements(prev => [...new Set([...prev, ...matElements])]);
        }
        // 同时加载弧盘数据提取元素
        const arcRes = await fetch('/api/admin/arcdisks');
        const arcData = await arcRes.json();
        const arcElements = [...new Set(arcData.map((d: any) => d.element).filter(Boolean))] as string[];
        if (arcElements.length > 0) {
          setAvailableElements(prev => [...new Set([...prev, ...arcElements])]);
        }
      } else if (activeTab === 'knowledge') {
        const res = await fetch('/api/admin/knowledge');
        setKnowledge(await res.json());
      } else if (activeTab === 'materials') {
        const res = await fetch('/api/admin/materials');
        const data = await res.json();
        // 将数组转换为前端期望的对象格式
        const materialsObj: Record<string, any> = {
          ascension_materials: {},
          common_ascension: [],
          skill_materials: [],
          weekly_materials: []
        };
        data.forEach((mat: any) => {
          if (mat.type === 'ascension' && mat.element) {
            if (!materialsObj.ascension_materials[mat.element]) {
              materialsObj.ascension_materials[mat.element] = [];
            }
            materialsObj.ascension_materials[mat.element].push({
              id: mat.id,
              name: mat.name,
              source: mat.source,
              tier: mat.tier
            });
          } else if (mat.type === 'common') {
            materialsObj.common_ascension.push({
              id: mat.id,
              name: mat.name,
              source: mat.source,
              tier: mat.tier
            });
          } else if (mat.type === 'skill_material' || mat.type === 'skill') {
            materialsObj.skill_materials.push({
              id: mat.id,
              name: mat.name,
              source: mat.source,
              tier: mat.tier
            });
          } else if (mat.type === 'weekly') {
            materialsObj.weekly_materials.push({
              id: mat.id,
              name: mat.name,
              source: mat.source,
              tier: mat.tier
            });
          }
        });
        setMaterials(materialsObj);
        // 从材料数据中提取元素，追加到 availableElements
        const matElements = [...new Set(data.filter((m: any) => m.element).map((m: any) => m.element))] as string[];
        if (matElements.length > 0) {
          setAvailableElements(prev => [...new Set([...prev, ...matElements])]);
        }
        // 同时加载角色和弧盘数据提取元素
        const charRes = await fetch('/api/admin/characters');
        const charData = await charRes.json();
        const charElements = [...new Set(charData.map((c: any) => c.element).filter(Boolean))] as string[];
        if (charElements.length > 0) {
          setAvailableElements(prev => [...new Set([...prev, ...charElements])]);
        }
        const arcRes = await fetch('/api/admin/arcdisks');
        const arcData = await arcRes.json();
        const arcElements = [...new Set(arcData.map((d: any) => d.element).filter(Boolean))] as string[];
        if (arcElements.length > 0) {
          setAvailableElements(prev => [...new Set([...prev, ...arcElements])]);
        }
      } else if (activeTab === 'arcdisks') {
        const res = await fetch('/api/admin/arcdisks');
        const arcData = await res.json();
        setArcdisks(arcData);
        // 从弧盘数据中提取元素，追加到 availableElements
        const arcElements = [...new Set(arcData.map((d: any) => d.element).filter(Boolean))] as string[];
        if (arcElements.length > 0) {
          setAvailableElements(prev => [...new Set([...prev, ...arcElements])]);
        }
        // 同时加载材料和角色数据提取元素
        const matRes = await fetch('/api/admin/materials');
        const matData = await matRes.json();
        const matElements = [...new Set(matData.filter((m: any) => m.element).map((m: any) => m.element))] as string[];
        if (matElements.length > 0) {
          setAvailableElements(prev => [...new Set([...prev, ...matElements])]);
        }
        const charRes = await fetch('/api/admin/characters');
        const charData = await charRes.json();
        const charElements = [...new Set(charData.map((c: any) => c.element).filter(Boolean))] as string[];
        if (charElements.length > 0) {
          setAvailableElements(prev => [...new Set([...prev, ...charElements])]);
        }
      } else if (activeTab === 'sets') {
        const res = await fetch('/api/admin/sets');
        setSets(await res.json());
      }
    } catch (err) {
      console.error('加载数据失败:', err);
    }
  };

  const handleAddCharacter = async () => {
    if (!newChar.name.trim()) {
      setMessage('角色名称不能为空');
      return;
    }
    
    try {
      const res = await fetch('/api/admin/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChar.name,
          element: newChar.element,
          role: newChar.role,
          rarity: newChar.rarity,
          skills: {
            normal: newChar.skillNormal,
            skill: newChar.skillSkill,
            ultimate: newChar.skillUltimate
          },
          best_arcdisk: newChar.best_arcdisk,
          best_set: newChar.best_set,
          synergy: newChar.synergy.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean)
        })
      });
      
      let data;
      try {
        data = await res.json();
      } catch {
        data = { detail: '服务器返回非JSON响应' };
      }
      
      if (res.ok) {
        setMessage(data.message || '添加成功');
        setIsAdding(false);
        resetNewChar();
        loadData();
      } else {
        setMessage(data.detail || '添加失败');
      }
    } catch (err: any) {
      setMessage('添加失败: ' + (err.message || err));
    }
  };

  const resetNewChar = () => {
    setNewChar({
      name: '',
      element: '冰',
      role: '主C',
      rarity: 'SSR',
      skillNormal: '',
      skillSkill: '',
      skillUltimate: '',
      best_arcdisk: '',
      best_set: '',
      synergy: ''
    });
  };

  const handleUpdateCharacter = async () => {
    if (!editingChar) return;
    
    try {
      const res = await fetch(`/api/admin/characters/${editingChar.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingChar)
      });
      
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setEditingChar(null);
        loadData();
      } else {
        setMessage(data.detail || '更新失败');
      }
    } catch (err) {
      setMessage('更新失败: ' + err);
    }
  };

  const handleDeleteCharacter = async (name: string) => {
    if (!confirm(`确定删除角色「${name}」吗？`)) return;
    
    try {
      const res = await fetch(`/api/admin/characters/${name}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        loadData();
      } else {
        setMessage(data.detail || '删除失败');
      }
    } catch (err) {
      setMessage('删除失败: ' + err);
    }
  };

  const handleAddKnowledge = async () => {
    if (!newKnowledge.title.trim()) {
      setMessage('标题不能为空');
      return;
    }
    
    try {
      const res = await fetch('/api/admin/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newKnowledge.title,
          content: newKnowledge.content,
          keywords: newKnowledge.keywords.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean)
        })
      });
      
      let data;
      try {
        data = await res.json();
      } catch {
        data = { detail: '服务器返回非JSON响应' };
      }
      
      if (res.ok) {
        setMessage(data.message || '添加成功');
        setNewKnowledge({ title: '', content: '', keywords: '' });
        loadData();
      } else {
        setMessage(data.detail || '添加失败');
      }
    } catch (err: any) {
      setMessage('添加失败: ' + (err.message || err));
    }
  };

  const handleUpdateKnowledge = async () => {
    if (!editingKnowledge) return;
    
    try {
      const res = await fetch(`/api/admin/knowledge/${editingKnowledge.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingKnowledge.title,
          content: editingKnowledge.content,
          keywords: editingKnowledge.keywords
        })
      });
      
      let data;
      try {
        data = await res.json();
      } catch {
        data = { detail: '服务器返回非JSON响应' };
      }
      
      if (res.ok) {
        setMessage(data.message || '更新成功');
        setEditingKnowledge(null);
        loadData();
      } else {
        setMessage(data.detail || '更新失败');
      }
    } catch (err: any) {
      setMessage('更新失败: ' + (err.message || err));
    }
  };

  const handleDeleteKnowledge = async (id: number) => {
    if (!confirm(`确定删除知识库条目吗？`)) return;
    
    try {
      const res = await fetch(`/api/admin/knowledge/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        loadData();
      } else {
        setMessage(data.detail || '删除失败');
      }
    } catch (err) {
      setMessage('删除失败: ' + err);
    }
  };

  const handleAddArcDisk = async () => {
    if (!newArcDisk.name.trim()) {
      setMessage('弧盘名称不能为空');
      return;
    }

    try {
      const res = await fetch('/api/admin/arcdisks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newArcDisk.name.toLowerCase().replace(/\s+/g, '-'),
          name: newArcDisk.name,
          element: newArcDisk.element,
          rarity: newArcDisk.rarity,
          attack: parseInt(newArcDisk.attack) || 0,
          defense: parseInt(newArcDisk.defense) || 0,
          hp: parseInt(newArcDisk.hp) || 0,
          effect: newArcDisk.effect,
          effect_desc: newArcDisk.effect_desc,
          suitable: newArcDisk.suitable.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean)
        })
      });

      let data;
      try {
        data = await res.json();
      } catch {
        data = { detail: '服务器返回非JSON响应' };
      }

      if (res.ok) {
        setMessage(data.message || '添加成功');
        // 如果新弧盘的元素不在列表中，添加到 availableElements
        if (newArcDisk.element && !availableElements.includes(newArcDisk.element)) {
          setAvailableElements(prev => [...prev, newArcDisk.element]);
        }
        setNewArcDisk({ name: '', element: '冰', rarity: 'SSR', attack: '', defense: '', hp: '', effect: '', effect_desc: '', suitable: '' });
        loadData();
      } else {
        setMessage(data.detail || '添加失败');
      }
    } catch (err: any) {
      setMessage('添加失败: ' + (err.message || err));
    }
  };

  const handleUpdateArcDisk = async () => {
    if (!editingArcDisk) return;

    try {
      const res = await fetch(`/api/admin/arcdisks/${editingArcDisk.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingArcDisk)
      });

      let data;
      try {
        data = await res.json();
      } catch {
        data = { detail: '服务器返回非JSON响应' };
      }

      if (res.ok) {
        setMessage(data.message || '更新成功');
        setEditingArcDisk(null);
        loadData();
      } else {
        setMessage(data.detail || '更新失败');
      }
    } catch (err: any) {
      setMessage('更新失败: ' + (err.message || err));
    }
  };

  const handleDeleteArcDisk = async (id: string) => {
    if (!confirm(`确定删除弧盘吗？`)) return;

    try {
      const res = await fetch(`/api/admin/arcdisks/${id}`, { method: 'DELETE' });

      let data;
      try {
        data = await res.json();
      } catch {
        data = { detail: '服务器返回非JSON响应' };
      }

      if (res.ok) {
        setMessage('弧盘删除成功');
        loadData();
      } else {
        setMessage(data.detail || '删除失败');
      }
    } catch (err: any) {
      setMessage('删除失败: ' + (err.message || err));
    }
  };

  const handleAddSet = async () => {
    if (!newSet.name.trim()) {
      setMessage('卡带名称不能为空');
      return;
    }

    try {
      const res = await fetch('/api/admin/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newSet.name.toLowerCase().replace(/\s+/g, '-'),
          name: newSet.name,
          set2: newSet.set2,
          set4: newSet.set4,
          main_attr: newSet.main_attr,
          sub_attr: newSet.sub_attr.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean),
          suitable: newSet.suitable.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean)
        })
      });

      let data;
      try {
        data = await res.json();
      } catch {
        data = { detail: '服务器返回非JSON响应' };
      }

      if (res.ok) {
        setMessage(data.message || '添加成功');
        setNewSet({ name: '', set2: '', set4: '', main_attr: '', sub_attr: '', suitable: '' });
        loadData();
      } else {
        setMessage(data.detail || '添加失败');
      }
    } catch (err: any) {
      setMessage('添加失败: ' + (err.message || err));
    }
  };

  const handleUpdateSet = async () => {
    if (!editingSet) return;

    try {
      const res = await fetch(`/api/admin/sets/${editingSet.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSet)
      });

      let data;
      try {
        data = await res.json();
      } catch {
        data = { detail: '服务器返回非JSON响应' };
      }

      if (res.ok) {
        setMessage(data.message || '更新成功');
        setEditingSet(null);
        loadData();
      } else {
        setMessage(data.detail || '更新失败');
      }
    } catch (err: any) {
      setMessage('更新失败: ' + (err.message || err));
    }
  };

  const handleDeleteSet = async (id: string) => {
    if (!confirm(`确定删除卡带吗？`)) return;

    try {
      const res = await fetch(`/api/admin/sets/${id}`, { method: 'DELETE' });

      let data;
      try {
        data = await res.json();
      } catch {
        data = { detail: '服务器返回非JSON响应' };
      }

      if (res.ok) {
        setMessage('卡带删除成功');
        loadData();
      } else {
        setMessage(data.detail || '删除失败');
      }
    } catch (err: any) {
      setMessage('删除失败: ' + (err.message || err));
    }
  };

  const handleUpdateMaterials = async () => {
    try {
      // 将前端对象格式转换回后端数组格式
      const materialsArray: any[] = [];
      
      // 处理突破材料
      Object.entries(materials.ascension_materials || {}).forEach(([element, mats]) => {
        (mats as any[]).forEach((mat) => {
          materialsArray.push({
            id: mat.id || `${element}_${mat.name}`,
            name: mat.name,
            type: 'ascension',
            tier: mat.tier,
            source: mat.source,
            source_type: '副本',
            element: element
          });
        });
      });
      
      // 处理通用突破材料
      (materials.common_ascension || []).forEach((mat: any) => {
        materialsArray.push({
          id: mat.id || `common_${mat.name}`,
          name: mat.name,
          type: 'common',
          tier: mat.tier,
          source: mat.source,
          source_type: '周本'
        });
      });
      
      // 处理技能材料
      (materials.skill_materials || []).forEach((mat: any) => {
        materialsArray.push({
          id: mat.id || `skill_mat_${mat.name}`,
          name: mat.name,
          type: 'skill_material',
          tier: mat.tier,
          source: mat.source,
          source_type: '副本'
        });
      });

      // 处理副本材料（周本材料）
      (materials.weekly_materials || []).forEach((mat: any) => {
        materialsArray.push({
          id: mat.id || `weekly_${mat.name}`,
          name: mat.name,
          type: 'weekly',
          tier: mat.tier,
          source: mat.source,
          source_type: '周本'
        });
      });
      
      const res = await fetch('/api/admin/materials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(materialsArray)
      });
      
      let data;
      try {
        data = await res.json();
      } catch {
        data = { detail: '服务器返回非JSON响应' };
      }
      
      if (res.ok) {
        setMessage(data.message || '更新成功');
      } else {
        setMessage(data.detail || '更新失败');
      }
    } catch (err: any) {
      setMessage('更新失败: ' + (err.message || err));
    }
  };

  const handleSkillChange = (type: string, value: string) => {
    if (!editingChar) return;
    const newSkills = { ...editingChar.skills };
    if (type === 'normal') newSkills.normal = value;
    else if (type === 'skill') newSkills.skill = value;
    else if (type === 'ultimate') newSkills.ultimate = value;
    setEditingChar({ ...editingChar, skills: newSkills });
  };

  const addAscensionMaterial = (element: string) => {
    const newMat = { name: '新材料', tier: 1, source: '新副本', source_type: '副本' };
    if (!materials.ascension_materials) materials.ascension_materials = {};
    if (!materials.ascension_materials[element]) {
      materials.ascension_materials[element] = [];
    }
    materials.ascension_materials[element].push(newMat);
    setMaterials({ ...materials });
  };

  const addSkillMaterial = () => {
    if (!materials.skill_materials) materials.skill_materials = [];
    materials.skill_materials.push({ name: '新技能材料', tier: 1, source: '新副本', source_type: '副本' });
    setMaterials({ ...materials });
  };

  const addWeeklyMaterial = () => {
    if (!materials.weekly_materials) materials.weekly_materials = [];
    materials.weekly_materials.push({ name: '新周本材料', tier: 1, source: '周本', source_type: '周本' });
    setMaterials({ ...materials });
  };

  const addCommonMaterial = () => {
    if (!materials.common_ascension) materials.common_ascension = [];
    materials.common_ascension.push({ name: '新通用材料', tier: 1, source: '周本', source_type: '周本' });
    setMaterials({ ...materials });
  };

  const addNewElement = () => {
    const newElement = prompt('请输入新元素名称：');
    if (newElement && newElement.trim()) {
      const element = newElement.trim();
      if (!materials.ascension_materials) materials.ascension_materials = {};
      materials.ascension_materials[element] = [];
      setMaterials({ ...materials });
    }
  };

  const deleteElement = (element: string) => {
    if (confirm(`确定要删除${element}元素及其所有材料吗？`)) {
      delete materials.ascension_materials[element];
      setMaterials({ ...materials });
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ fontSize: 24, marginBottom: 20, color: '#1a1a2e' }}>
        ⚙️ 数据管理中心
      </h2>

      {message && (
        <div style={{
          padding: 12,
          marginBottom: 16,
          borderRadius: 8,
          background: message.includes('成功') ? '#d4edda' : '#f8d7da',
          color: message.includes('成功') ? '#155724' : '#721c24',
          fontSize: 13
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #e8e8e8' }}>
        {[
          { key: 'characters', label: '角色管理', icon: '👤' },
          { key: 'knowledge', label: '知识库', icon: '📚' },
          { key: 'materials', label: '材料数据', icon: '📦' },
          { key: 'arcdisks', label: '弧盘数据', icon: '💎' },
          { key: 'sets', label: '卡带数据', icon: '🎯' },
          { key: 'stats', label: '角色统计', icon: '📊' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              background: activeTab === tab.key ? '#f0f4ff' : 'transparent',
              color: activeTab === tab.key ? '#667eea' : '#666',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: activeTab === tab.key ? 600 : 400,
              borderBottom: activeTab === tab.key ? '2px solid #667eea' : 'none'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'characters' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ color: '#666', fontSize: 14 }}>共 {characters.length} 个角色</span>
            <button
              onClick={() => setIsAdding(true)}
              style={{
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13
              }}
            >
              + 添加角色
            </button>
          </div>

          {isAdding && (
            <div style={{
              background: '#f8f9fa',
              padding: 20,
              borderRadius: 12,
              marginBottom: 20,
              border: '1px solid #e8e8e8'
            }}>
              <h3 style={{ marginBottom: 16, fontSize: 16 }}>添加新角色</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <input
                  placeholder="角色名称"
                  value={newChar.name}
                  onChange={(e) => setNewChar({ ...newChar, name: e.target.value })}
                  style={formInputStyle}
                />
                <div style={{ position: 'relative' }}>
                  <select value={newChar.element} onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      const custom = prompt('请输入新元素名称：');
                      if (custom && custom.trim()) {
                        const newEl = custom.trim();
                        if (!availableElements.includes(newEl)) {
                          setAvailableElements([...availableElements, newEl]);
                        }
                        setNewChar({ ...newChar, element: newEl });
                      }
                    } else {
                      setNewChar({ ...newChar, element: e.target.value });
                    }
                  }} style={formInputStyle}>
                    {availableElements.map(e => <option key={e} value={e}>{e}</option>)}
                    <option value="__custom__">+ 自定义元素</option>
                  </select>
                </div>
                <select value={newChar.role} onChange={(e) => setNewChar({ ...newChar, role: e.target.value })} style={formInputStyle}>
                  {roles.map(r => <option key={r}>{r}</option>)}
                </select>
                <select value={newChar.rarity} onChange={(e) => setNewChar({ ...newChar, rarity: e.target.value })} style={formInputStyle}>
                  {rarities.map(r => <option key={r}>{r}</option>)}
                </select>
                <input placeholder="普攻描述" value={newChar.skillNormal} onChange={(e) => setNewChar({ ...newChar, skillNormal: e.target.value })} style={formInputStyle} />
                <input placeholder="战技描述" value={newChar.skillSkill} onChange={(e) => setNewChar({ ...newChar, skillSkill: e.target.value })} style={formInputStyle} />
                <input placeholder="大招描述" value={newChar.skillUltimate} onChange={(e) => setNewChar({ ...newChar, skillUltimate: e.target.value })} style={formInputStyle} />
                <select
                  value={newChar.best_arcdisk}
                  onChange={(e) => setNewChar({ ...newChar, best_arcdisk: e.target.value })}
                  style={formInputStyle}
                >
                  <option value="">-- 选择最佳弧盘 --</option>
                  {arcdisks.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
                <select
                  value={newChar.best_set}
                  onChange={(e) => setNewChar({ ...newChar, best_set: e.target.value })}
                  style={formInputStyle}
                >
                  <option value="">-- 选择推荐卡带 --</option>
                  {sets.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
                <input placeholder="元素协同（逗号分隔）" value={newChar.synergy} onChange={(e) => setNewChar({ ...newChar, synergy: e.target.value })} style={{ ...formInputStyle, gridColumn: 'span 2' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={handleAddCharacter} style={submitBtnStyle}>确认添加</button>
                <button onClick={() => { setIsAdding(false); setMessage(''); }} style={cancelBtnStyle}>取消</button>
              </div>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={thStyle}>名称</th>
                <th style={thStyle}>元素</th>
                <th style={thStyle}>定位</th>
                <th style={thStyle}>稀有度</th>
                <th style={thStyle}>技能</th>
                <th style={thStyle}>弧盘</th>
                <th style={thStyle}>卡带</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {characters.map(char => editingChar?.id === char.id ? (
                <tr key={char.id}>
                  <td><input value={editingChar.name} onChange={(e) => setEditingChar({ ...editingChar, name: e.target.value })} style={inputStyle} /></td>
                  <td>
                    <select value={editingChar.element} onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        const custom = prompt('请输入新元素名称：');
                        if (custom && custom.trim()) {
                          const newEl = custom.trim();
                          if (!availableElements.includes(newEl)) {
                            setAvailableElements([...availableElements, newEl]);
                          }
                          setEditingChar({ ...editingChar, element: newEl });
                        }
                      } else {
                        setEditingChar({ ...editingChar, element: e.target.value });
                      }
                    }} style={inputStyle}>
                      {availableElements.map(e => <option key={e} value={e}>{e}</option>)}
                      <option value="__custom__">+ 自定义元素</option>
                    </select>
                  </td>
                  <td>
                    <select value={editingChar.role} onChange={(e) => setEditingChar({ ...editingChar, role: e.target.value })} style={inputStyle}>
                      {roles.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={editingChar.rarity} onChange={(e) => setEditingChar({ ...editingChar, rarity: e.target.value })} style={inputStyle}>
                      {rarities.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: '#999', width: 30 }}>普攻:</span>
                        <input value={editingChar.skills.normal} onChange={(e) => handleSkillChange('normal', e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 100 }} placeholder="普攻描述" />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: '#999', width: 30 }}>战技:</span>
                        <input value={editingChar.skills.skill} onChange={(e) => handleSkillChange('skill', e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 100 }} placeholder="战技描述" />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: '#999', width: 30 }}>大招:</span>
                        <input value={editingChar.skills.ultimate} onChange={(e) => handleSkillChange('ultimate', e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 100 }} placeholder="大招描述" />
                      </div>
                    </div>
                  </td>
                  <td>
                    <select
                      value={editingChar.best_arcdisk || ''}
                      onChange={(e) => setEditingChar({ ...editingChar, best_arcdisk: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">-- 无 --</option>
                      {arcdisks.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={editingChar.best_set || ''}
                      onChange={(e) => setEditingChar({ ...editingChar, best_set: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">-- 无 --</option>
                      {sets.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button onClick={handleUpdateCharacter} style={{ ...btnStyle, background: '#28a745' }}>保存</button>
                    <button onClick={() => setEditingChar(null)} style={btnStyle}>取消</button>
                  </td>
                </tr>
              ) : (
                <tr key={char.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={tdStyle}><strong>{char.name}</strong></td>
                  <td style={{ ...tdStyle, color: elementColors[char.element] }}>{char.element}</td>
                  <td style={{ ...tdStyle, color: roleColors[char.role] }}>{char.role}</td>
                  <td style={{ ...tdStyle, color: rarityColors[char.rarity] }}>{char.rarity}</td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: 12, color: '#666', lineHeight: 1.4 }}>
                      <div><strong style={{ color: '#333' }}>普攻:</strong> {char.skills.normal}</div>
                      <div><strong style={{ color: '#333' }}>战技:</strong> {char.skills.skill}</div>
                      <div><strong style={{ color: '#333' }}>大招:</strong> {char.skills.ultimate}</div>
                    </div>
                  </td>
                  <td style={tdStyle}>{char.best_arcdisk || '-'}</td>
                  <td style={tdStyle}>{char.best_set || '-'}</td>
                  <td style={tdStyle}>
                    <button onClick={() => setEditingChar(char)} style={{ ...btnStyle, padding: '4px 8px' }}>编辑</button>
                    <button onClick={() => handleDeleteCharacter(char.name)} style={{ ...btnStyle, padding: '4px 8px', background: '#dc3545' }}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'knowledge' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ color: '#666', fontSize: 14 }}>共 {knowledge.length} 条知识</span>
            <button onClick={handleAddKnowledge} style={{
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13
            }}>
              + 添加条目
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {knowledge.map(entry => editingKnowledge?.id === entry.id ? (
              <div key={entry.id} style={{
                background: '#fff',
                padding: 16,
                borderRadius: 8,
                border: '1px solid #667eea',
                position: 'relative'
              }}>
                <input
                  value={editingKnowledge.title}
                  onChange={(e) => setEditingKnowledge({ ...editingKnowledge, title: e.target.value })}
                  style={{ ...formInputStyle, marginBottom: 8, width: '100%' }}
                  placeholder="标题"
                />
                <textarea
                  value={editingKnowledge.content}
                  onChange={(e) => setEditingKnowledge({ ...editingKnowledge, content: e.target.value })}
                  style={{ ...formInputStyle, marginBottom: 8, width: '100%', height: 80 }}
                  placeholder="内容"
                />
                <input
                  value={editingKnowledge.keywords.join(', ')}
                  onChange={(e) => setEditingKnowledge({ ...editingKnowledge, keywords: e.target.value.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean) })}
                  style={{ ...formInputStyle, marginBottom: 8, width: '100%' }}
                  placeholder="关键词（逗号分隔）"
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleUpdateKnowledge} style={{ ...btnStyle, background: '#28a745' }}>保存</button>
                  <button onClick={() => setEditingKnowledge(null)} style={btnStyle}>取消</button>
                </div>
              </div>
            ) : (
              <div key={entry.id} style={{
                background: '#fff',
                padding: 16,
                borderRadius: 8,
                border: '1px solid #e8e8e8',
                position: 'relative'
              }}>
                <button onClick={() => handleDeleteKnowledge(entry.id)} style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: '#dc3545',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 11,
                  cursor: 'pointer'
                }}>删除</button>
                <button onClick={() => setEditingKnowledge(entry)} style={{
                  position: 'absolute',
                  top: 8,
                  right: 50,
                  background: '#667eea',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 11,
                  cursor: 'pointer'
                }}>编辑</button>
                <h4 style={{ marginBottom: 8, color: '#1a1a2e' }}>{entry.title}</h4>
                <p style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>
                  {entry.content.length > 100 ? entry.content.slice(0, 100) + '...' : entry.content}
                </p>
                <div style={{ marginTop: 8 }}>
                  {entry.keywords.map((kw, i) => (
                    <span key={i} style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      marginRight: 4,
                      background: '#f0f4ff',
                      color: '#667eea',
                      borderRadius: 4,
                      fontSize: 11
                    }}>{kw}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            background: '#f8f9fa',
            padding: 20,
            borderRadius: 12,
            marginTop: 20,
            border: '1px solid #e8e8e8'
          }}>
            <h3 style={{ marginBottom: 16, fontSize: 16 }}>添加新知识库条目</h3>
            <input
              placeholder="标题"
              value={newKnowledge.title}
              onChange={(e) => setNewKnowledge({ ...newKnowledge, title: e.target.value })}
              style={{ ...formInputStyle, marginBottom: 12, width: '100%' }}
            />
            <textarea
              placeholder="内容"
              value={newKnowledge.content}
              onChange={(e) => setNewKnowledge({ ...newKnowledge, content: e.target.value })}
              style={{ ...formInputStyle, marginBottom: 12, width: '100%', height: 100 }}
            />
            <input
              placeholder="关键词（逗号分隔）"
              value={newKnowledge.keywords}
              onChange={(e) => setNewKnowledge({ ...newKnowledge, keywords: e.target.value })}
              style={{ ...formInputStyle, marginBottom: 12, width: '100%' }}
            />
            <button onClick={handleAddKnowledge} style={submitBtnStyle}>确认添加</button>
          </div>
        </div>
      )}

      {activeTab === 'materials' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ color: '#666', fontSize: 14 }}>材料数据管理</span>
            <button onClick={handleUpdateMaterials} style={{
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13
            }}>
              保存修改
            </button>
          </div>

          <h3 style={{ marginBottom: 16, fontSize: 16 }}>突破材料（按元素）</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {Object.entries(materials.ascension_materials || {}).map(([element, mats]) => (
              <div key={element} style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #e8e8e8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <input
                    value={element}
                    onChange={(e) => {
                      const oldElement = element;
                      const newElement = e.target.value;
                      if (newElement && newElement.trim()) {
                        const matsCopy = [...(mats as any[])];
                        delete materials.ascension_materials[oldElement];
                        materials.ascension_materials[newElement.trim()] = matsCopy;
                        setMaterials({ ...materials });
                      }
                    }}
                    style={{ fontWeight: 'bold', color: elementColors[element] || '#333', border: 'none', background: 'transparent', fontSize: 14, flex: 1 }}
                  />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => addAscensionMaterial(element)} style={{
                      padding: '2px 6px',
                      background: '#667eea',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 10,
                      cursor: 'pointer'
                    }}>+</button>
                    <button onClick={() => deleteElement(element)} style={{
                      padding: '2px 6px',
                      background: '#dc3545',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 10,
                      cursor: 'pointer'
                    }}>X</button>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  {(mats as any[]).map((mat, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#666', marginTop: 4, display: 'flex', gap: 4 }}>
                      <input
                        value={mat.name}
                        onChange={(e) => { mat.name = e.target.value; setMaterials({ ...materials }); }}
                        style={{ flex: 1, padding: '4px', border: '1px solid #ddd', borderRadius: 4, fontSize: 11 }}
                      />
                      <input
                        value={mat.source}
                        onChange={(e) => { mat.source = e.target.value; setMaterials({ ...materials }); }}
                        style={{ flex: 1, padding: '4px', border: '1px solid #ddd', borderRadius: 4, fontSize: 11 }}
                      />
                      <button onClick={() => {
                        (mats as any[]).splice(i, 1);
                        setMaterials({ ...materials });
                      }} style={{
                        background: '#dc3545',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontSize: 10,
                        cursor: 'pointer'
                      }}>x</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={addNewElement} style={{
              background: '#f8f9fa',
              padding: 20,
              borderRadius: 8,
              border: '2px dashed #667eea',
              cursor: 'pointer',
              color: '#667eea',
              fontSize: 14,
              fontWeight: 'bold',
              minHeight: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              + 添加新元素
            </button>
          </div>

          <h3 style={{ margin: '20px 0 16px', fontSize: 16 }}>技能材料</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {(materials.skill_materials || []).map((mat: any, i: number) => (
              <div key={i} style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #e8e8e8', minWidth: 200 }}>
                <input
                  value={mat.name}
                  onChange={(e) => { mat.name = e.target.value; setMaterials({ ...materials }); }}
                  style={{ ...inputStyle, marginBottom: 4 }}
                />
                <input
                  value={mat.source}
                  onChange={(e) => { mat.source = e.target.value; setMaterials({ ...materials }); }}
                  style={{ ...inputStyle, marginBottom: 4 }}
                />
                <button onClick={() => {
                  (materials.skill_materials as any[]).splice(i, 1);
                  setMaterials({ ...materials });
                }} style={{ ...btnStyle, padding: '4px 8px' }}>删除</button>
              </div>
            ))}
            <button onClick={addSkillMaterial} style={{
              background: '#f8f9fa',
              padding: 12,
              borderRadius: 8,
              border: '1px dashed #ddd',
              cursor: 'pointer',
              color: '#666',
              minWidth: 200
            }}>
              + 添加技能材料
            </button>
          </div>

          <h3 style={{ margin: '20px 0 16px', fontSize: 16 }}>副本材料</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {(materials.weekly_materials || []).map((mat: any, i: number) => (
              <div key={i} style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #e8e8e8', minWidth: 200 }}>
                <input
                  value={mat.name}
                  onChange={(e) => { mat.name = e.target.value; setMaterials({ ...materials }); }}
                  style={{ ...inputStyle, marginBottom: 4 }}
                />
                <input
                  value={mat.source}
                  onChange={(e) => { mat.source = e.target.value; setMaterials({ ...materials }); }}
                  style={{ ...inputStyle, marginBottom: 4 }}
                />
                <button onClick={() => {
                  (materials.weekly_materials as any[]).splice(i, 1);
                  setMaterials({ ...materials });
                }} style={{ ...btnStyle, padding: '4px 8px' }}>删除</button>
              </div>
            ))}
            <button onClick={addWeeklyMaterial} style={{
              background: '#f8f9fa',
              padding: 12,
              borderRadius: 8,
              border: '1px dashed #ddd',
              cursor: 'pointer',
              color: '#666',
              minWidth: 200
            }}>
              + 添加副本材料
            </button>
          </div>

          <h3 style={{ margin: '20px 0 16px', fontSize: 16 }}>通用突破材料</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {(materials.common_ascension || []).map((mat: any, i: number) => (
              <div key={i} style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #e8e8e8', minWidth: 200 }}>
                <input
                  value={mat.name}
                  onChange={(e) => { mat.name = e.target.value; setMaterials({ ...materials }); }}
                  style={{ ...inputStyle, marginBottom: 4 }}
                />
                <input
                  value={mat.source}
                  onChange={(e) => { mat.source = e.target.value; setMaterials({ ...materials }); }}
                  style={{ ...inputStyle, marginBottom: 4 }}
                />
                <button onClick={() => {
                  (materials.common_ascension as any[]).splice(i, 1);
                  setMaterials({ ...materials });
                }} style={{ ...btnStyle, padding: '4px 8px' }}>删除</button>
              </div>
            ))}
            <button onClick={addCommonMaterial} style={{
              background: '#f8f9fa',
              padding: 12,
              borderRadius: 8,
              border: '1px dashed #ddd',
              cursor: 'pointer',
              color: '#666',
              minWidth: 200
            }}>
              + 添加通用材料
            </button>
          </div>
        </div>
      )}

      {activeTab === 'arcdisks' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ color: '#666', fontSize: 14 }}>共 {arcdisks.length} 个弧盘（专武）</span>
            <button onClick={() => { setNewArcDisk({ name: '', element: '冰', rarity: 'SSR', attack: '', defense: '', hp: '', effect: '', effect_desc: '', suitable: '' }); setIsAdding(true); }} style={{
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13
            }}>
              + 添加弧盘
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {arcdisks.map(disk => editingArcDisk?.id === disk.id ? (
              <div key={disk.id} style={{
                background: '#fff',
                padding: 16,
                borderRadius: 8,
                border: '1px solid #f5576c'
              }}>
                <input
                  value={editingArcDisk.name}
                  onChange={(e) => setEditingArcDisk({ ...editingArcDisk, name: e.target.value })}
                  style={{ ...formInputStyle, marginBottom: 8, width: '100%' }}
                  placeholder="弧盘名称"
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <select
                    value={editingArcDisk.element}
                    onChange={(e) => setEditingArcDisk({ ...editingArcDisk, element: e.target.value })}
                    style={formInputStyle}
                  >
                    {availableElements.map(el => <option key={el} value={el}>{el}</option>)}
                  </select>
                  <select
                    value={editingArcDisk.rarity}
                    onChange={(e) => setEditingArcDisk({ ...editingArcDisk, rarity: e.target.value })}
                    style={formInputStyle}
                  >
                    {rarities.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input
                    value={editingArcDisk.attack}
                    onChange={(e) => setEditingArcDisk({ ...editingArcDisk, attack: parseInt(e.target.value) || 0 })}
                    type="number"
                    style={formInputStyle}
                    placeholder="攻击力"
                  />
                  <input
                    value={editingArcDisk.defense}
                    onChange={(e) => setEditingArcDisk({ ...editingArcDisk, defense: parseInt(e.target.value) || 0 })}
                    type="number"
                    style={formInputStyle}
                    placeholder="防御力"
                  />
                </div>
                <input
                  value={editingArcDisk.hp}
                  onChange={(e) => setEditingArcDisk({ ...editingArcDisk, hp: parseInt(e.target.value) || 0 })}
                  type="number"
                  style={formInputStyle}
                  placeholder="生命值"
                />
                <input
                  value={editingArcDisk.effect}
                  onChange={(e) => setEditingArcDisk({ ...editingArcDisk, effect: e.target.value })}
                  style={{ ...formInputStyle, marginBottom: 8, width: '100%' }}
                  placeholder="效果名称"
                />
                <textarea
                  value={editingArcDisk.effect_desc}
                  onChange={(e) => setEditingArcDisk({ ...editingArcDisk, effect_desc: e.target.value })}
                  style={{ ...formInputStyle, marginBottom: 8, width: '100%', height: 60 }}
                  placeholder="效果描述"
                />
                <input
                  value={editingArcDisk.suitable.join(', ')}
                  onChange={(e) => setEditingArcDisk({ ...editingArcDisk, suitable: e.target.value.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean) })}
                  style={{ ...formInputStyle, marginBottom: 8, width: '100%' }}
                  placeholder="适用角色（逗号分隔）"
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleUpdateArcDisk} style={{ ...btnStyle, background: '#28a745' }}>保存</button>
                  <button onClick={() => setEditingArcDisk(null)} style={btnStyle}>取消</button>
                </div>
              </div>
            ) : (
              <div key={disk.id} style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                padding: 16,
                borderRadius: 8,
                border: '1px solid #f5576c',
                position: 'relative',
                color: '#fff'
              }}>
                <button onClick={() => handleDeleteArcDisk(disk.id)} style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'rgba(255,255,255,0.3)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 11,
                  cursor: 'pointer'
                }}>删除</button>
                <button onClick={() => setEditingArcDisk(disk)} style={{
                  position: 'absolute',
                  top: 8,
                  right: 50,
                  background: 'rgba(255,255,255,0.3)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 11,
                  cursor: 'pointer'
                }}>编辑</button>
                <h4 style={{ marginBottom: 8, color: '#fff' }}>{disk.name}</h4>
                <div style={{ fontSize: 12, marginBottom: 6 }}>
                  <span style={{ marginRight: 8 }}>{disk.element}元素</span>
                  <span>{disk.rarity}</span>
                </div>
                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  攻击: {disk.attack || 0} | 防御: {disk.defense || 0} | 生命: {disk.hp || 0}
                </div>
                <div style={{ fontSize: 12, padding: '8px 10px', background: 'rgba(255,255,255,0.2)', borderRadius: 6 }}>
                  <strong>效果「{disk.effect}」：</strong>{disk.effect_desc}
                </div>
                <div style={{ fontSize: 12, marginTop: 6 }}>
                  适用角色：{disk.suitable?.join(', ') || '-'}
                </div>
              </div>
            ))}
          </div>

          {isAdding && (
            <div style={{
              background: '#f8f9fa',
              padding: 20,
              borderRadius: 12,
              marginTop: 20,
              border: '1px solid #f5576c'
            }}>
              <h3 style={{ marginBottom: 16, fontSize: 16 }}>添加新弧盘（专武）</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                <input
                  placeholder="弧盘名称"
                  value={newArcDisk.name}
                  onChange={(e) => setNewArcDisk({ ...newArcDisk, name: e.target.value })}
                  style={formInputStyle}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <select
                    value={newArcDisk.element}
                    onChange={(e) => setNewArcDisk({ ...newArcDisk, element: e.target.value })}
                    style={formInputStyle}
                  >
                    {availableElements.map(el => <option key={el} value={el}>{el}</option>)}
                  </select>
                  <select
                    value={newArcDisk.rarity}
                    onChange={(e) => setNewArcDisk({ ...newArcDisk, rarity: e.target.value })}
                    style={formInputStyle}
                  >
                    {rarities.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <input
                  placeholder="攻击力"
                  type="number"
                  value={newArcDisk.attack}
                  onChange={(e) => setNewArcDisk({ ...newArcDisk, attack: e.target.value })}
                  style={formInputStyle}
                />
                <input
                  placeholder="防御力"
                  type="number"
                  value={newArcDisk.defense}
                  onChange={(e) => setNewArcDisk({ ...newArcDisk, defense: e.target.value })}
                  style={formInputStyle}
                />
                <input
                  placeholder="生命值"
                  type="number"
                  value={newArcDisk.hp}
                  onChange={(e) => setNewArcDisk({ ...newArcDisk, hp: e.target.value })}
                  style={formInputStyle}
                />
                <input
                  placeholder="效果名称"
                  value={newArcDisk.effect}
                  onChange={(e) => setNewArcDisk({ ...newArcDisk, effect: e.target.value })}
                  style={formInputStyle}
                />
                <input
                  placeholder="适用角色（逗号分隔）"
                  value={newArcDisk.suitable}
                  onChange={(e) => setNewArcDisk({ ...newArcDisk, suitable: e.target.value })}
                  style={formInputStyle}
                />
              </div>
              <textarea
                placeholder="效果描述"
                value={newArcDisk.effect_desc}
                onChange={(e) => setNewArcDisk({ ...newArcDisk, effect_desc: e.target.value })}
                style={{ ...formInputStyle, width: '100%', marginTop: 12, height: 60 }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={handleAddArcDisk} style={{ ...submitBtnStyle, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>确认添加</button>
                <button onClick={() => setIsAdding(false)} style={cancelBtnStyle}>取消</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'sets' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ color: '#666', fontSize: 14 }}>共 {sets.length} 个卡带</span>
            <button onClick={() => setIsAdding(true)} style={{
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13
            }}>
              + 添加卡带
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {sets.map(s => editingSet?.id === s.id ? (
              <div key={s.id} style={{
                background: '#fff',
                padding: 16,
                borderRadius: 8,
                border: '1px solid #667eea'
              }}>
                <input
                  value={editingSet.name}
                  onChange={(e) => setEditingSet({ ...editingSet, name: e.target.value })}
                  style={{ ...formInputStyle, marginBottom: 8, width: '100%' }}
                  placeholder="卡带名称"
                />
                <input
                  value={editingSet.set2}
                  onChange={(e) => setEditingSet({ ...editingSet, set2: e.target.value })}
                  style={{ ...formInputStyle, marginBottom: 8, width: '100%' }}
                  placeholder="2件套效果"
                />
                <input
                  value={editingSet.set4}
                  onChange={(e) => setEditingSet({ ...editingSet, set4: e.target.value })}
                  style={{ ...formInputStyle, marginBottom: 8, width: '100%' }}
                  placeholder="4件套效果"
                />
                <input
                  value={editingSet.main_attr}
                  onChange={(e) => setEditingSet({ ...editingSet, main_attr: e.target.value })}
                  style={{ ...formInputStyle, marginBottom: 8, width: '100%' }}
                  placeholder="主属性推荐"
                />
                <input
                  value={(editingSet.sub_attr || []).join(', ')}
                  onChange={(e) => setEditingSet({ ...editingSet, sub_attr: e.target.value.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean) })}
                  style={{ ...formInputStyle, marginBottom: 8, width: '100%' }}
                  placeholder="副词条（逗号分隔）"
                />
                <input
                  value={(editingSet.suitable || []).join(', ')}
                  onChange={(e) => setEditingSet({ ...editingSet, suitable: e.target.value.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean) })}
                  style={{ ...formInputStyle, marginBottom: 8, width: '100%' }}
                  placeholder="适用角色（逗号分隔）"
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleUpdateSet} style={{ ...btnStyle, background: '#28a745' }}>保存</button>
                  <button onClick={() => setEditingSet(null)} style={btnStyle}>取消</button>
                </div>
              </div>
            ) : (
              <div key={s.id} style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: 16,
                borderRadius: 8,
                border: '1px solid #667eea',
                position: 'relative',
                color: '#fff'
              }}>
                <button onClick={() => handleDeleteSet(s.id)} style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'rgba(255,255,255,0.3)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 11,
                  cursor: 'pointer'
                }}>删除</button>
                <button onClick={() => setEditingSet(s)} style={{
                  position: 'absolute',
                  top: 8,
                  right: 50,
                  background: 'rgba(255,255,255,0.3)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 11,
                  cursor: 'pointer'
                }}>编辑</button>
                <h4 style={{ marginBottom: 8, color: '#fff' }}>{s.name}</h4>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  <div><strong>2件套：</strong>{s.set2}</div>
                  <div><strong>4件套：</strong>{s.set4}</div>
                </div>
                <div style={{ fontSize: 12, marginTop: 8 }}>
                  <div>主属性：{(() => {
                    try {
                      const mainAttr = typeof s.main_attr === 'string' ? JSON.parse(s.main_attr) : s.main_attr;
                      if (mainAttr && typeof mainAttr === 'object') {
                        return Object.entries(mainAttr).map(([pos, stat]) => {
                          const posLabel = pos.replace('position_', '') + '号位';
                          return `${posLabel}:${stat}`;
                        }).join(' | ');
                      }
                      return s.main_attr || '-';
                    } catch {
                      return s.main_attr || '-';
                    }
                  })()}</div>
                  <div>副词条：{s.sub_attr?.join(', ') || '-'}</div>
                  <div>适用：{s.suitable?.join(', ') || '-'}</div>
                </div>
              </div>
            ))}
          </div>

          {isAdding && (
            <div style={{
              background: '#f8f9fa',
              padding: 20,
              borderRadius: 12,
              marginTop: 20,
              border: '1px solid #667eea'
            }}>
              <h3 style={{ marginBottom: 16, fontSize: 16 }}>添加新卡带</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                <input
                  placeholder="卡带名称"
                  value={newSet.name}
                  onChange={(e) => setNewSet({ ...newSet, name: e.target.value })}
                  style={formInputStyle}
                />
                <input
                  placeholder="主属性推荐"
                  value={newSet.main_attr}
                  onChange={(e) => setNewSet({ ...newSet, main_attr: e.target.value })}
                  style={formInputStyle}
                />
                <input
                  placeholder="2件套效果"
                  value={newSet.set2}
                  onChange={(e) => setNewSet({ ...newSet, set2: e.target.value })}
                  style={formInputStyle}
                />
                <input
                  placeholder="4件套效果"
                  value={newSet.set4}
                  onChange={(e) => setNewSet({ ...newSet, set4: e.target.value })}
                  style={formInputStyle}
                />
                <input
                  placeholder="副词条（逗号分隔）"
                  value={newSet.sub_attr}
                  onChange={(e) => setNewSet({ ...newSet, sub_attr: e.target.value })}
                  style={formInputStyle}
                />
                <input
                  placeholder="适用角色（逗号分隔）"
                  value={newSet.suitable}
                  onChange={(e) => setNewSet({ ...newSet, suitable: e.target.value })}
                  style={formInputStyle}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={handleAddSet} style={{ ...submitBtnStyle, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>确认添加</button>
                <button onClick={() => setIsAdding(false)} style={cancelBtnStyle}>取消</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <CharacterStatsChart />
      )}
    </div>
  );
};

const formInputStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid #ddd',
  fontSize: 13,
  outline: 'none'
};

const submitBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: '#fff',
  color: '#666',
  border: '1px solid #ddd',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13
};

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#666',
  fontSize: 13
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: '#333'
};

const inputStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: 4,
  border: '1px solid #ddd',
  fontSize: 12,
  outline: 'none',
  width: '100%'
};

const btnStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: '#667eea',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  marginRight: 4
};

const elementColors: Record<string, string> = {
  '冰': '#7ec8e3', '火': '#e87461', '风': '#7dcea0',
  '雷': '#c39bdb', '岩': '#d4a574', '光': '#f7dc6f',
  '暗': '#7d669e', '水': '#5dade2',
};

const roleColors: Record<string, string> = {
  '主C': '#e74c3c', '副C': '#f39c12', '辅助': '#2ecc71', '生存': '#3498db',
};

const rarityColors: Record<string, string> = {
  'SSR': '#e74c3c', 'SR': '#f39c12', 'R': '#95a5a6',
};

export default DataManager;