"""
角色互动统计服务：
- record_character_view：用户在图鉴中点击角色详情时 +1
- record_character_query：用户向 AI 提问涉及某角色时 +1
- get_favorite_character：取互动总数最高的角色，作为"最喜好角色"
  注入 LLM 提示词，驱动个性化配队推荐（见 chat_service）
使用 SQLite UPSERT（ON CONFLICT）按角色名累计计数。
"""
import sqlite3
import os
import uuid
from datetime import datetime

from path_resolver import get_db_path

DB_PATH = get_db_path()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def record_character_view(character_name: str):
    """记录角色图鉴点击"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 尝试插入或更新
    cursor.execute('''
        INSERT INTO character_stats (id, character_name, view_count, last_viewed)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(character_name) 
        DO UPDATE SET 
            view_count = view_count + 1,
            last_viewed = ?
    ''', (str(uuid.uuid4()), character_name, datetime.now(), datetime.now()))
    
    conn.commit()
    conn.close()

def record_character_query(character_name: str):
    """记录AI查询角色"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 尝试插入或更新
    cursor.execute('''
        INSERT INTO character_stats (id, character_name, query_count, last_queried)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(character_name) 
        DO UPDATE SET 
            query_count = query_count + 1,
            last_queried = ?
    ''', (str(uuid.uuid4()), character_name, datetime.now(), datetime.now()))
    
    conn.commit()
    conn.close()

def get_character_stats():
    """获取所有角色统计数据"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            character_name,
            view_count,
            query_count,
            (view_count + query_count) as total_count,
            last_viewed,
            last_queried
        FROM character_stats
        ORDER BY total_count DESC
    ''')
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_favorite_character():
    """获取最喜好角色（总次数最多的）"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            character_name,
            (view_count + query_count) as total_count
        FROM character_stats
        ORDER BY total_count DESC
        LIMIT 1
    ''')
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None

def get_stats_for_pie_chart():
    """获取饼图数据（只返回有记录的角色）"""
    stats = get_character_stats()
    
    # 过滤掉总次数为0的
    filtered = [s for s in stats if s['total_count'] > 0]
    
    return {
        'labels': [s['character_name'] for s in filtered],
        'values': [s['total_count'] for s in filtered],
        'viewCounts': [s['view_count'] for s in filtered],
        'queryCounts': [s['query_count'] for s in filtered]
    }

def reset_character_stats():
    """重置所有角色统计数据"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM character_stats')
    conn.commit()
    conn.close()
