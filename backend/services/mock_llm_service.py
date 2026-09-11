"""
本地 Mock 大模型：未配置 API Key 或真实 LLM 调用失败时的兜底回复。
按关键词（配队/角色/弧盘/材料/套装/攻略）从预设模板中随机选择一条返回，
保证系统在离线状态下仍可演示完整对话流程。
"""
import random
from typing import Optional, List, Dict

MOCK_RESPONSES = {
    "配队": [
        "根据你的需求，推荐以下配队方案：\n\n**推荐队伍**：\n- 零（主C）：冰元素输出核心\n- 焰火（副C）：提供火元素伤害\n- 清风（辅助）：加速技能循环\n- 山石（生存）：提供护盾保护\n\n**技能循环**：先释放清风技能加速，然后山石开盾，焰火放技能触发元素反应，最后零放大招输出。",
        "建议以零为核心的配队：\n\n**队伍配置**：零 + 焰火 + 水木 + 山石\n\n**定位**：\n- 零：主C（冰元素输出）\n- 焰火：副C（火元素输出）\n- 水木：辅助（治疗回复）\n- 山石：生存（护盾保护）\n\n**打法思路**：利用元素反应提升输出，注意保持护盾覆盖。"
    ],
    "角色": [
        "零是《异环》中的冰元素角色，定位为输出型角色。\n\n**技能介绍**：\n- 普攻：冰刺突刺，造成冰元素伤害\n- 战技：冰域爆发，对范围内敌人造成大量冰元素伤害\n- 大招：永冻领域，冻结敌人并造成持续冰元素伤害\n\n**配装建议**：优先选择冰元素伤害加成和暴击率属性。",
        "焰火是火元素输出角色，擅长持续输出和范围伤害。\n\n**技能特点**：\n- 普通攻击附带灼烧效果\n- 战技能引爆灼烧造成额外伤害\n- 大招可以触发元素反应，造成高额伤害\n\n**最佳搭档**：与冰元素角色配合触发融化反应。"
    ],
    "弧盘": [
        "推荐使用「永冻之心」弧盘，这是零的专属弧盘。\n\n**属性**：\n- 攻击力：42\n- 效果：释放大招后冰元素伤害提升25%\n- 适合场景：输出循环稳定的队伍\n\n**替代选择**：如果没有专属弧盘，可以使用同元素的其他SSR弧盘过渡。",
        "弧盘选择建议：\n\n**输出角色**：优先选择攻击力和元素伤害加成\n**辅助角色**：优先选择能量回复和技能冷却\n**生存角色**：优先选择生命值和防御力\n\n记得根据角色定位选择合适的弧盘！"
    ],
    "材料": [
        "零的突破材料需求：\n\n**等级突破**：\n- 冰元素结晶 x 45\n- 通用突破素材 x 30\n- 金币 x 50000\n\n**技能升级**：\n- 技能书 x 20\n- 冰元素结晶 x 30\n- 金币 x 80000\n\n建议优先提升大招等级，输出提升最明显。",
        "角色培养材料获取途径：\n\n**元素材料**：对应元素的副本\n**技能书**：周三/周六/周日的技能书副本\n**通用材料**：日常任务和活动奖励\n\n合理规划体力使用，优先培养主力角色！"
    ],
    "套装": [
        "推荐使用「失落光芒」卡带：\n\n**2件套效果**：光属性伤害+10%\n**4件套效果**：开大后获得持20秒的25%无视防御\n\n**主属性选择**：\n- 位置1：攻击力\n- 位置2：攻击力\n- 位置3：光属性伤害加成\n- 位置4：暴击率\n\n**副属性优先级**：暴击率 > 暴击伤害 > 攻击力"
    ],
    "攻略": [
        "战斗技巧分享：\n\n1. **元素反应**：合理利用元素克制关系\n2. **技能循环**：掌握技能释放顺序\n3. **队伍搭配**：确保输出、辅助、生存平衡\n4. **资源管理**：优先培养主力角色\n\n多练习才能掌握游戏精髓！",
        "新手入门指南：\n\n1. 完成主线任务获取初始角色\n2. 优先升级队伍等级和角色等级\n3. 了解每个角色的定位和技能\n4. 参加日常活动获取资源\n5. 加入公会获取更多奖励\n\n祝你游戏愉快！"
    ]
}

async def mock_call_llm(
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 1000
) -> Optional[str]:
    user_message = messages[-1]["content"] if messages else ""
    
    if "配队" in user_message or "队伍" in user_message or "阵容" in user_message:
        return random.choice(MOCK_RESPONSES["配队"])
    elif "角色" in user_message or "技能" in user_message:
        return random.choice(MOCK_RESPONSES["角色"])
    elif "弧盘" in user_message or "武器" in user_message:
        return random.choice(MOCK_RESPONSES["弧盘"])
    elif "材料" in user_message or "突破" in user_message or "升级" in user_message:
        return random.choice(MOCK_RESPONSES["材料"])
    elif "卡带" in user_message or "套装" in user_message:
        return random.choice(MOCK_RESPONSES["套装"])
    elif "攻略" in user_message or "技巧" in user_message or "指南" in user_message:
        return random.choice(MOCK_RESPONSES["攻略"])
    else:
        return """我是你的异环游戏助手小环！😊

我可以帮你解答以下问题：
- 👤 **角色攻略**：技能解析和培养建议
- ⚔️ **配队推荐**：根据核心角色推荐队伍
- 💎 **弧盘推荐**：专武选择和属性分析
- 🎯 **卡带推荐**：卡带选择和词条搭配
- 📦 **材料查询**：突破材料和获取途径

你可以这样问我：
- 「小吱怎么配队？」
- 「九原用什么弧盘？」
- 「白藏推荐什么卡带？」
"""

async def mock_generate_answer(
    query: str,
    context_entries: List[dict],
    history: List[Dict[str, str]]
) -> str:
    messages = [{"role": "user", "content": query}]
    result = await mock_call_llm(messages)
    if result is None:
        return "AI服务暂时繁忙，请稍后再试。"
    return result

async def mock_generate_team_recommendation(
    core_character: dict,
    owned_characters: List[str],
    preference: Optional[str]
) -> str:
    team = {
        "team": [
            {"name": core_character["name"], "role": "主C", "reason": f"{core_character['name']}作为核心输出"},
            {"name": "焰火", "role": "副C", "reason": "提供元素反应伤害"},
            {"name": "水木", "role": "辅助", "reason": "提供治疗和增益"},
            {"name": "山石", "role": "生存", "reason": "提供护盾保护"}
        ],
        "rotation": f"先使用水木技能提供增益，然后山石开盾，焰火放技能触发元素反应，最后{core_character['name']}放大招输出",
        "alternatives": [
            {"original": "焰火", "alternative": "清风", "reason": "如果没有焰火，可以用清风提供加速"},
            {"original": "水木", "alternative": "冰雪", "reason": "冰雪可以提供控制效果"}
        ],
        "summary": f"以{core_character['name']}为核心的标准配队，兼顾输出和生存能力"
    }
    import json
    return json.dumps(team, ensure_ascii=False)