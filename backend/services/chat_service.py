"""
聊天服务：智能问答的核心编排层。

process_chat 处理流水线：
  1. 输入校验（长度/黑名单）  → intent_service.validate_input
  2. 问候 / 闲聊识别          → intent_service（直接返回模板话术，不调用 LLM）
  3. 游戏相关性判断           → intent_service.is_game_related
  4. 配队类问题               → 携带全量角色数据交给 LLM 分析（generate_team_from_database）
  5. 通用问题：RAG 检索       → retrieval_service 检索知识库/角色/弧盘/卡带
  6. 组装上下文调用 LLM       → llm_service（真实 API），失败自动降级 mock_llm_service
  7. 个性化：根据 character_stats 表中的"最喜好角色"注入最高优先级约束，
     使配队推荐始终围绕用户最常互动的角色展开。
"""
import os
import json
from typing import List, Dict, Optional

from path_resolver import get_env_path

try:
    from dotenv import load_dotenv
    load_dotenv(get_env_path())
except ImportError:
    pass

from .intent_service import validate_input, is_game_related, REJECT_MESSAGE, is_greeting, is_casual_chat, get_greeting_response, get_casual_response
from .retrieval_service import search_knowledge, get_character_by_name, get_all_characters, search_arcdisks, search_sets, get_arcdisk_by_name, get_set_by_name
from .llm_service import generate_answer as real_generate_answer, generate_team_recommendation as real_generate_team_recommendation, generate_team_from_database
from .mock_llm_service import mock_generate_answer, mock_generate_team_recommendation
from .stats_service import record_character_query, get_favorite_character

# 是否启用真实大模型：未配置 Key 或 Key 仍是占位符时，全程使用本地 mock 回复
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
USE_REAL_LLM = LLM_API_KEY and not LLM_API_KEY.startswith("sk-your-")

# 配队相关关键词
TEAM_KEYWORDS = ['配队', '队伍', '阵容', '搭配', '组队', '组合', '队友', '配装', '推荐角色',
                 '角色推荐', '辅助角色', '生存角色', '输出角色', '主c角色', '副c角色',
                 '推荐辅助', '推荐生存', '推荐输出', '哪些辅助', '哪些生存', '哪些输出',
                 '什么辅助', '什么生存', '什么输出', '辅助推荐', '生存推荐', '输出推荐']


def _extract_core_char(query: str, all_chars: List[dict]) -> Optional[str]:
    """从查询文本中提取核心角色名"""
    for char in all_chars:
        if char['name'] in query:
            return char['name']
    return None


