"""
数据库初始化脚本（start.bat 第 1 步执行）：
- 创建 SQLite 表：characters / arcdisks(旧表) / materials / knowledge / character_stats
- 从 data/ 下的 JSON 文件导入基础数据（角色、弧盘、材料、知识库）
- 使用 INSERT OR REPLACE / INSERT OR IGNORE，可重复执行不覆盖用户在管理页新增的数据；
  materials 表已有数据时跳过材料导入，避免冲掉管理员的修改。
弧盘新表(arcdisks_new)与卡带表(sets)由 init_sets.py 负责创建。
"""
import sqlite3
import json
import os

from path_resolver import get_db_path, get_data_dir


def main():
    DB_PATH = get_db_path()
    data_dir = get_data_dir()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 创建表（使用 IF NOT EXISTS 避免覆盖已有表）
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        element TEXT NOT NULL,
        role TEXT NOT NULL,
        rarity TEXT NOT NULL,
        skills TEXT NOT NULL,
        best_arcdisk TEXT,
        best_set TEXT,
        synergy TEXT,
        picture TEXT
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS arcdisks (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        element TEXT,
        rarity TEXT,
        effect TEXT,
        effect_desc TEXT,
        suitable TEXT,
        source TEXT,
        picture TEXT
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS materials (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        tier INTEGER,
        source TEXT NOT NULL,
        source_type TEXT NOT NULL,
        element TEXT,
        picture TEXT
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS knowledge (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        keywords TEXT
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS character_stats (
        id TEXT PRIMARY KEY,
        character_name TEXT UNIQUE NOT NULL,
        view_count INTEGER DEFAULT 0,
        query_count INTEGER DEFAULT 0,
        last_viewed TIMESTAMP,
        last_queried TIMESTAMP
    )
    ''')

    conn.commit()
    print("[OK] Database tables verified")

    # 检查材料表是否已有数据，如果有则跳过材料初始化
    cursor.execute("SELECT COUNT(*) FROM materials WHERE type IN ('ascension', 'common', 'skill', 'weekly')")
    existing_material_count = cursor.fetchone()[0]

    if existing_material_count > 0:
        print(f"[SKIP] Materials table already has {existing_material_count} records, skipping material initialization")
        SKIP_MATERIALS = True
    else:
        print("[INFO] Materials table is empty, will initialize materials...")
        SKIP_MATERIALS = False

    if os.path.exists(os.path.join(data_dir, 'characters.json')):
        with open(os.path.join(data_dir, 'characters.json'), 'r', encoding='utf-8') as f:
            chars = json.load(f)
            for char in chars:
                try:
                    cursor.execute('''
                    INSERT OR REPLACE INTO characters (id, name, element, role, rarity, skills, best_arcdisk, best_set, synergy, picture)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        char['id'],
                        char['name'],
                        char['element'],
                        char['role'],
                        char['rarity'],
                        json.dumps(char['skills']),
                        char.get('best_arcdisk', ''),
                        char.get('best_set', ''),
                        json.dumps(char.get('synergy', [])),
                        char.get('picture', '')
                    ))
                except Exception as e:
                    print("[WARN] Failed to import character " + char['name'] + ": " + str(e))
        conn.commit()
        print("[OK] Imported " + str(len(chars)) + " characters")

    if os.path.exists(os.path.join(data_dir, 'arc_disks.json')):
        with open(os.path.join(data_dir, 'arc_disks.json'), 'r', encoding='utf-8') as f:
            disks = json.load(f)
            for disk in disks:
                try:
                    cursor.execute('''
                    INSERT OR IGNORE INTO arcdisks (id, name, element, rarity, effect, effect_desc, suitable, source, picture)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        disk['id'],
                        disk['name'],
                        disk.get('element', ''),
                        disk.get('rarity', ''),
                        disk.get('effect', ''),
                        disk.get('effect_desc', ''),
                        json.dumps(disk.get('suitable', [])),
                        disk.get('source', ''),
                        disk.get('picture', '')
                    ))
                except Exception as e:
                    print("[WARN] Failed to import arcdisk " + disk['name'] + ": " + str(e))
        conn.commit()
        print("[OK] Imported " + str(len(disks)) + " arcdisks")

    if os.path.exists(os.path.join(data_dir, 'materials.json')) and not SKIP_MATERIALS:
        with open(os.path.join(data_dir, 'materials.json'), 'r', encoding='utf-8') as f:
            materials = json.load(f)

            for element, mats in materials.get('ascension_materials', {}).items():
                for mat in mats:
                    try:
                        cursor.execute('''
                        INSERT OR IGNORE INTO materials (id, name, type, tier, source, source_type, element)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            element + '_' + mat['name'],
                            mat['name'],
                            'ascension',
                            mat['tier'],
                            mat['source'],
                            mat['source_type'],
                            element
                        ))
                    except Exception as e:
                        print("[WARN] Failed to import material " + mat['name'] + ": " + str(e))

            for mat in materials.get('common_materials', []):
                try:
                    cursor.execute('''
                    INSERT OR IGNORE INTO materials (id, name, type, tier, source, source_type)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ''', (
                        'common_' + mat['name'],
                        mat['name'],
                        'common',
                        mat['tier'],
                        mat['source'],
                        mat['source_type']
                    ))
                except Exception as e:
                    print("[WARN] Failed to import common material " + mat['name'] + ": " + str(e))

            for element, mat in materials.get('skill_materials', {}).items():
                try:
                    cursor.execute('''
                    INSERT OR IGNORE INTO materials (id, name, type, source, source_type, element)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ''', (
                        'skill_' + element,
                        mat['name'],
                        'skill',
                        mat['source'],
                        mat['source_type'],
                        element
                    ))
                except Exception as e:
                    print("[WARN] Failed to import skill material " + mat['name'] + ": " + str(e))

            for mat in materials.get('weekly_boss_materials', []):
                try:
                    cursor.execute('''
                    INSERT OR IGNORE INTO materials (id, name, type, source, source_type)
                    VALUES (?, ?, ?, ?, ?)
                    ''', (
                        'weekly_' + mat['name'],
                        mat['name'],
                        'weekly',
                        mat['source'],
                        mat['source_type']
                    ))
                except Exception as e:
                    print("[WARN] Failed to import weekly material " + mat['name'] + ": " + str(e))

        conn.commit()
        print("[OK] Materials imported")

    if os.path.exists(os.path.join(data_dir, 'knowledge_base.json')):
        with open(os.path.join(data_dir, 'knowledge_base.json'), 'r', encoding='utf-8') as f:
            kb = json.load(f)
            for item in kb:
                try:
                    cursor.execute('''
                    INSERT OR IGNORE INTO knowledge (id, title, content, keywords)
                    VALUES (?, ?, ?, ?)
                    ''', (
                        item['id'],
                        item['title'],
                        item['content'],
                        json.dumps(item.get('keywords', []))
                    ))
                except Exception as e:
                    print("[WARN] Failed to import knowledge " + item['title'] + ": " + str(e))
        conn.commit()
        print("[OK] Imported " + str(len(kb)) + " knowledge items")

    conn.close()
    print("\n[DONE] Database initialization complete!")


if __name__ == "__main__":
    main()
