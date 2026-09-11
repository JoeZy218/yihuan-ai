/**
 * 后端 API 统一封装层。
 * 所有请求走相对路径 /api/*，由 vite.config.ts 中的 dev proxy 转发到 http://localhost:8000；
 * request() 内置 15s 超时（AbortController）与统一错误提示。
 * 功能分组：会话/问答、配队、材料计算、弧盘卡带、角色统计、（管理类接口在组件内直接 fetch）。
 */
const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  // 用 AbortController 实现请求超时，避免 LLM 长时间无响应时前端一直等待
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${API_BASE}${url}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    clearTimeout(timeoutId);

    if (res.status === 429) {
      throw new Error('当前访问人数较多，请稍后重试。');
    }

    if (!res.ok) {
      throw new Error('AI服务暂时繁忙，请稍后再试。');
    }

    return await res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('请求超时，AI服务暂时繁忙，请稍后再试。');
    }
    throw err;
  }
}

export async function createSession(): Promise<{ session_id: string }> {
  return request('/session', { method: 'POST' });
}

export async function sendChat(sessionId: string, message: string): Promise<any> {
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, message }),
  });
}

export async function getTeamRecommendation(
  coreCharacter: string,
  ownedCharacters: string[],
  preference?: string
): Promise<any> {
  return request('/team', {
    method: 'POST',
    body: JSON.stringify({
      core_char: coreCharacter,
      owned_chars: ownedCharacters,
      play_style: preference,
    }),
  });
}

export async function calculateMaterials(params: {
  character_name: string;
  current_level: number;
  target_level: number;
  normal_attack: { current: number; target: number };
  skill: { current: number; target: number };
  ultimate: { current: number; target: number };
}): Promise<any> {
  return request('/materials', {
    method: 'POST',
    body: JSON.stringify({
      character: params.character_name,
      current_level: params.current_level,
      target_level: params.target_level,
      current_skill_levels: {
        normal: params.normal_attack.current,
        skill: params.skill.current,
        ultimate: params.ultimate.current,
      },
      target_skill_levels: {
        normal: params.normal_attack.target,
        skill: params.skill.target,
        ultimate: params.ultimate.target,
      },
    }),
  });
}

export async function getArcDiskRecommendation(characterName: string): Promise<any> {
  // 调用弧盘（专武）和卡带两个接口并合并结果
  const [arcdiskRes, setRes] = await Promise.all([
    request(`/arcdisk/${encodeURIComponent(characterName)}`),
    request(`/set/${encodeURIComponent(characterName)}`)
  ]);

  return {
    character: characterName,
    element: (arcdiskRes as any).element || (setRes as any).element || '',
    role: (arcdiskRes as any).role || (setRes as any).role || '',
    arcdisk: (arcdiskRes as any).arcdisk ? {
      name: (arcdiskRes as any).arcdisk.name,
      element: (arcdiskRes as any).arcdisk.element || '',
      rarity: (arcdiskRes as any).arcdisk.rarity || '',
      main_attr: (arcdiskRes as any).arcdisk.main_attr || '',
      sub_attr: (arcdiskRes as any).arcdisk.sub_attr || '',
      effect: (arcdiskRes as any).arcdisk.effect || '',
      effect_desc: (arcdiskRes as any).arcdisk.effect_desc || ''
    } : null,
    set: (arcdiskRes as any).set || ((setRes as any).best_set ? {
      name: (setRes as any).best_set,
      set2: (setRes as any).set2,
      set4: (setRes as any).set4,
      main_stats: typeof (setRes as any).main_attr === 'string' 
        ? (() => { try { return JSON.parse((setRes as any).main_attr); } catch { return {}; } })()
        : (setRes as any).main_attr || {},
      sub_priority: (setRes as any).sub_attr || [],
      reason: (setRes as any).reason || ''
    } : null),
    alternatives: (arcdiskRes as any).alternatives || ((setRes as any).alternatives || []).map((name: string) => ({
      name,
      set2: '',
      set4: '',
      reason: ''
    }))
  };
}

export async function clearSession(sessionId: string): Promise<any> {
  return request('/clear', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function getCharacters(): Promise<any[]> {
  return request('/characters');
}

// 角色统计相关
export async function logCharacterView(characterName: string): Promise<any> {
  return request(`/stats/view/${encodeURIComponent(characterName)}`, {
    method: 'POST',
  });
}

export async function logCharacterQuery(characterName: string): Promise<any> {
  return request(`/stats/query/${encodeURIComponent(characterName)}`, {
    method: 'POST',
  });
}

export async function getCharacterStats(): Promise<any[]> {
  return request('/stats/characters');
}

export async function getFavoriteCharacter(): Promise<any> {
  return request('/stats/favorite');
}

export async function getPieChartData(): Promise<any> {
  return request('/stats/pie-chart');
}

export async function resetStats(): Promise<any> {
  return request('/stats/reset', {
    method: 'POST',
  });
}