def _rule_based_team(core_char_name: str) -> Optional[dict]:
    """基于规则的配队推荐（不依赖LLM）"""
    core_char = get_character_by_name(core_char_name)
    if not core_char:
        return None
    
    all_chars = get_all_characters()
    core_element = core_char['element']
    core_role = core_char['role']
    core_synergy = core_char.get('synergy', [])
    
    # 构建候选角色列表
    candidates = []
    for char in all_chars:
        if char['name'] == core_char_name:
            continue
        char_element = char['element']
        has_synergy = (char_element in core_synergy or 
                       core_element in char.get('synergy', []))
        candidates.append({
            'name': char['name'],
            'role': char['role'],
            'element': char_element,
            'has_synergy': has_synergy,
            'rarity': char['rarity'],
        })
    
    # 排序：有元素协同优先，稀有度高的优先
    candidates.sort(key=lambda x: (not x['has_synergy'], x['rarity'] != 'SSR', x['name']))
    
    team_members = [{
        'name': core_char_name,
        'role': core_role,
        'reason': f'{core_element}元素核心角色'
    }]
    
    needed_positions = ['副C', '辅助', '生存']
    used_chars = {core_char_name}
    
    for position in needed_positions:
        selected = None
        for c in candidates:
            if c['name'] not in used_chars:
                if c['role'] == position:
                    selected = c
                    break
                elif c['has_synergy'] and not selected:
                    selected = c
        
        if selected:
            used_chars.add(selected['name'])
            team_members.append({
                'name': selected['name'],
                'role': position,
                'reason': f"{selected['element']}元素{selected['role']}，{'与核心角色有元素协同' if selected['has_synergy'] else '提供稳定支持'}"
            })
        else:
            team_members.append({
                'name': f'推荐{position}',
                'role': position,
                'reason': f'建议选择{position}定位的角色'
            })
    
    # 技能循环
    rotation_steps = []
    for m in team_members:
        if m['role'] == '辅助':
            rotation_steps.append(f"{m['name']}释放辅助技能")
        elif m['role'] == '副C':
            rotation_steps.append(f"{m['name']}释放战技触发元素反应")
        elif m['role'] == '生存':
            rotation_steps.append(f"{m['name']}提供护盾/治疗")
        else:
            rotation_steps.append(f"{m['name']}进行主要输出")
    rotation = ' → '.join(rotation_steps)
    
    # 替代方案
    alternatives = []
    for member in team_members[1:]:
        if member['name'].startswith('推荐'):
            continue
        alt_candidates = [c for c in candidates 
                       if c['name'] not in used_chars and c['role'] == member['role']]
        if alt_candidates:
            alternatives.append({
                'original': member['name'],
                'alternative': alt_candidates[0]['name'],
                'reason': f"同为{member['role']}定位，可以替换使用"
            })
    
    # 总结
    team_elements = [core_element] + [m.get('element', '') for m in team_members[1:] if 'element' in m]
    summary = f"以{core_char_name}（{core_element}元素{core_role}）为核心的配队方案，"
    other_elements = set(team_elements) - {core_element, ''}
    if other_elements:
        summary += f"搭配{', '.join(other_elements)}元素角色形成元素协同，"
    summary += "最大化输出伤害。"
    
    return {
        'core': core_char_name,
        'team': team_members,
        'positions': ['主C', '副C', '辅助', '生存'],
        'rotation': rotation,
        'alternatives': alternatives,
        'summary': summary
    }

async def generate_answer(query: str, context_entries: List[dict], history: List[Dict[str, str]]) -> str:
    if USE_REAL_LLM:
        try:
            result = await real_generate_answer(query, context_entries, history)
            if result != "AI服务暂时繁忙，请稍后再试。":
                return result
        except Exception:
            pass
    return await mock_generate_answer(query, context_entries, history)

async def generate_team_recommendation(core_character: dict, owned_characters: List[str], preference: Optional[str]) -> str:
    if USE_REAL_LLM:
        try:
            result = await real_generate_team_recommendation(core_character, owned_characters, preference)
            if result and result != "AI服务暂时繁忙，请稍后再试。":
                return result
        except Exception:
            pass
    return await mock_generate_team_recommendation(core_character, owned_characters, preference)


def is_team_query(query: str) -> bool:
    """判断是否为配队相关问题"""
    query_lower = query.lower()
    return any(kw in query_lower for kw in TEAM_KEYWORDS)


