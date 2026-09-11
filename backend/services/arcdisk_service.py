"""
[早期版本/当前未接入路由] 弧盘推荐服务。
现网 /api/arcdisk 的推荐逻辑已内联在 main.py（按 suitable → best_arcdisk →
同元素 → 通用 的优先级规则匹配），本文件为旧版实现，保留备查。
"""
from typing import Dict, Optional, List
from .retrieval_service import get_character_by_name, get_arcdisk_by_name, get_all_arcdisks


def get_arcdisk_recommendation(char_name: str) -> Dict:
    """获取弧盘推荐"""
    char = get_character_by_name(char_name)
    if not char:
        return {"error": f"未找到角色「{char_name}」，请检查角色名称。"}

    all_disks = get_all_arcdisks()

    # 优先推荐专属弧盘
    primary = None
    alternatives = []

    for disk in all_disks:
        if char_name in disk.get("suitable", []):
            if primary is None:
                primary = disk
            elif len(alternatives) < 2:
                alternatives.append(disk)

    # 如果没有专属，推荐通用弧盘
    if primary is None:
        if char["role"] in ("主C", "副C"):
            primary = next((d for d in all_disks if d["id"] == "tongyong_gongji"), None)
        else:
            primary = next((d for d in all_disks if d["id"] == "tongyong_shengcun"), None)

    # 备选
    if not alternatives:
        if char["role"] in ("主C", "副C"):
            alt = [d for d in all_disks if d["id"] in ["tongyong_gongji", "leiting", "fentian"]
                   and d["id"] != primary["id"]]
        else:
            alt = [d for d in all_disks if d["id"] in ["tongyong_shengcun", "bumie", "shengguang"]
                   and d["id"] != primary["id"]]
        alternatives = alt[:2]

    return {
        "character": char_name,
        "element": char["element"],
        "role": char["role"],
        "primary": {
            "name": primary["name"],
            "set2": primary["set2"],
            "set4": primary["set4"],
            "main_stats": primary["main_stats"],
            "sub_priority": primary["sub_priority"],
            "reason": f"「{primary['name']}」是{char_name}的{'专属' if char_name in primary.get('suitable', []) else '通用'}弧盘套装，{'完美契合' if char_name in primary.get('suitable', []) else '适合'}其{char['role']}定位。"
        },
        "alternatives": [
            {
                "name": alt["name"],
                "set2": alt["set2"],
                "set4": alt["set4"],
                "reason": f"备选方案，{'同样适合' if char_name in alt.get('suitable', []) else '可作为过渡'}使用"
            }
            for alt in alternatives
        ]
    }