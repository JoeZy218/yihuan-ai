"""
大模型服务：封装 OpenAI 兼容的 Chat Completions 接口（默认 DeepSeek）。

- call_llm：底层 HTTP 调用，超时/失败自动重试（MAX_RETRIES 次，递增退避）
- generate_answer：RAG 问答，把检索到的游戏资料 + 最近对话历史拼入 prompt
- generate_team_from_database：配队专用，把全量角色清单注入 prompt
- SYSTEM_PROMPT 的核心约束：只能依据给定资料作答、严禁编造角色名，
  并强制遵守"用户喜好角色"为配队核心（防幻觉设计）
配置来自环境变量 / .env：LLM_API_KEY、LLM_API_URL、LLM_MODEL、LLM_TIMEOUT
"""
import os
import json
import httpx
import asyncio
from typing import Optional, List, Dict

from path_resolver import get_env_path, get_data_dir

try:
    from dotenv import load_dotenv
    load_dotenv(get_env_path())
except ImportError:
    pass

LLM_API_URL = os.environ.get("LLM_API_URL", "https://api.deepseek.com/v1/chat/completions")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_MODEL = os.environ.get("LLM_MODEL", "deepseek-chat")
LLM_TIMEOUT = float(os.environ.get("LLM_TIMEOUT", "10"))
MAX_RETRIES = 2

SYSTEM_PROMPT = """你是《异环》游戏的AI战术教学助手。你只能回答与《异环》游戏相关的问题。

重要规则：
1. 你必须严格基于提供的游戏资料回答问题，不能编造或臆测任何数据
2. 如果用户询问的角色、弧盘、套装等信息不在提供的资料中，请明确告知"数据库中暂无该信息"
3. 回答时请引用具体的游戏数据（如角色属性、技能描述、套装效果等）
4. 不要提供任何数据库中没有的角色、装备或套装信息
5. 如果资料中没有相关信息，请如实说明，不要猜测
6. 【极重要】绝对禁止编造不存在的角色名称！只能推荐资料中明确列出的角色。如果资料中没有角色数据，请告知用户"当前暂无相关角色数据"，切勿自行创造角色名。
7. 【最高优先级 - 用户喜好角色约束】如果游戏资料中标注了"用户喜好角色"或"最高优先级"信息，你必须在推荐角色和配队方案时严格遵守：
   - 必须以该喜好角色作为队伍的核心（主C或核心输出位）
   - 围绕该角色的元素特性选择其他搭配角色
   - 不要将该角色放在辅助或次要位置
   - 在技能循环描述中确保该角色处于核心输出位置
   - 除非用户明确要求其他角色，否则始终以该喜好角色为中心进行推荐

你的回答应准确、专业，基于提供的游戏资料。
如果用户问题与游戏无关，礼貌拒绝。
回答时使用中文，支持Markdown格式。"""