async def process_chat(
    query: str,
    history: List[Dict[str, str]]
) -> Dict:
    """处理智能问答请求"""
    print(f"[CHAT SERVICE] Query: {repr(query)}")
    
    # 1. 输入验证
    blocked, msg = validate_input(query)
    print(f"[CHAT SERVICE] validate_input: blocked={blocked}, msg={repr(msg)}")
    if blocked:
        return {"type": "reject", "content": msg}

    # 2. 问候识别（优先于游戏相关判断）
    if is_greeting(query):
        print(f"[CHAT SERVICE] Greeting detected")
        return {"type": "answer", "content": get_greeting_response(), "sources": [], "suggestions": ["新手入门指南", "角色推荐", "配队推荐"]}

    # 3. 闲聊/日常对话识别
    casual_type = is_casual_chat(query)
    if casual_type:
        print(f"[CHAT SERVICE] Casual chat: {casual_type}")
        return {"type": "answer", "content": get_casual_response(casual_type), "sources": [], "suggestions": []}

    # 4. 意图识别
    game_related = is_game_related(query)
    print(f"[CHAT SERVICE] is_game_related: {game_related}")
    if not game_related:
        print(f"[CHAT SERVICE] Rejected: not game related")
        return {"type": "reject", "content": REJECT_MESSAGE}

    # 3. 检查是否为配队相关问题
    if is_team_query(query) and USE_REAL_LLM:
        print(f"[CHAT SERVICE] Detected team query, using AI analysis")
        all_chars = get_all_characters()
        
        # 注入用户喜好角色信息 - 确保必须以喜好角色为核心
        favorite = get_favorite_character()
        print(f"[CHAT SERVICE] Favorite character data: {favorite}")
        
        if favorite and favorite.get('character_name') and favorite.get('total_count', 0) > 0:
            fav_char = get_character_by_name(favorite['character_name'])
            print(f"[CHAT SERVICE] Found favorite character: {fav_char['name'] if fav_char else 'None'}")
            
            if fav_char:
                # 确保喜好角色在角色列表最前面
                all_chars = [fav_char] + [c for c in all_chars if c['name'] != fav_char['name']]
                print(f"[CHAT SERVICE] ✓ Injected favorite character: {fav_char['name']} (total: {favorite['total_count']})")
                print(f"[CHAT SERVICE] Total characters: {len(all_chars)}, First char: {all_chars[0]['name']}")
        else:
            print(f"[CHAT SERVICE] ⚠ No favorite character found or total_count is 0")
        
        team_answer = await generate_team_from_database(query, all_chars)
        
        sources = [{"title": f"角色：{char['name']}", "similarity": 1.0} for char in all_chars[:5]]
        
        return {
            "type": "answer",
            "content": team_answer,
            "sources": sources,
            "suggestions": []
        }

    # 4. 知识库检索
    kb_results = search_knowledge(query, top_k=3, threshold=0.5)

    # 5. 角色数据检索 - 支持模糊匹配
    char_results = []
    all_chars = get_all_characters()
    
    # 首先尝试精确匹配（包含完整角色名）
    for char in all_chars:
        if char["name"] in query:
            char_results.append(char)
            # 记录查询统计
            record_character_query(char["name"])
    
    # 如果没有精确匹配，尝试模糊匹配（角色名的关键字）
    if not char_results:
        for char in all_chars:
            # 提取角色名的核心部分（去除前缀如"异能者·"）
            name_parts = char["name"].split("·")
            for part in name_parts:
                if len(part) >= 2 and part in query:  # 至少2个字符才匹配
                    char_results.append(char)
                    # 记录查询统计
                    record_character_query(char["name"])
                    break
    
    # 5.1 如果查询涉及角色定位但没有匹配到具体角色，注入全部角色列表防止AI编造
    role_keywords = ['辅助', '生存', '输出', '主C', '副C', '坦克', '奶妈', '治疗', '角色']
    if not char_results and any(kw in query for kw in role_keywords):
        char_results = all_chars

    # 6. 弧盘数据检索
    arcdisk_results = search_arcdisks(query, top_k=3)
    
    # 7. 套装数据检索
    set_results = search_sets(query, top_k=3)

    # 8. 合并上下文数据
    context_entries = []
    
    # 添加角色信息
    for char in char_results:
        char_info = f"名称：{char['name']}\n元素：{char['element']}\n定位：{char['role']}\n稀有度：{char['rarity']}\n普攻：{char['skills']['normal']}\n战技：{char['skills']['skill']}\n大招：{char['skills']['ultimate']}"
        
        # 添加弧盘信息
        if char.get('best_arcdisk'):
            arcdisk = get_arcdisk_by_name(char['best_arcdisk'])
            if arcdisk:
                char_info += f"\n最佳弧盘：{arcdisk['name']}\n弧盘效果：{arcdisk['effect']} - {arcdisk['effect_desc']}\n弧盘属性：攻击力+{arcdisk['attack']}, 防御力+{arcdisk['defense']}, 生命值+{arcdisk['hp']}"
        
        # 添加套装信息
        if char.get('best_set'):
            set_data = get_set_by_name(char['best_set'])
            if set_data:
                char_info += f"\n最佳套装：{set_data['name']}\n2件套效果：{set_data['set2']}\n4件套效果：{set_data['set4']}"
        
        char_info += f"\n元素协同：{','.join(char['synergy'])}"
        
        context_entries.append({
            "entry": {
                "title": f"角色：{char['name']}",
                "content": char_info,
                "keywords": [char["name"], char["element"], char["role"]]
            },
            "similarity": 1.0  # 精确匹配
        })
    
    # 添加弧盘信息
    for disk in arcdisk_results:
        context_entries.append({
            "entry": {
                "title": f"弧盘：{disk['name']}",
                "content": f"名称：{disk['name']}\n元素：{disk['element']}\n稀有度：{disk['rarity']}\n属性：攻击力+{disk['attack']}, 防御力+{disk['defense']}, 生命值+{disk['hp']}\n效果：{disk['effect']}\n效果描述：{disk['effect_desc']}\n适用角色：{', '.join(disk['suitable'])}",
                "keywords": [disk['name'], disk['element'], "弧盘", "专武"]
            },
            "similarity": 0.9
        })
    
    # 添加套装信息
    for s in set_results:
        context_entries.append({
            "entry": {
                "title": f"卡带：{s['name']}",
                "content": f"名称：{s['name']}\n2件套效果：{s['set2']}\n4件套效果：{s['set4']}\n主属性推荐：{s['main_attr']}\n副词条优先级：{', '.join(s['sub_attr'])}\n适用角色：{', '.join(s['suitable'])}",
                "keywords": [s['name'], "卡带"]
            },
            "similarity": 0.9
        })
    
    # 添加知识库信息
    context_entries.extend(kb_results)
    
    # 8.1 注入用户喜好角色信息（如果有）- 强化优先级
    favorite = get_favorite_character()
    if favorite and favorite['character_name'] and favorite['total_count'] > 0:
        fav_char = get_character_by_name(favorite['character_name'])
        if fav_char:
            # 检查查询是否涉及角色推荐/配队
            recommend_keywords = ['推荐', '配队', '队伍', '阵容', '搭配', '角色', '辅助', '生存', '输出', '主c', '副c']
            is_recommend_query = any(kw in query.lower() for kw in recommend_keywords)
            
            if is_recommend_query:
                # 强化提示：明确要求必须以喜好角色为核心
                context_entries.insert(0, {
                    "entry": {
                        "title": f"【最高优先级】用户喜好角色：{fav_char['name']}",
                        "content": f"""⚠️【核心约束 - 必须遵守】⚠️
用户最喜好的角色是【{fav_char['name']}】（{fav_char['element']}元素 · {fav_char['role']} · 稀有度{fav_char['rarity']}），累计互动{favorite['total_count']}次，是所有角色中最高的。

🚨 在回答本次问题时，你必须：
1. 以【{fav_char['name']}】作为队伍的核心角色（主C或核心输出位）
2. 围绕【{fav_char['name']}】的{fav_char['element']}元素特性选择其他角色
3. 优先推荐与【{fav_char['name']}】有元素协同效果的角色
4. 在技能循环中确保【{fav_char['name']}】处于核心输出位置

❌ 禁止：
- 不要将【{fav_char['name']}】放在辅助或次要位置
- 不要推荐以其他角色为核心的配队方案
- 除非用户明确要求其他角色，否则始终以{fav_char['name']}为中心

请基于以上约束，为用户推荐以【{fav_char['name']}】为核心的最佳配队方案。""",
                        "keywords": [fav_char['name'], "用户喜好", "核心角色", "最高优先级", "必须遵守"]
                    },
                    "similarity": 2.0  # 最高优先级，确保LLM会注意到
                })
                
                # 同时确保喜好角色在角色列表的最前面
                if fav_char not in char_results:
                    char_results.insert(0, fav_char)

    # 9. 调用大模型生成答案（即使无匹配也尝试回答）
    answer = await generate_answer(query, context_entries, history)

    sources = []
    if char_results:
        for char in char_results:
            sources.append({"title": f"角色：{char['name']}", "similarity": 1.0})
    if arcdisk_results:
        for disk in arcdisk_results:
            sources.append({"title": f"弧盘：{disk['name']}", "similarity": 0.9})
    if set_results:
        for s in set_results:
            sources.append({"title": f"卡带：{s['name']}", "similarity": 0.9})
    if kb_results:
        sources.extend([{"title": r["entry"]["title"], "similarity": round(r["similarity"], 2)} for r in kb_results])

    return {
        "type": "answer" if context_entries else "no_match",
        "content": answer,
        "sources": sources,
        "suggestions": [] if context_entries else ["试试问角色攻略", "试试问配队推荐", "试试问弧盘/卡带推荐", "试试问材料计算"]
    }