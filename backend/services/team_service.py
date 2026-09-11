"""
[早期版本/当前未接入路由] 配队推荐服务。
现网 /api/team 的配队逻辑已内联在 main.py（规则算法），
对话中的配队则走 chat_service → llm_service.generate_team_from_database。
本文件保留 LLM 结果解析失败时降级为规则模板队的思路，可供后续重构复用。
"""
import json
import os
from typing import List, Optional, Dict
from .retrieval_service import get_character_by_name, get_all_characters
from .llm_service import generate_team_recommendation, call_llm
from path_resolver import get_data_dir

DATA_DIR = get_data_dir()


def _get_fallback_team(core_name: str, owned: List[str]) -> Dict:
    """兆底模板配队推荐（仅使用数据库中真实存在的角色）"""
    all_chars = get_all_characters()
    core = next((c for c in all_chars if c["name"] == core_name), None)
    if not core:
        return {"error": f"未找到角色「{core_name}」"}

    core_synergy = core.get("synergy", [])

    # 按角色定位筛选，优先选择有元素协同的角色
    sub_dps = sorted(
        [c for c in all_chars if c["role"] == "副C" and c["name"] != core_name],
        key=lambda x: (x["element"] not in core_synergy, x["rarity"] != "S", x["name"])
    )
    supports = sorted(
        [c for c in all_chars if c["role"] == "辅助" and c["name"] != core_name],
        key=lambda x: (x["element"] not in core_synergy, x["rarity"] != "S", x["name"])
    )
    sustains = sorted(
        [c for c in all_chars if c["role"] == "生存" and c["name"] != core_name],
        key=lambda x: (x["element"] not in core_synergy, x["rarity"] != "S", x["name"])
    )

    sub = sub_dps[0] if sub_dps else None
    sup = supports[0] if supports else None
    sus = sustains[0] if sustains else None

    team = [{"name": core["name"], "role": "主C", "reason": f"核心输出，{core['element']}元素主C"}]
    if sub:
        team.append({"name": sub["name"], "role": "副C", "reason": f"{sub['element']}元素副C，提供元素反应和补充伤害"})
    if sup:
        team.append({"name": sup["name"], "role": "辅助", "reason": f"{sup['element']}元素辅助，提供增益效果"})
    if sus:
        team.append({"name": sus["name"], "role": "生存", "reason": f"{sus['element']}元素生存，提供护盾/治疗保障生存"})

    # 补齐不足4人的队伍
    used = {m["name"] for m in team}
    for extra in [sub, sup, sus]:
        if len(team) >= 4:
            break
    remaining = [c for c in all_chars if c["name"] not in used and c["name"] != core_name]
    while len(team) < 4 and remaining:
        c = remaining.pop(0)
        team.append({"name": c["name"], "role": c["role"], "reason": f"{c['element']}元素{c['role']}，补充队伍实力"})

    rotation_parts = []
    for m in team:
        if m["role"] == "辅助":
            rotation_parts.append(f"{m['name']}释放辅助技能")
        elif m["role"] == "副C":
            rotation_parts.append(f"{m['name']}战技触发元素反应")
        elif m["role"] == "生存":
            rotation_parts.append(f"{m['name']}提供护盾/治疗")
        else:
            rotation_parts.append(f"{m['name']}进行主要输出")
    rotation = " -> ".join(rotation_parts)

    alternatives = []
    for role_name, pool in [("\u526fC", sub_dps), ("\u8f85\u52a9", supports), ("\u751f\u5b58", sustains)]:
        pool_names = [c["name"] for c in pool]
        team_names = [m["name"] for m in team if m["role"] == role_name]
        for tn in team_names:
            alt = next((n for n in pool_names if n != tn and n not in used), None)
            if alt:
                alternatives.append({"original": tn, "alternative": alt, "reason": f"同为{role_name}定位，可以替换使用"})
                break

    summary = f"以{core['name']}（{core['element']}元素主C）为核心的配队方案，利用元素协同最大化输出，适合大多数战斗场景。"

    return {
        "team": team,
        "rotation": rotation,
        "alternatives": alternatives,
        "summary": summary
    }


async def get_team_recommendation(
    core_name: str,
    owned_characters: List[str],
    preference: Optional[str] = None
) -> Dict:
    """获取配队推荐"""
    core = get_character_by_name(core_name)
    if not core:
        return {"error": f"未找到角色「{core_name}」，请检查角色名称。"}

    # 尝试调用大模型
    llm_result = await generate_team_recommendation(core, owned_characters, preference)

    if llm_result:
        try:
            # 尝试解析JSON
            # 清理可能的markdown代码块
            cleaned = llm_result.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
            result = json.loads(cleaned)
            return result
        except (json.JSONDecodeError, KeyError):
            pass

    # 降级到模板
    return _get_fallback_team(core_name, owned_characters)