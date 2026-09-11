"""
数据访问与检索层（RAG 中的 "Retrieval"）：
- 角色 / 弧盘(arcdisks_new) / 卡带(sets)：直接查 SQLite，按名称或关键词子串匹配
- 知识库(knowledge_base.json)：加载到内存缓存，用分词后的关键词交集计算简单相关度评分
所有表中的 JSON 字段（skills/synergy/suitable/main_attr 等）在此层解析为 Python 对象。
"""
import os
import json
import sqlite3
from typing import List, Dict, Optional

from path_resolver import get_data_dir, get_db_path

DATA_DIR = get_data_dir()
DB_PATH = get_db_path()

# 知识库条目缓存（首次检索时从 JSON 懒加载，避免每次请求都读文件）
_kb_entries: List[dict] = []


def _get_db_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _load_knowledge_base() -> List[dict]:
    global _kb_entries
    if not _kb_entries:
        path = os.path.join(DATA_DIR, "knowledge_base.json")
        with open(path, "r", encoding="utf-8") as f:
            _kb_entries = json.load(f)
    return _kb_entries


def search_knowledge(query: str, top_k: int = 3, threshold: float = 0.3) -> List[dict]:
    """使用关键词匹配检索知识库，返回最相关的top_k条资料"""
    entries = _load_knowledge_base()
    if not entries:
        return []

    results = []
    query_words = set(query.lower().replace("?", "").replace("？", "").split())

    for entry in entries:
        text = f"{entry['title']} {entry['content']} {' '.join(entry.get('keywords', []))}".lower()
        text_words = set(text.split())

        # 计算关键词匹配度
        matched = query_words & text_words
        score = len(matched) / len(query_words) if query_words else 0

        if score >= threshold:
            results.append({
                "entry": entry,
                "similarity": score
            })

    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:top_k]


def get_character_by_name(name: str) -> Optional[dict]:
    """根据角色名称从数据库查找角色数据"""
    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM characters WHERE name=?", (name,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row['id'],
            "name": row['name'],
            "element": row['element'],
            "role": row['role'],
            "rarity": row['rarity'],
            "skills": json.loads(row['skills']),
            "best_arcdisk": row['best_arcdisk'],
            "best_set": row['best_set'],
            "synergy": json.loads(row['synergy']) if row['synergy'] else []
        }
    return None


def get_all_characters() -> List[dict]:
    """从数据库获取所有角色数据"""
    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM characters")
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        result.append({
            "id": row['id'],
            "name": row['name'],
            "element": row['element'],
            "role": row['role'],
            "rarity": row['rarity'],
            "skills": json.loads(row['skills']),
            "best_arcdisk": row['best_arcdisk'],
            "best_set": row['best_set'],
            "synergy": json.loads(row['synergy']) if row['synergy'] else []
        })
    return result


def get_arcdisk_by_name(name: str) -> Optional[dict]:
    """根据弧盘名称从数据库查找弧盘数据"""
    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM arcdisks_new WHERE name=?", (name,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row['id'],
            "name": row['name'],
            "element": row['element'],
            "rarity": row['rarity'],
            "attack": row['attack'],
            "defense": row['defense'],
            "hp": row['hp'],
            "effect": row['effect'],
            "effect_desc": row['effect_desc'],
            "suitable": json.loads(row['suitable']) if row['suitable'] else []
        }
    return None


def get_all_arcdisks() -> List[dict]:
    """从数据库获取所有弧盘数据"""
    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM arcdisks_new")
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        result.append({
            "id": row['id'],
            "name": row['name'],
            "element": row['element'],
            "rarity": row['rarity'],
            "attack": row['attack'],
            "defense": row['defense'],
            "hp": row['hp'],
            "effect": row['effect'],
            "effect_desc": row['effect_desc'],
            "suitable": json.loads(row['suitable']) if row['suitable'] else []
        })
    return result


def get_set_by_name(name: str) -> Optional[dict]:
    """根据套装名称从数据库查找套装数据"""
    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sets WHERE name=?", (name,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row['id'],
            "name": row['name'],
            "set2": row['set2'],
            "set4": row['set4'],
            "main_attr": json.loads(row['main_attr']) if row['main_attr'] else {},
            "sub_attr": json.loads(row['sub_attr']) if row['sub_attr'] else [],
            "suitable": json.loads(row['suitable']) if row['suitable'] else []
        }
    return None


def get_all_sets() -> List[dict]:
    """从数据库获取所有套装数据"""
    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sets")
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        result.append({
            "id": row['id'],
            "name": row['name'],
            "set2": row['set2'],
            "set4": row['set4'],
            "main_attr": json.loads(row['main_attr']) if row['main_attr'] else {},
            "sub_attr": json.loads(row['sub_attr']) if row['sub_attr'] else [],
            "suitable": json.loads(row['suitable']) if row['suitable'] else []
        })
    return result


def search_arcdisks(query: str, top_k: int = 3) -> List[dict]:
    """搜索弧盘数据"""
    all_arcdisks = get_all_arcdisks()
    results = []
    query_lower = query.lower()
    
    for disk in all_arcdisks:
        # 检查名称、元素、效果是否匹配
        if (disk['name'] in query or 
            disk['element'] in query or
            disk['effect'] in query or
            any(s in query for s in disk.get('suitable', []))):
            results.append(disk)
    
    return results[:top_k]


def search_sets(query: str, top_k: int = 3) -> List[dict]:
    """搜索套装数据"""
    all_sets = get_all_sets()
    results = []
    
    for s in all_sets:
        # 检查名称、效果是否匹配
        if (s['name'] in query or 
            s['set2'] in query or
            s['set4'] in query or
            any(char in query for char in s.get('suitable', []))):
            results.append(s)
    
    return results[:top_k]


def get_materials_data() -> dict:
    path = os.path.join(DATA_DIR, "materials.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)