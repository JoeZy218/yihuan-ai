"""
[早期版本/当前未接入路由] 养成材料计算服务。
现网 /api/materials 的计算逻辑已内联在 main.py（_calc_ascension_materials /
_calc_exp_books / _calc_skill_materials 三个函数），本文件为旧版数据结构实现，保留备查。
"""
import os
import json
from typing import List, Dict, Optional
from collections import defaultdict
from .retrieval_service import get_character_by_name
from path_resolver import get_data_dir

DATA_DIR = get_data_dir()


def _load_materials() -> dict:
    path = os.path.join(DATA_DIR, "materials.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def calculate_materials(
    char_name: str,
    current_level: int,
    target_level: int,
    skill_levels: Dict[str, Dict[str, int]]
) -> Dict:
    """计算角色养成材料"""
    char = get_character_by_name(char_name)
    if not char:
        return {"error": f"未找到角色「{char_name}」"}

    mat_data = _load_materials()
    element = char["element"]
    rarity = char["rarity"]

    result = {
        "character": char_name,
        "element": element,
        "rarity": rarity,
        "ascension": {"from": current_level, "to": target_level, "materials": []},
        "skills": {},
        "total_materials": [],
        "priority": []
    }

    # 计算突破材料
    asc_formula = mat_data["ascension_formula"].get(rarity)
    if asc_formula:
        asc_mats = _calc_ascension(asc_formula, current_level, target_level,
                                   mat_data, element)
        result["ascension"]["materials"] = asc_mats

    # 计算技能材料
    skill_formula = mat_data["skill_formula"].get(rarity)
    if skill_formula:
        for skill_name, levels in skill_levels.items():
            if levels.get("current", 1) < levels.get("target", 1):
                skill_mats = _calc_skill(skill_formula, levels["current"],
                                         levels["target"], mat_data, element)
                result["skills"][skill_name] = {
                    "from": levels["current"],
                    "to": levels["target"],
                    "materials": skill_mats
                }

    # 汇总所有材料
    total = defaultdict(lambda: {"count": 0, "source": ""})
    for mat in result["ascension"]["materials"]:
        total[mat["name"]]["count"] += mat["count"]
        total[mat["name"]]["source"] = mat["source"]

    for skill_name, skill_data in result["skills"].items():
        for mat in skill_data["materials"]:
            total[mat["name"]]["count"] += mat["count"]
            total[mat["name"]]["source"] = mat["source"]

    result["total_materials"] = [
        {"name": k, "count": v["count"], "source": v["source"]}
        for k, v in total.items()
    ]

    # 养成优先级建议
    result["priority"] = _get_priority(char["role"], current_level, target_level,
                                       skill_levels)

    return result


def _calc_ascension(formula: dict, current: int, target: int,
                    mat_data: dict, element: str) -> List[Dict]:
    """计算突破材料"""
    materials = []
    element_mats = mat_data["ascension_materials"][element]
    common_mats = mat_data["common_ascension"]
    specialty = mat_data["specialty_materials"][element]

    for tier in formula["tiers"]:
        if tier["from"] >= target:
            break
        if tier["to"] <= current:
            continue

        # 元素材料
        if tier["tier_count"] > 0:
            materials.append({
                "name": element_mats[tier["tier_mat"]]["name"],
                "count": tier["tier_count"],
                "source": element_mats[tier["tier_mat"]]["source"]
            })

        # 通用材料
        if tier["common_count"] > 0:
            materials.append({
                "name": common_mats[tier["common_mat"]]["name"],
                "count": tier["common_count"],
                "source": common_mats[tier["common_mat"]]["source"]
            })

        # 特殊材料
        if tier.get("specialty", 0) > 0:
            materials.append({
                "name": specialty["name"],
                "count": tier["specialty"],
                "source": specialty["source"]
            })

    return materials


def _calc_skill(formula: list, current: int, target: int,
                mat_data: dict, element: str) -> List[Dict]:
    """计算技能升级材料"""
    materials = []
    element_mats = mat_data["ascension_materials"][element]
    skill_books = mat_data["skill_books"]

    for tier in formula:
        if tier["from"] >= target:
            break
        if tier["to"] <= current:
            continue

        if tier["book_count"] > 0:
            materials.append({
                "name": skill_books[tier["book_tier"]]["name"],
                "count": tier["book_count"],
                "source": skill_books[tier["book_tier"]]["source"]
            })

        if tier["mat_count"] > 0:
            materials.append({
                "name": element_mats[tier["mat_tier"]]["name"],
                "count": tier["mat_count"],
                "source": element_mats[tier["mat_tier"]]["source"]
            })

    return materials


def _get_priority(role: str, current_level: int, target_level: int,
                  skill_levels: Dict[str, Dict[str, int]]) -> List[str]:
    """生成养成优先级建议"""
    priorities = []

    if current_level < target_level:
        priorities.append(f"1. 优先将角色等级从{current_level}升至{target_level}，解锁等级上限")

    if role == "主C":
        has_skill_upgrade = any(
            s.get("target", 1) > s.get("current", 1)
            for s in skill_levels.values()
        )
        if has_skill_upgrade:
            priorities.append("2. 升级大招（核心输出技能）")
            priorities.append("3. 升级战技")
            priorities.append("4. 升级普攻（优先级最低）")
    elif role == "副C":
        priorities.append("2. 建议优先升级战技和大招")
    elif role in ("辅助", "生存"):
        priorities.append("2. 建议优先升级战技（核心增益/护盾技能）")

    priorities.append("提示：突破材料可在对应元素副本获取，技能书在技能副本获取")
    return priorities