async def call_llm(
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 1000,
    timeout: float = None
) -> Optional[str]:
    """调用大模型API，支持自动重试"""
    if timeout is None:
        timeout = LLM_TIMEOUT
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {LLM_API_KEY}"
    }

    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens
    }

    last_error = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(LLM_API_URL, json=payload, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    last_error = f"HTTP {response.status_code}: {response.text[:200]}"
        except httpx.TimeoutException:
            last_error = "请求超时"
        except Exception as e:
            last_error = str(e)

        if attempt < MAX_RETRIES:
            await asyncio.sleep(1 * (attempt + 1))  # 递增等待

    print(f"LLM调用失败（已重试{MAX_RETRIES}次）: {last_error}")
    return None


async def generate_answer(
    query: str,
    context_entries: List[dict],
    history: List[Dict[str, str]]
) -> str:
    """基于检索资料和对话历史生成答案"""
    # 构建上下文
    context_text = ""
    if context_entries:
        context_text = "【游戏资料】\n"
        for i, item in enumerate(context_entries, 1):
            entry = item["entry"]
            context_text += f"{i}. {entry['title']}\n{entry['content']}\n\n"

    # 构建消息
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # 添加对话历史（最近10轮）
    for h in history[-20:]:  # 10轮 = 最多20条消息
        messages.append(h)

    # 添加当前问题
    user_content = query
    if context_text:
        # 检查是否有用户喜好角色信息
        has_favorite_char = any("最高优先级" in item.get("entry", {}).get("title", "") or "用户喜好角色" in item.get("entry", {}).get("title", "") for item in context_entries)
        
        user_content = f"{context_text}\n【用户问题】\n{query}\n\n请严格基于以上游戏资料回答用户问题。重要提示：\n1. 只使用资料中明确提供的数据，不要编造任何信息\n2. 如果资料中没有相关信息，请明确告知用户\n3. 引用具体的角色属性、技能、套装效果等数据\n4. 【极重要】绝对禁止编造不存在的角色名称！只能从上述资料中列出的角色里进行推荐，不得自行创造角色名"
        
        if has_favorite_char:
            user_content += "\n5. 【最高优先级】游戏资料中已标注用户的喜好角色，你在推荐配队方案时必须严格遵守，以该喜好角色为核心构建队伍，不要将其放在辅助或次要位置！"
    else:
        user_content = f"【用户问题】\n{query}\n\n注意：当前数据库中没有找到与该问题相关的角色数据。如果用户询问角色推荐，请告知用户当前暂无相关数据，请提供具体角色名称后再查询。绝对禁止编造不存在的角色名称！"

    messages.append({"role": "user", "content": user_content})

    result = await call_llm(messages)
    if result is None:
        return "AI服务暂时繁忙，请稍后再试。"

    return result


async def generate_team_recommendation(
    core_character: dict,
    owned_characters: List[str],
    preference: Optional[str]
) -> str:
    """生成配队推荐"""
    all_chars = []
    char_path = os.path.join(get_data_dir(), "characters.json")
    with open(char_path, "r", encoding="utf-8") as f:
        all_chars = json.load(f)

    owned_list = [c for c in all_chars if c["name"] in owned_characters]
    owned_names = [c["name"] for c in owned_list]

    prompt = f"""请为《异环》游戏推荐以「{core_character['name']}」({core_character['element']}元素·{core_character['role']})为核心的配队方案。

核心角色信息：
- 名称：{core_character['name']}
- 元素：{core_character['element']}
- 定位：{core_character['role']}
- 技能：普攻-{core_character['skills']['normal']}，战技-{core_character['skills']['skill']}，大招-{core_character['skills']['ultimate']}
- 最佳元素搭配：{', '.join(core_character.get('synergy', []))}

用户拥有的角色：{', '.join(owned_names) if owned_names else '未指定'}
玩法偏好：{preference or '未指定'}

请按以下JSON格式返回配队方案（只返回JSON，不要其他内容）：
{{
  "team": [
    {{"name": "角色名", "role": "主C/副C/辅助/生存", "reason": "选择理由"}}
  ],
  "rotation": "技能循环/输出顺序简述",
  "alternatives": [
    {{"original": "原角色名", "alternative": "替代角色名", "reason": "替代理由"}}
  ],
  "summary": "整体推荐理由"
}}

要求：
1. 队伍必须包含4个角色，核心角色{core_character['name']}必须在队伍中
2. 队伍应包含1主C + 1副C + 1辅助 + 1生存的标准配置
3. 优先从用户拥有的角色中选择
4. 考虑元素共鸣和元素反应"""

    messages = [
        {"role": "system", "content": "你是《异环》游戏配队专家，只输出JSON格式结果。"},
        {"role": "user", "content": prompt}
    ]

    result = await call_llm(messages, temperature=0.5, max_tokens=800)
    return result


async def generate_arcdisk_recommendation(
    character: dict,
    all_arcdisks: List[dict],
    all_sets: List[dict]
) -> dict:
    """基于数据库中的弧盘和套装信息，AI分析并推荐最佳配装方案"""
    
    # 构建弧盘列表信息
    arcdisk_info = "【数据库中的所有弧盘】\n"
    for disk in all_arcdisks:
        arcdisk_info += f"- 名称：{disk['name']}\n"
        arcdisk_info += f"  元素：{disk['element']}, 稀有度：{disk['rarity']}\n"
        arcdisk_info += f"  属性：攻击力+{disk['attack']}, 防御力+{disk['defense']}, 生命值+{disk['hp']}\n"
        arcdisk_info += f"  效果：{disk['effect']} - {disk['effect_desc']}\n"
        arcdisk_info += f"  适用角色：{', '.join(disk.get('suitable', []))}\n\n"
    
    # 构建套装列表信息
    set_info = "【数据库中的所有套装】\n"
    for s in all_sets:
        set_info += f"- 名称：{s['name']}\n"
        set_info += f"  2件套效果：{s['set2']}\n"
        set_info += f"  4件套效果：{s['set4']}\n"
        set_info += f"  主属性推荐：{s.get('main_attr', {})}\n"
        set_info += f"  副词条优先级：{', '.join(s.get('sub_attr', []))}\n"
        set_info += f"  适用角色：{', '.join(s.get('suitable', []))}\n\n"
    
    # 角色信息
    char_info = f"""【角色信息】
名称：{character['name']}
元素：{character['element']}
定位：{character['role']}
稀有度：{character['rarity']}
技能：
- 普攻：{character['skills']['normal']}
- 战技：{character['skills']['skill']}
- 大招：{character['skills']['ultimate']}
元素协同：{', '.join(character.get('synergy', []))}
最佳弧盘（数据库标记）：{character.get('best_arcdisk', '未指定')}
最佳套装（数据库标记）：{character.get('best_set', '未指定')}"""
    
    prompt = f"""{char_info}

{arcdisk_info}

{set_info}

请分析以上角色特点和数据库中的所有弧盘、套装信息，为该角色推荐最佳配装方案。

分析要求：
1. 根据角色的元素、定位、技能特点，分析最适合的弧盘和套装
2. 优先考虑数据库中标记的"适用角色"包含该角色的弧盘和套装
3. 考虑元素匹配和属性加成的协同效果
4. 如果数据库中没有完全匹配的，选择最接近的替代方案

请按以下JSON格式返回推荐结果（只返回JSON，不要其他内容）：
{{
  "arcdisk": {{
    "name": "推荐的弧盘名称",
    "reason": "选择理由（分析角色特点与弧盘效果的匹配度）"
  }},
  "set": {{
    "name": "推荐的套装名称",
    "reason": "选择理由（分析角色特点与套装效果的匹配度）"
  }},
  "alternatives": [
    {{
      "name": "备选套装名称",
      "reason": "作为备选的理由"
    }}
  ],
  "summary": "整体配装思路总结"
}}"""

    messages = [
        {"role": "system", "content": "你是《异环》游戏装备分析专家，必须严格基于提供的数据库信息进行分析和推荐，不能编造不存在的装备。只输出JSON格式结果。"},
        {"role": "user", "content": prompt}
    ]

    result = await call_llm(messages, temperature=0.3, max_tokens=1000)
    
    if result is None:
        return None
    
    # 尝试解析JSON
    try:
        # 提取JSON部分
        json_start = result.find('{')
        json_end = result.rfind('}') + 1
        if json_start != -1 and json_end > json_start:
            return json.loads(result[json_start:json_end])
    except:
        pass
    
    return None


async def generate_team_from_database(
    query: str,
    all_characters: List[dict]
) -> str:
    """基于数据库中所有角色信息，AI分析并给出配队推荐"""
    from .stats_service import get_favorite_character
    from .retrieval_service import get_character_by_name
    
    # 构建精简角色列表（仅包含关键信息，不含完整技能描述以减小prompt体积）
    total = len(all_characters)
    # 构建角色名列表，用于强化约束
    name_list = '、'.join([c['name'] for c in all_characters])
    char_info = f"【数据库中的所有角色（共{total}个）】\n"
    for char in all_characters:
        synergy = ', '.join(char.get('synergy', [])) or '无'
        char_info += f"- {char['name']}：{char['element']}元素·{char['role']}（{char['rarity']}），协同：{synergy}\n"
    
    # 检查是否有喜好角色
    favorite_constraint = ""
    favorite = get_favorite_character()
    if favorite and favorite.get('character_name') and favorite.get('total_count', 0) > 0:
        fav_char = get_character_by_name(favorite['character_name'])
        if fav_char:
            favorite_constraint = f"""

⚠️⚠️⚠️【最高优先级 - 用户喜好角色约束 - 必须严格遵守】⚠️⚠️⚠️
用户最喜好的角色是【{fav_char['name']}】（{fav_char['element']}元素·{fav_char['role']}·稀有度{fav_char['rarity']}），累计互动{favorite['total_count']}次，是所有角色中最高的。

🚨 你在推荐配队方案时必须：
1. 以【{fav_char['name']}】作为队伍的【核心角色】（主C或核心输出位），不要将其放在副C、辅助或生存位
2. 围绕【{fav_char['name']}】的{fav_char['element']}元素特性，选择与之有元素协同的其他角色
3. 在技能循环描述中，确保【{fav_char['name']}】处于核心输出位置
4. 整个队伍必须围绕【{fav_char['name']}】构建

❌ 绝对禁止：
- 不要将【{fav_char['name']}】放在辅助、副C或次要位置
- 不要推荐以其他角色（如{all_characters[0]['name'] if all_characters else ''}等）为核心的配队方案
- 除非用户明确要求，否则必须以{fav_char['name']}为队伍核心
"""
    
    prompt = f"""{char_info}

以上是《异环》数据库中的全部{total}个角色。完整角色名单：{name_list}。
除了以上{total}个角色外，不存在任何其他角色。
{favorite_constraint}
用户问题：{query}

请基于以上角色信息为用户推荐配队方案。

严格要求：
1. 只能从上述{total}个角色中选择，绝对不能编造不存在的角色名
2. 如果用户问的是某类角色推荐（如"辅助角色推荐"），请先列出数据库中该定位的所有角色，再给出配队建议
3. 根据角色的元素、定位进行搭配
4. 队伍应包含1主C + 1副C + 1辅助 + 1生存
5. 说明每个角色的选择理由
{f"6. 【最高优先级】必须以【{fav_char['name']}】为核心构建队伍，{fav_char['name']}必须在主C或核心输出位" if favorite_constraint else ""}

请用中文简洁回答，包含：推荐队伍成员及定位、选择理由、技能循环建议。"""

    system_prompt = "你是《异环》游戏配队专家。你必须且只能从用户提供的角色列表中选择角色，绝对不能编造不在列表中的角色名称。如果编造了不存在的角色，将导致严重错误。"
    if favorite_constraint:
        system_prompt += f"【重要】用户喜好角色是{fav_char['name']}，你必须以该角色为核心构建队伍，将其放在主C或核心输出位，不得将其放在辅助或次要位置。"
    system_prompt += "用中文简洁回答。"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt}
    ]

    result = await call_llm(messages, temperature=0.3, max_tokens=800, timeout=60)
    return result if result else "AI服务暂时繁忙，请稍后再试。"