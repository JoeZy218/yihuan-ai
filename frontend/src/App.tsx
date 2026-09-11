/**
 * 应用根组件（单页应用，左侧导航 + 右侧内容区）：
 * - chat      AI 助手页：智能问答 / 配队推荐 / 材料计算 / 弧盘推荐 四种表单模式，
 *                      回复按 type 渲染为 TeamCard / MaterialTable / ArcDiskCard 卡片
 * - showcase  数据展示页：角色/弧盘/卡带/材料/攻略 五类图鉴（DataShowcase）
 * - manager   数据管理页：各类数据的增删改查 + 角色互动统计图表（DataManager）
 * - settings  API 配置页：设置 LLM 的 API Key / URL / 模型
 * 会话 ID 持久化在 localStorage，刷新页面后对话上下文不丢失。
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChatBubble from './components/ChatBubble';
import TeamCard from './components/TeamCard';
import MaterialTable from './components/MaterialTable';
import ArcDiskCard from './components/ArcDiskCard';
import DataManager from './components/DataManager';
import DataShowcase from './components/DataShowcase';
import { useMediaQuery } from './hooks/useMediaQuery';
import * as api from './api';
import { ChatMessage, TeamData, MaterialsData, ArcDiskData } from './types';

const STORAGE_KEY = 'yihuan_session_id';

type PageType = 'chat' | 'showcase' | 'manager' | 'settings';

const App: React.FC = () => {
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeForm, setActiveForm] = useState<'chat' | 'team' | 'materials' | 'arcdisk'>('chat');
  const [activePage, setActivePage] = useState<PageType>('chat');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('https://api.deepseek.com/v1/chat/completions');
  const [apiModel, setApiModel] = useState('deepseek-chat');
  const [hasApiKey, setHasApiKey] = useState(false);

  // 移动端响应式：≤768px 切换为抽屉式侧边栏
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [drawerOpen, setDrawerOpen] = useState(false);
  // 云端部署（非 localhost）：/api/exit 不可用，移动端 / 云端隐藏退出按钮
  const isCloud = !['localhost', '127.0.0.1'].includes(typeof window !== 'undefined' ? window.location.hostname : 'localhost');
  const showExitButton = !isMobile && !isCloud;
  // 材料表单 number input：移动端加大触摸热区（≥44px 高）
  const matNumInputStyle: React.CSSProperties = isMobile
    ? { ...numInputStyle, width: 64, padding: '10px 8px' }
    : { ...numInputStyle, width: 50 };
  // 移动端对话气泡 / loading 气泡：稍宽便于阅读
  const bubbleMaxWidth = isMobile ? '88%' : '75%';

  // 加载API Key状态
  useEffect(() => {
    const storedKey = localStorage.getItem('yihuan_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    }
    fetch('/api/settings/apikey')
      .then(res => res.json())
      .then(data => setHasApiKey(data.has_api_key))
      .catch(() => {});
  }, []);

  // Team form state
  const [teamCore, setTeamCore] = useState('');
  const [teamOwned, setTeamOwned] = useState('');
  const [teamPreference, setTeamPreference] = useState('');

  // Materials form state
  const [matChar, setMatChar] = useState('');
  const [matCurLevel, setMatCurLevel] = useState(1);
  const [matTargetLevel, setMatTargetLevel] = useState(80);
  const [matNormalCur, setMatNormalCur] = useState(1);
  const [matNormalTarget, setMatNormalTarget] = useState(1);
  const [matSkillCur, setMatSkillCur] = useState(1);
  const [matSkillTarget, setMatSkillTarget] = useState(1);
  const [matUltimateCur, setMatUltimateCur] = useState(1);
  const [matUltimateTarget, setMatUltimateTarget] = useState(1);

  // ArcDisk form state
  const [arcdiskChar, setArcDiskChar] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 初始化会话
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSessionId(stored);
    } else {
      api.createSession().then(res => {
        setSessionId(res.session_id);
        localStorage.setItem(STORAGE_KEY, res.session_id);
      }).catch(() => {
        const fallback = 'session_' + Date.now();
        setSessionId(fallback);
        localStorage.setItem(STORAGE_KEY, fallback);
      });
    }
  }, []);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const handleSendChat = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    addMessage(userMsg);
    setInput('');
    setLoading(true);
    try {
      const result = await api.sendChat(sessionId, text);
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: result.content,
        type: result.type,
        sources: result.sources,
        suggestions: result.suggestions,
      };
      addMessage(assistantMsg);
    } catch (err: any) {
      addMessage({
        role: 'assistant',
        content: err.message || 'AI服务暂时繁忙，请稍后再试。',
        type: 'text',
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [sessionId, loading, addMessage]);

  const handleSaveApiSettings = async () => {
    try {
      const res = await fetch('/api/settings/apikey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, api_url: apiUrl, model: apiModel })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('yihuan_api_key', apiKey);
        setHasApiKey(true);
        alert('API Key 设置成功！');
      } else {
        alert('设置失败: ' + (data.detail || '未知错误'));
      }
    } catch (err: any) {
      alert('设置失败: ' + err.message);
    }
  };

  const handleTeamSubmit = async () => {
    if (!teamCore.trim() || loading) return;
    const owned = teamOwned.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    const displayMsg = `配队推荐：以「${teamCore}」为核心${owned.length ? `，拥有角色：${owned.join('、')}` : ''}${teamPreference ? `，偏好：${teamPreference}` : ''}`;
    addMessage({ role: 'user', content: displayMsg });
    setLoading(true);
    setActiveForm('chat');
    try {
      const result = await api.getTeamRecommendation(teamCore, owned, teamPreference || undefined);
      if (result.error) {
        addMessage({ role: 'assistant', content: result.error, type: 'text' });
      } else {
        addMessage({ role: 'assistant', content: `已为你生成「${teamCore}」的配队方案：`, type: 'team', data: result as TeamData });
      }
    } catch (err: any) {
      addMessage({ role: 'assistant', content: err.message || 'AI服务暂时繁忙，请稍后再试。', type: 'text' });
    } finally {
      setLoading(false);
      setTeamCore(''); setTeamOwned(''); setTeamPreference('');
    }
  };

  const handleMaterialsSubmit = async () => {
    if (!matChar.trim() || loading) return;
    const displayMsg = `材料计算：将「${matChar}」从${matCurLevel}级升到${matTargetLevel}级，普攻${matNormalCur}→${matNormalTarget}，战技${matSkillCur}→${matSkillTarget}，大招${matUltimateCur}→${matUltimateTarget}`;
    addMessage({ role: 'user', content: displayMsg });
    setLoading(true);
    setActiveForm('chat');
    try {
      const result = await api.calculateMaterials({
        character_name: matChar, current_level: matCurLevel, target_level: matTargetLevel,
        normal_attack: { current: matNormalCur, target: matNormalTarget },
        skill: { current: matSkillCur, target: matSkillTarget },
        ultimate: { current: matUltimateCur, target: matUltimateTarget },
      });
      if (result.error) {
        addMessage({ role: 'assistant', content: result.error, type: 'text' });
      } else {
        addMessage({ role: 'assistant', content: `已为你计算「${matChar}」的养成材料：`, type: 'materials', data: result as MaterialsData });
      }
    } catch (err: any) {
      addMessage({ role: 'assistant', content: err.message || 'AI服务暂时繁忙，请稍后再试。', type: 'text' });
    } finally {
      setLoading(false);
      setMatChar('');
    }
  };

  const handleArcDiskSubmit = async () => {
    if (!arcdiskChar.trim() || loading) return;
    addMessage({ role: 'user', content: `弧盘推荐：${arcdiskChar}` });
    setLoading(true);
    setActiveForm('chat');
    try {
      const result = await api.getArcDiskRecommendation(arcdiskChar);
      if (result.error) {
        addMessage({ role: 'assistant', content: result.error, type: 'text' });
      } else {
        addMessage({ role: 'assistant', content: `已为你推荐「${arcdiskChar}」的弧盘方案：`, type: 'arcdisk', data: result as ArcDiskData });
      }
    } catch (err: any) {
      addMessage({ role: 'assistant', content: err.message || 'AI服务暂时繁忙，请稍后再试。', type: 'text' });
    } finally {
      setLoading(false);
      setArcDiskChar('');
    }
  };

  const handleClear = async () => {
    setMessages([]);
    if (sessionId) { try { await api.clearSession(sessionId); } catch {} }
    inputRef.current?.focus();
  };

  const handleExit = async () => {
    if (!window.confirm('确定要退出吗？将停止后端和前端服务并关闭当前页面。')) return;
    try {
      await fetch('/api/exit', { method: 'POST' });
    } catch {
      // 后端可能在响应后立即被终止，忽略错误
    }
    // 给 stop.bat 一点时间执行，再尝试关闭浏览器标签页
    setTimeout(() => {
      window.open('', '_self');
      window.close();
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(input); }
  };

  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.role === 'user') return <ChatBubble role="user" content={msg.content} />;
    return (
      <div>
        <ChatBubble role="assistant" content={msg.content} />
        {msg.type === 'team' && msg.data && <TeamCard data={msg.data as TeamData} />}
        {msg.type === 'materials' && msg.data && <MaterialTable data={msg.data as MaterialsData} />}
        {msg.type === 'arcdisk' && msg.data && <ArcDiskCard data={msg.data as ArcDiskData} />}
        {msg.suggestions && msg.suggestions.length > 0 && (
          <div style={{ padding: '0 16px', marginTop: -8, marginBottom: 8 }}>
            {msg.suggestions.map((s, i) => (
              <button key={i} onClick={() => handleSendChat(s)} style={{
                margin: '2px 4px', padding: '4px 12px', borderRadius: 14,
                border: '1px solid #667eea', background: '#fff', color: '#667eea', cursor: 'pointer', fontSize: 12,
              }}>{s}</button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const sidebarItems: { key: PageType; icon: string; label: string }[] = [
    { key: 'chat', icon: '🎮', label: 'AI 助手' },
    { key: 'showcase', icon: '📋', label: '数据展示' },
    { key: 'manager', icon: '⚙️', label: '数据管理' },
    { key: 'settings', icon: '🔑', label: 'API 配置' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f5f8' }}>
      {/* 移动端：汉堡按钮 + 遮罩 */}
      {isMobile && (
        <>
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="打开菜单"
            style={{
              position: 'fixed', top: 12, left: 12, zIndex: 900,
              width: 40, height: 40, borderRadius: 8,
              border: 'none', background: 'rgba(26,26,46,0.9)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          {drawerOpen && (
            <div
              onClick={() => setDrawerOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999 }}
            />
          )}
        </>
      )}

      {/* 左侧导航栏（桌面：固定 200px；移动端：抽屉式 fixed） */}
      <aside style={isMobile ? {
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 200, height: '100vh',
        transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease',
        zIndex: 1000,
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '2px 0 12px rgba(0,0,0,0.15)',
      } : {
        width: 200,
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        boxShadow: '2px 0 12px rgba(0,0,0,0.15)',
      }}>
        {/* Logo区域 */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24 }}>🎮</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>异环 AI</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>战术教学助手</div>
            </div>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sidebarItems.map(item => (
            <button
              key={item.key}
              onClick={() => { setActivePage(item.key); setDrawerOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 8,
                border: 'none',
                background: activePage === item.key ? 'rgba(102, 126, 234, 0.3)' : 'transparent',
                color: activePage === item.key ? '#fff' : 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activePage === item.key ? 600 : 400,
                textAlign: 'left',
                transition: 'all 0.2s',
                width: '100%',
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.key === 'settings' && (
                <span style={{
                  marginLeft: 'auto',
                  width: 8, height: 8,
                  borderRadius: '50%',
                  background: hasApiKey ? '#28a745' : '#ffc107',
                }} />
              )}
            </button>
          ))}
        </nav>

        {/* 退出按钮（仅桌面本地显示，移动端/云端隐藏） */}
        {showExitButton && (
          <div style={{ padding: '8px 16px 4px' }}>
            <button
              onClick={handleExit}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '10px 16px',
                borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                boxShadow: '0 2px 8px rgba(220, 53, 69, 0.35)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(135deg, #c82333 0%, #a71d2a 100%)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
              退出
            </button>
          </div>
        )}

        {/* 底部状态 */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          {hasApiKey ? '✓ API 已连接' : '⚠ API 未配置'}
        </div>
      </aside>

      {/* 右侧内容区 */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ===== AI助手页面 ===== */}
        {activePage === 'chat' && (
          <>
            {/* 快捷操作栏 */}
            <div style={{
              display: 'flex', gap: 8,
              padding: isMobile ? '10px 16px 10px 56px' : '10px 16px',
              background: '#fff', borderBottom: '1px solid #e8e8e8', flexShrink: 0, overflowX: 'auto',
              alignItems: 'center',
            }}>
              {[
                { key: 'chat', label: '💬 智能问答' },
                { key: 'team', label: '⚔️ 配队推荐' },
                { key: 'materials', label: '📦 材料计算' },
                { key: 'arcdisk', label: '💎 弧盘推荐' },
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => setActiveForm(item.key as any)}
                  style={{
                    padding: '8px 14px', borderRadius: 20,
                    border: activeForm === item.key ? '2px solid #667eea' : '1px solid #ddd',
                    background: activeForm === item.key ? '#f0f4ff' : '#fff',
                    color: activeForm === item.key ? '#667eea' : '#555',
                    cursor: 'pointer', fontSize: 13,
                    fontWeight: activeForm === item.key ? 600 : 400, whiteSpace: 'nowrap',
                  }}
                >{item.label}</button>
              ))}
              <div style={{ marginLeft: 'auto' }}>
                <button onClick={handleClear} style={{
                  padding: '6px 14px', borderRadius: 8, border: '1px solid #ddd',
                  background: '#fff', color: '#666', cursor: 'pointer', fontSize: 12,
                }}>清空对话</button>
              </div>
            </div>

            {/* 对话区域 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', background: '#f5f5f8' }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🎮</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#666' }}>
                    欢迎使用异环 AI 战术教学助手
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                    你可以问我角色攻略、配队方案、材料计算、弧盘推荐等问题
                    <br />试试问：<span style={{ color: '#667eea' }}>"零怎么配队？"</span>
                  </div>
                </div>
              )}
              {messages.map((msg, idx) => <div key={idx}>{renderMessageContent(msg)}</div>)}
              {loading && (
                <div style={{ padding: '0 16px', marginBottom: 16 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
                    background: '#f0f0f5', borderRadius: '16px 16px 16px 4px', maxWidth: bubbleMaxWidth, color: '#999', fontSize: 13,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#667eea', animation: 'pulse 1.5s infinite' }} />
                    思考中...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div style={{ background: '#fff', borderTop: '1px solid #e8e8e8', padding: '12px 16px', flexShrink: 0 }}>
              {activeForm === 'chat' && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown} placeholder="输入你的问题，如：零怎么配队？" maxLength={200} disabled={loading}
                    style={{ flex: 1, padding: '10px 16px', borderRadius: 24, border: '1px solid #ddd', fontSize: 14, outline: 'none', background: '#f8f9fa' }}
                  />
                  <button onClick={() => handleSendChat(input)} disabled={loading || !input.trim()}
                    style={{
                      padding: '10px 24px', borderRadius: 24, border: 'none',
                      background: loading || !input.trim() ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: '#fff', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600,
                    }}>发送</button>
                </div>
              )}
              {activeForm === 'team' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>配队推荐</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input placeholder="核心角色名称（必填）" value={teamCore} onChange={e => setTeamCore(e.target.value)} style={formInputStyle} />
                    <input placeholder="拥有的角色（逗号分隔）" value={teamOwned} onChange={e => setTeamOwned(e.target.value)} style={{ ...formInputStyle, flex: 2 }} />
                    <input placeholder="玩法偏好（可选）" value={teamPreference} onChange={e => setTeamPreference(e.target.value)} style={formInputStyle} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleTeamSubmit} disabled={loading || !teamCore.trim()} style={submitBtnStyle(loading || !teamCore.trim())}>生成配队</button>
                    <button onClick={() => setActiveForm('chat')} style={cancelBtnStyle}>取消</button>
                  </div>
                </div>
              )}
              {activeForm === 'materials' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>材料计算</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input placeholder="角色名称" value={matChar} onChange={e => setMatChar(e.target.value)} style={formInputStyle} />
                    <span style={{ fontSize: 13 }}>等级：</span>
                    <input type="number" value={matCurLevel} onChange={e => setMatCurLevel(+e.target.value)} min={1} max={80} style={numInputStyle} />
                    <span style={{ fontSize: 13 }}>→</span>
                    <input type="number" value={matTargetLevel} onChange={e => setMatTargetLevel(+e.target.value)} min={1} max={80} style={numInputStyle} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
                    <span>普攻：</span>
                    <input type="number" value={matNormalCur} onChange={e => setMatNormalCur(+e.target.value)} min={1} max={10} style={matNumInputStyle} />
                    <span>→</span>
                    <input type="number" value={matNormalTarget} onChange={e => setMatNormalTarget(+e.target.value)} min={1} max={10} style={matNumInputStyle} />
                    <span style={{ marginLeft: 8 }}>战技：</span>
                    <input type="number" value={matSkillCur} onChange={e => setMatSkillCur(+e.target.value)} min={1} max={10} style={matNumInputStyle} />
                    <span>→</span>
                    <input type="number" value={matSkillTarget} onChange={e => setMatSkillTarget(+e.target.value)} min={1} max={10} style={matNumInputStyle} />
                    <span style={{ marginLeft: 8 }}>大招：</span>
                    <input type="number" value={matUltimateCur} onChange={e => setMatUltimateCur(+e.target.value)} min={1} max={10} style={matNumInputStyle} />
                    <span>→</span>
                    <input type="number" value={matUltimateTarget} onChange={e => setMatUltimateTarget(+e.target.value)} min={1} max={10} style={matNumInputStyle} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleMaterialsSubmit} disabled={loading || !matChar.trim()} style={submitBtnStyle(loading || !matChar.trim())}>计算材料</button>
                    <button onClick={() => setActiveForm('chat')} style={cancelBtnStyle}>取消</button>
                  </div>
                </div>
              )}
              {activeForm === 'arcdisk' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>弧盘推荐</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input placeholder="角色名称" value={arcdiskChar} onChange={e => setArcDiskChar(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleArcDiskSubmit()} style={formInputStyle} />
                    <button onClick={handleArcDiskSubmit} disabled={loading || !arcdiskChar.trim()} style={submitBtnStyle(loading || !arcdiskChar.trim())}>查询弧盘</button>
                    <button onClick={() => setActiveForm('chat')} style={cancelBtnStyle}>取消</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== 数据展示页面 ===== */}
        {activePage === 'showcase' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: '#f5f5f8' }}>
            <h2 style={{ fontSize: 22, color: '#1a1a2e', marginBottom: 16 }}>📋 数据展示中心</h2>
            <DataShowcase />
          </div>
        )}

        {/* ===== 数据管理页面 ===== */}
        {activePage === 'manager' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: '#f5f5f8' }}>
            <DataManager />
          </div>
        )}

        {/* ===== API 配置页面 ===== */}
        {activePage === 'settings' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: '#f5f5f8', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 500, maxWidth: '100%', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginTop: 40 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, color: '#1a1a2e' }}>🔑 API 设置</h2>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>API URL</label>
                <input type="text" value={apiUrl} onChange={e => setApiUrl(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }}
                  placeholder="https://api.deepseek.com/v1/chat/completions" />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>API Key</label>
                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }}
                  placeholder="sk-..." />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>模型名称</label>
                <input type="text" value={apiModel} onChange={e => setApiModel(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }}
                  placeholder="deepseek-chat" />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={handleSaveApiSettings} style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                }}>保存设置</button>
                {hasApiKey && <span style={{ alignSelf: 'center', color: '#28a745', fontSize: 13 }}>✓ 已配置</span>}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 全局样式 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 { margin: 8px 0; font-size: 14px; }
        .markdown-body p { margin: 4px 0; }
        .markdown-body ul, .markdown-body ol { padding-left: 18px; margin: 4px 0; }
        .markdown-body code { background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 3px; font-size: 12px; }
        .markdown-body pre { background: #1a1a2e; color: #e0e0e0; padding: 10px; border-radius: 6px; overflow-x: auto; font-size: 12px; }
        .markdown-body table { border-collapse: collapse; width: 100%; font-size: 12px; }
        .markdown-body th, .markdown-body td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        .markdown-body th { background: #f8f9fa; }
      `}</style>
    </div>
  );
};

const formInputStyle: React.CSSProperties = {
  flex: 1, minWidth: 120, padding: '8px 12px', borderRadius: 8,
  border: '1px solid #ddd', fontSize: 13, outline: 'none', background: '#f8f9fa',
};

const numInputStyle: React.CSSProperties = {
  width: 60, padding: '6px 8px', borderRadius: 6,
  border: '1px solid #ddd', fontSize: 13, textAlign: 'center', outline: 'none',
};

const submitBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '8px 20px', borderRadius: 8, border: 'none',
  background: disabled ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: '#fff', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
});

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 20px', borderRadius: 8, border: '1px solid #ddd',
  background: '#fff', color: '#666', cursor: 'pointer', fontSize: 13,
};

export default App;
