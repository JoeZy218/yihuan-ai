"""
异环 AI 战术教学助手 —— 后端服务入口（FastAPI）

接口分组：
- /api/chat、/api/session   智能问答（RAG：意图识别 → 资料检索 → LLM 生成，失败时降级为本地 mock）
- /api/team                 配队推荐（基于元素协同/定位的规则算法）
- /api/materials            养成材料计算（突破材料 + 经验书 + 技能材料）
- /api/arcdisk、/api/set    弧盘（专武）与卡带（套装）推荐（规则匹配优先级）
- /api/admin/*              数据管理 CRUD（角色 / 弧盘 / 卡带 / 材料 / 知识库）
- /api/stats/*              角色互动统计（图鉴点击、AI 查询次数，用于"最喜好角色"）
- /api/settings/apikey      运行时配置 LLM 的 API Key / URL / 模型
- /api/exit                 一键停止前后端服务并关闭浏览器

数据存储：SQLite（yihuan.db），初始数据由 init_db.py / init_sets.py 从 data/*.json 导入。
"""
import os
import sys
import time
import uuid
import json
import subprocess
import threading
from typing import Optional, List, Dict, Any

from path_resolver import get_db_path, get_env_path, get_resource_path, get_frontend_dir, is_frozen, get_app_dir

try:
    from dotenv import load_dotenv
    load_dotenv(get_env_path())
except ImportError:
    pass

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import sqlite3

from services.chat_service import process_chat
from services.stats_service import (
    record_character_view, 
    record_character_query,
    get_character_stats,
    get_favorite_character,
    get_stats_for_pie_chart,
    reset_character_stats
)

app = FastAPI(title="异环AI战术教学助手", version="1.0.0")

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 会话存储
sessions: Dict[str, Dict] = {}

# 用户配置的 API Key
user_api_key: Optional[str] = os.environ.get("LLM_API_KEY")

# 限流配置
request_counts: Dict[str, int] = {}
RATE_LIMIT = 20
RATE_LIMIT_WINDOW = 60

# 黑名单关键词（保留必要的安全关键词）
BLACKLIST = [
    '政治', '新闻', '色情', '暴力', '赌博', '违法', '广告'
]

DB_PATH = get_db_path()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ========== 健康检查 ==========
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "服务运行正常"}

# ========== 退出应用 ==========
@app.post("/api/exit")
async def exit_app():
    """停止前后端服务并关闭浏览器页面（后端直接执行清理，避免子进程问题）"""
    # 云端部署（Linux 容器）不支持 PowerShell / taskkill，直接返回 501
    import platform
    if platform.system() != "Windows":
        raise HTTPException(status_code=501, detail="Exit not supported in cloud deployment")
    pid_file = os.path.join(get_app_dir(), "running.pid")

    def _do_shutdown():
        # 等待 HTTP 响应返回
        time.sleep(1)

        # Step 1: 关闭浏览器页面（只关 chrome/msedge/firefox，不碰 Trae）
        try:
            subprocess.Popen(
                ['powershell', '-NoProfile', '-Command',
                 "Get-Process -Name chrome,msedge,firefox -ErrorAction SilentlyContinue | "
                 "Where-Object { $_.MainWindowTitle -like '*异环 AI 战术教学助手*' } | "
                 "ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
        except Exception:
            pass

        time.sleep(1)

        # Step 2: 杀前端（端口 3000）
        try:
            subprocess.Popen(
                'for /f "tokens=5" %a in (\'netstat -aon ^| findstr ":3000" ^| findstr LISTENING\') do taskkill /F /PID %a',
                shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
        except Exception:
            pass

        time.sleep(2)

        # Step 3: 删除 PID 文件
        try:
            if os.path.exists(pid_file):
                os.remove(pid_file)
        except Exception:
            pass

        # Step 4: 自杀（杀后端自身）
        try:
            subprocess.Popen(
                f'taskkill /F /PID {os.getpid()}',
                shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
        except Exception:
            pass
        os._exit(0)

    threading.Thread(target=_do_shutdown, daemon=True).start()
    return {"message": "停止脚本已触发", "stop_script": "backend self-shutdown"}

# ========== 设置管理 ==========
class ApiKeySettings(BaseModel):
    api_key: str
    api_url: Optional[str] = None
    model: Optional[str] = None

@app.post("/api/settings/apikey")
async def set_api_key(settings: ApiKeySettings):
    global user_api_key
    user_api_key = settings.api_key
    # 同时更新环境变量，供 llm_service 使用
    os.environ["LLM_API_KEY"] = settings.api_key
    if settings.api_url:
        os.environ["LLM_API_URL"] = settings.api_url
    if settings.model:
        os.environ["LLM_MODEL"] = settings.model
    return {"message": "API Key 设置成功"}

@app.get("/api/settings/apikey")
async def get_api_key_status():
    return {"has_api_key": bool(user_api_key)}

# ========== 会话管理 ==========
@app.post("/api/session")
async def create_session():
    session_id = str(uuid.uuid4())
    sessions[session_id] = {"history": []}
    return {"session_id": session_id}

@app.post("/api/clear")
async def clear_session(request: Request):
    data = await request.json()
    session_id = data.get('session_id', '')
    if session_id in sessions:
        sessions[session_id]["history"] = []
    return {"message": "对话已清空"}

@app.get("/api/characters")
async def get_characters_public():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name, element, role, rarity FROM characters")
    rows = cursor.fetchall()
    conn.close()
    return [{"name": row['name'], "element": row['element'], "role": row['role'], "rarity": row['rarity']} for row in rows]

# ========== 对话管理 ==========
@app.post("/api/chat")
async def chat(request: Request):
    data = await request.json()
    session_id = data.get('session_id', str(uuid.uuid4()))
    question = data.get('message', data.get('question', '')).strip()
    
    print(f"[CHAT] Received question: {repr(question)}")
    print(f"[CHAT] Question length: {len(question)}")
    
    if len(question) > 200:
        print("[CHAT] Rejected: too long")
        raise HTTPException(status_code=400, detail="问题过长，请精简到200字符以内")
    
    for word in BLACKLIST:
        if word in question:
            print(f"[CHAT] Rejected by blacklist: {word}")
            raise HTTPException(status_code=403, detail="抱歉，这个问题超出了我的能力范围啦～ 我是《异环》游戏助手，可以帮你解答角色攻略、配队推荐、弧盘卡带等游戏相关问题哦！")
    
    if session_id not in sessions:
        sessions[session_id] = {"history": []}
    
    sessions[session_id]["history"].append({"role": "user", "content": question})
    if len(sessions[session_id]["history"]) > 20:
        sessions[session_id]["history"] = sessions[session_id]["history"][-20:]

    # 调用 AI 服务处理对话
    result = await process_chat(question, sessions[session_id]["history"])

    response_type = result.get("type", "text")
    response_text = result.get("content", "抱歉，AI服务暂时繁忙。")
    suggestions = result.get("suggestions", [])
    sources = result.get("sources", [])

    sessions[session_id]["history"].append({"role": "assistant", "content": response_text})

    return {
        "session_id": session_id, 
        "content": response_text, 
        "type": response_type,
        "sources": sources,
        "suggestions": suggestions
    }

@app.delete("/api/chat/{session_id}")
async def clear_chat(session_id: str):
    if session_id in sessions:
        sessions[session_id]["history"] = []
    return {"message": "对话已清空"}

# ========== 配队推荐 ==========
class TeamRequest(BaseModel):
    core_char: str
    owned_chars: List[str] = []
    play_style: Optional[str] = None

@app.post("/api/team")
async def get_team_recommendation(request: TeamRequest):
    core_char = request.core_char
    owned_chars = request.owned_chars or []
    play_style = request.play_style
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 获取核心角色信息
    cursor.execute("SELECT * FROM characters WHERE name=?", (core_char,))
    core_row = cursor.fetchone()
    
    if not core_row:
        conn.close()
        return {"error": f"角色「{core_char}」不存在于数据库中"}
    
    core_element = core_row['element']
    core_role = core_row['role']
    core_synergy = []
    if core_row['synergy']:
        try:
            core_synergy = json.loads(core_row['synergy'])
        except:
            pass
    
    # 获取所有角色
    cursor.execute("SELECT * FROM characters WHERE name != ?", (core_char,))
    all_chars = cursor.fetchall()
    conn.close()
    
    # 构建角色字典
    char_dict = {char['name']: char for char in all_chars}
    
    # 智能配队算法
    team_members = [
        {
            "name": core_char,
            "role": core_role,
            "reason": f"{core_element}元素核心输出角色"
        }
    ]
    
    # 需要的位置
    needed_positions = ["副C", "辅助", "生存"]
    
    # 按元素协同和定位推荐角色
    recommended_chars = []
    
    for char_name, char in char_dict.items():
        # 检查是否在用户拥有的角色列表中
        if owned_chars and char_name not in owned_chars:
            continue
            
        # 检查元素协同
        char_element = char['element']
        char_role = char['role']
        
        # 优先选择有元素协同的角色
        has_synergy = char_element in core_synergy or core_element in (json.loads(char['synergy']) if char['synergy'] else [])
        
        recommended_chars.append({
            "name": char_name,
            "role": char_role,
            "element": char_element,
            "has_synergy": has_synergy,
            "rarity": char['rarity']
        })
    
    # 排序：有元素协同的优先，SSR优先，然后按角色定位匹配
    recommended_chars.sort(key=lambda x: (not x['has_synergy'], x['rarity'] != 'SSR', x['name']))
    
    # 为每个位置选择合适的角色
    used_chars = {core_char}
    for position in needed_positions:
        # 优先选择有元素协同且匹配位置的角色
        selected = None
        for char in recommended_chars:
            if char['name'] not in used_chars:
                # 优先选择位置匹配的
                if char['role'] == position:
                    selected = char
                    break
                # 其次选择有元素协同的
                elif char['has_synergy'] and not selected:
                    selected = char
        
        if selected:
            used_chars.add(selected['name'])
            team_members.append({
                "name": selected['name'],
                "role": position,
                "reason": f"{selected['element']}元素{selected['role']}，{'与核心角色有元素协同' if selected['has_synergy'] else '提供稳定支持'}"
            })
        else:
            # 如果没有找到合适的角色，使用默认角色
            team_members.append({
                "name": f"推荐{position}",
                "role": position,
                "reason": f"建议选择{position}定位的角色"
            })
    
    # 生成技能循环建议
    rotation_steps = []
    for member in team_members:
        if member['role'] == '辅助':
            rotation_steps.append(f"{member['name']}释放辅助技能")
        elif member['role'] == '副C':
            rotation_steps.append(f"{member['name']}释放战技触发元素反应")
        elif member['role'] == '生存':
            rotation_steps.append(f"{member['name']}提供护盾/治疗")
        elif member['role'] == '主C':
            rotation_steps.append(f"{core_char}进行主要输出")
    
    rotation = " → ".join(rotation_steps)
    
    # 生成替代方案
    alternatives = []
    for i, member in enumerate(team_members[1:], 1):
        if member['name'] != f"推荐{member['role']}":
            # 找替代角色
            alt_candidates = [c for c in recommended_chars 
                            if c['name'] not in used_chars 
                            and c['role'] == member['role']]
            if alt_candidates:
                alternatives.append({
                    "original": member['name'],
                    "alternative": alt_candidates[0]['name'],
                    "reason": f"同为{member['role']}定位，可以替换使用"
                })
    
    # 生成总结
    team_elements = [core_element] + [m['element'] for m in team_members[1:] if 'element' in m]
    summary = f"以{core_char}（{core_element}元素{core_role}）为核心的配队方案，"
    if len(set(team_elements)) > 1:
        summary += f"搭配{', '.join(set(team_elements) - {core_element})}元素角色形成元素协同，"
    summary += "最大化输出伤害。"
    if owned_chars:
        summary += f"已考虑你拥有的角色：{', '.join(owned_chars)}"
    
    team = {
        "core": core_char,
        "team": team_members,
        "positions": ["主C", "副C", "辅助", "生存"],
        "rotation": rotation,
        "alternatives": alternatives,
        "summary": summary
    }
    
    return team

# ========== 材料计算 ==========
class MaterialRequest(BaseModel):
    character: str
    current_level: int = 1
    target_level: int = 80
    current_skill_levels: Dict[str, int] = None
    target_skill_levels: Dict[str, int] = None

def load_materials_json():
    data_path = get_resource_path('data', 'materials.json')
    with open(data_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def _get_ascension_breakpoints(current_level: int, target_level: int):
    """返回从 current_level 到 target_level 需要突破的节点列表"""
    breakpoints = []
    # 从当前等级的下一个10级节点开始，到目标等级结束
    start = ((current_level // 10) + 1) * 10
    for bp in range(start, target_level + 1, 10):
        if bp <= target_level:
            breakpoints.append(bp)
    return breakpoints

def _get_ascension_formula_entry(rarity: str, bp_level: int, materials_data: dict):
    """根据突破等级获取对应的公式条目"""
    formula = materials_data.get('ascension_formula', {}).get(rarity, [])
    # 扩展公式到80级
    extended = list(formula)
    if len(extended) < 8:
        # 补充60-70和70-80的公式
        # tier_mat 4 → T4 之心
        extended.append({"from": 60, "to": 70, "tier_mat": 3, "tier_count": 20, "gold": 100000})
        extended.append({"from": 70, "to": 80, "tier_mat": 4, "tier_count": 25, "gold": 120000})
    for entry in extended:
        if entry['to'] == bp_level:
            return entry
    return None

def _calc_ascension_materials(current_level: int, target_level: int, element: str, rarity: str, materials_data: dict):
    """计算突破材料需求"""
    result = []
    ascension_mats = materials_data.get('ascension_materials', {}).get(element, [])
    if not ascension_mats:
        return result
    
    breakpoints = _get_ascension_breakpoints(current_level, target_level)
    # 按 tier 汇总
    tier_totals = {}
    # tier_mat → actual material tier 映射
    TIER_MAP = {0: 1, 1: 1, 2: 2, 3: 3, 4: 4}
    for bp in breakpoints:
        entry = _get_ascension_formula_entry(rarity, bp, materials_data)
        if entry:
            tier = TIER_MAP.get(entry['tier_mat'], 1)
            tier_totals[tier] = tier_totals.get(tier, 0) + entry['tier_count']
    
    for tier, count in tier_totals.items():
        # 找到对应 tier 的材料
        mat = next((m for m in ascension_mats if m.get('tier') == tier), None)
        if mat:
            result.append({
                "name": mat['name'],
                "count": count,
                "source": mat.get('source', ''),
                "tier": tier
            })
    return result

def _calc_exp_books(current_level: int, target_level: int, materials_data: dict):
    """计算经验书需求（升级消耗）"""
    common_mats = materials_data.get('common_materials', [])
    if not common_mats:
        return []
    
    # 经验书按等级区间分配消耗量
    exp_stages = [
        # (等级范围, 每级消耗T1, 每级消耗T2, 每级消耗T3, 每级消耗T4)
        (1, 30, 5, 0, 0, 0),
        (30, 50, 0, 3, 0, 0),
        (50, 70, 0, 0, 2, 0),
        (70, 80, 0, 0, 0, 1),
    ]
    
    totals = {1: 0, 2: 0, 3: 0, 4: 0}
    for level in range(current_level, target_level):
        for lo, hi, t1, t2, t3, t4 in exp_stages:
            if lo <= level < hi:
                totals[1] += t1
                totals[2] += t2
                totals[3] += t3
                totals[4] += t4
                break
    
    result = []
    for tier, count in totals.items():
        if count > 0:
            mat = next((m for m in common_mats if m.get('tier') == tier), None)
            if mat:
                result.append({
                    "name": mat['name'],
                    "count": count,
                    "source": mat.get('source', ''),
                    "tier": tier
                })
    return result

def _calc_skill_materials(current: int, target: int, element: str, materials_data: dict):
    """计算单个技能升级材料需求"""
    if current >= target:
        return []
    
    skill_mat = materials_data.get('skill_materials', {}).get(element, {})
    weekly_mats = materials_data.get('weekly_boss_materials', [])
    
    result = []
    
    # 技能材料：每级消耗一定数量，1-7级用T1，8-10级用T2
    skill_mats_needed = 0
    weekly_mats_needed = 0
    
    for level in range(current, target):
        # 基础技能材料消耗（随等级递增）
        if level < 3:
            skill_mats_needed += 2
        elif level < 5:
            skill_mats_needed += 3
        elif level < 7:
            skill_mats_needed += 4
        elif level < 8:
            skill_mats_needed += 5
        else:  # 8-10级
            skill_mats_needed += 6
            weekly_mats_needed += 1  # 8-10级每次升级需要周本材料
    
    if skill_mats_needed > 0 and skill_mat:
        result.append({
            "name": skill_mat.get('name', f'{element}属性技能材料'),
            "count": skill_mats_needed,
            "source": skill_mat.get('source', ''),
            "tier": 1
        })
    
    if weekly_mats_needed > 0 and weekly_mats:
        wm = weekly_mats[0]
        result.append({
            "name": wm['name'],
            "count": weekly_mats_needed,
            "source": wm.get('source', ''),
            "tier": 5
        })
    
    return result

@app.post("/api/materials")
async def calculate_materials(request: MaterialRequest):
    character_name = request.character
    current_level = request.current_level
    target_level = request.target_level
    
    # 获取角色信息
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM characters WHERE name=?", (character_name,))
    char_row = cursor.fetchone()
    
    if not char_row:
        conn.close()
        return {"error": f"角色「{character_name}」不存在"}
    
    element = char_row['element']
    rarity = char_row['rarity']
    conn.close()
    
    # 加载材料数据
    materials_data = load_materials_json()
    
    # 默认技能等级
    current_skill = request.current_skill_levels or {}
    target_skill = request.target_skill_levels or {}
    
    skill_names = ['normal', 'skill', 'ultimate']
    skill_labels = {'normal': '普攻', 'skill': '战技', 'ultimate': '大招'}
    
    # 计算突破材料
    ascension_materials = _calc_ascension_materials(current_level, target_level, element, rarity, materials_data)
    
    # 计算经验书
    exp_books = _calc_exp_books(current_level, target_level, materials_data)
    
    # 计算技能材料
    skill_results = {}
    for sk in skill_names:
        cur = current_skill.get(sk, 1)
        tgt = target_skill.get(sk, 1)
        skill_mats = _calc_skill_materials(cur, tgt, element, materials_data)
        skill_results[sk] = {
            "from": cur,
            "to": tgt,
            "materials": skill_mats
        }
    
    # 汇总材料（去重合并）
    material_map = {}
    for mat in ascension_materials + exp_books:
        key = mat['name']
        if key in material_map:
            material_map[key]['count'] += mat['count']
        else:
            material_map[key] = dict(mat)
    
    for sk in skill_names:
        for mat in skill_results[sk]['materials']:
            key = mat['name']
            if key in material_map:
                material_map[key]['count'] += mat['count']
            else:
                material_map[key] = dict(mat)
    
    total_materials = sorted(material_map.values(), key=lambda m: m.get('tier', 0))
    
    # 优先级建议
    priority = [
        "1. 优先将角色等级提升至目标等级",
        "2. 升级核心技能（战技或大招）至目标等级",
        "3. 最后升级普攻"
    ]
    
    return {
        "character": character_name,
        "element": element,
        "rarity": rarity,
        "ascension": {
            "from": current_level,
            "to": target_level,
            "materials": ascension_materials
        },
        "exp_books": exp_books,
        "skills": skill_results,
        "total_materials": total_materials,
        "priority": priority
    }

# ========== 弧盘推荐（专武）==========
@app.get("/api/arcdisk/{character}")
async def get_arcdisk_recommendation(character: str):
    from services.retrieval_service import get_character_by_name, get_all_arcdisks, get_all_sets
    
    # 获取角色信息
    char_data = get_character_by_name(character)
    if not char_data:
        return {"error": f"角色「{character}」不存在"}
    
    # 获取所有弧盘和套装数据
    all_arcdisks = get_all_arcdisks()
    all_sets = get_all_sets()
    
    if not all_arcdisks:
        return {
            "character": character,
            "element": char_data['element'],
            "role": char_data['role'],
            "error": "数据库中没有弧盘数据"
        }
    
    # === 规则匹配弧盘（专武）===
    # 优先级：1.角色在suitable列表 2.best_arcdisk匹配 3.同元素 4.通用弧盘
    arcdisk_data = None
    
    # 优先找角色专属弧盘
    for disk in all_arcdisks:
        if character in disk.get('suitable', []):
            arcdisk_data = disk
            break
    
    # 其次找best_arcdisk
    if not arcdisk_data and char_data.get('best_arcdisk'):
        for disk in all_arcdisks:
            if disk['name'] == char_data['best_arcdisk']:
                arcdisk_data = disk
                break
    
    # 同元素弧盘
    if not arcdisk_data:
        for disk in all_arcdisks:
            if disk['element'] == char_data['element']:
                arcdisk_data = disk
                break
    
    # 通用弧盘
    if not arcdisk_data:
        for disk in all_arcdisks:
            if '通用' in disk.get('suitable', []):
                arcdisk_data = disk
                break
    
    if not arcdisk_data and all_arcdisks:
        arcdisk_data = all_arcdisks[0]
    
    # === 规则匹配套装（卡带）===
    # 优先级：1.best_set 2.角色在suitable列表 3.通用输出/生存套装
    set_data = None
    
    # 优先找best_set
    if char_data.get('best_set'):
        for s in all_sets:
            if s['name'] == char_data['best_set']:
                set_data = s
                break
    
    # 找角色在suitable列表的套装
    if not set_data:
        for s in all_sets:
            if character in s.get('suitable', []):
                set_data = s
                break
    
    # 根据角色定位推荐通用套装
    if not set_data:
        if char_data['role'] in ('主C', '副C'):
            # 输出角色推荐影之信条（通用攻击套）
            for s in all_sets:
                if s['name'] == '影之信条':
                    set_data = s
                    break
        else:
            # 辅助/生存角色推荐音速蓝刺猬
            for s in all_sets:
                if s['name'] == '音速蓝刺猬':
                    set_data = s
                    break
    
    # 构建弧盘属性字符串
    main_attr_str = f"攻击力:{arcdisk_data['attack']}" if arcdisk_data and arcdisk_data.get('attack') else ""
    if arcdisk_data and arcdisk_data.get('defense'):
        main_attr_str += f" 防御力:{arcdisk_data['defense']}" if main_attr_str else f"防御力:{arcdisk_data['defense']}"
    if arcdisk_data and arcdisk_data.get('hp'):
        main_attr_str += f" 生命值:{arcdisk_data['hp']}" if main_attr_str else f"生命值:{arcdisk_data['hp']}"
    
    # 构建备选套装（包含完整信息）
    alternatives = []
    primary_set_name = set_data['name'] if set_data else ''
    
    # 从数据库suitable列表找备选套装
    for s in all_sets:
        if s['name'] != primary_set_name and character in s.get('suitable', []):
            alternatives.append({
                "name": s['name'],
                "set2": s['set2'],
                "set4": s['set4'],
                "main_stats": s.get('main_attr', {}),
                "sub_priority": s.get('sub_attr', []),
                "reason": f"同样适用于{character}的套装方案"
            })
            if len(alternatives) >= 2:
                break
    
    # 如果备选不足，根据角色定位补充通用套装
    if len(alternatives) < 2:
        fallback_sets = ['影之信条', '音速蓝刺猬'] if char_data['role'] in ('主C', '副C') else ['音速蓝刺猬', '影之信条']
        for fb_name in fallback_sets:
            if len(alternatives) >= 2:
                break
            for s in all_sets:
                if s['name'] == fb_name and s['name'] != primary_set_name and not any(a['name'] == fb_name for a in alternatives):
                    alternatives.append({
                        "name": s['name'],
                        "set2": s['set2'],
                        "set4": s['set4'],
                        "main_stats": s.get('main_attr', {}),
                        "sub_priority": s.get('sub_attr', []),
                        "reason": f"通用套装，可作为{character}的过渡方案"
                    })
                    break
    
    # 生成选择理由
    is_dedicated = character in (arcdisk_data.get('suitable', []) if arcdisk_data else [])
    set_reason = f"{character}作为{char_data['element']}元素{char_data['role']}，{set_data['name']}套装能最大化其输出" if set_data else ""
    
    # 生成配装分析总结
    analysis = f"{character}是{char_data['element']}元素{char_data['role']}角色"
    if arcdisk_data:
        analysis += f"，专属弧盘「{arcdisk_data['name']}」{arcdisk_data['effect']}完美契合其定位"
    if set_data:
        analysis += f"。卡带推荐「{set_data['name']}」，2件套{set_data['set2']}，4件套{set_data['set4']}"
    analysis += "。"
    
    return {
        "character": character,
        "element": char_data['element'],
        "role": char_data['role'],
        "arcdisk": {
            "name": arcdisk_data['name'] if arcdisk_data else "未找到",
            "element": arcdisk_data['element'] if arcdisk_data else "",
            "rarity": arcdisk_data['rarity'] if arcdisk_data else "",
            "main_attr": main_attr_str or "-",
            "sub_attr": "",
            "effect": arcdisk_data['effect'] if arcdisk_data else "",
            "effect_desc": arcdisk_data['effect_desc'] if arcdisk_data else ""
        },
        "set": {
            "name": set_data['name'] if set_data else "未指定",
            "set2": set_data['set2'] if set_data else "-",
            "set4": set_data['set4'] if set_data else "-",
            "main_stats": set_data.get('main_attr', {}) if set_data else {},
            "sub_priority": set_data.get('sub_attr', []) if set_data else [],
            "reason": set_reason
        },
        "alternatives": alternatives,
        "ai_analysis": analysis
    }

# ========== 套装推荐 ==========
@app.get("/api/set/{character}")
async def get_set_recommendation(character: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM characters WHERE name=?", (character,))
    char_row = cursor.fetchone()
    
    if not char_row:
        conn.close()
        return {"error": f"角色「{character}」不存在"}
    
    best_set_name = char_row['best_set']
    element = char_row['element']
    role = char_row['role']
    
    set_data = None
    if best_set_name:
        cursor.execute("SELECT * FROM sets WHERE name=?", (best_set_name,))
        set_row = cursor.fetchone()
        if set_row:
            main_attr_data = set_row['main_attr']
            # 尝试解析JSON字符串
            if main_attr_data and isinstance(main_attr_data, str):
                try:
                    main_attr_data = json.loads(main_attr_data)
                except:
                    main_attr_data = {}
            elif not main_attr_data:
                main_attr_data = {}

            set_data = {
                "id": set_row['id'],
                "name": set_row['name'],
                "set2": set_row['set2'],
                "set4": set_row['set4'],
                "main_attr": main_attr_data,
                "sub_attr": json.loads(set_row['sub_attr']) if set_row['sub_attr'] else [],
                "suitable": json.loads(set_row['suitable']) if set_row['suitable'] else []
            }
    
    cursor.execute("SELECT * FROM sets WHERE suitable LIKE ?", (f"%{character}%",))
    other_sets = cursor.fetchall()
    
    alternatives = []
    for row in other_sets[:3]:
        if row['name'] != best_set_name:
            alternatives.append(row['name'])
    
    conn.close()
    
    if not set_data:
        return {
            "character": character,
            "element": element,
            "role": role,
            "error": "未找到该角色的套装推荐数据",
            "best_set": "未指定",
            "alternatives": []
        }
    
    main_attr = {}
    try:
        main_attr = json.loads(set_data['main_attr']) if set_data['main_attr'] else {
            "position_1": "攻击力",
            "position_2": "攻击力",
            "position_3": f"{element}元素伤害加成",
            "position_4": "暴击率"
        }
    except:
        main_attr = {
            "position_1": "攻击力",
            "position_2": "攻击力",
            "position_3": f"{element}元素伤害加成",
            "position_4": "暴击率"
        }
    
    return {
        "character": character,
        "element": element,
        "role": role,
        "best_set": set_data['name'],
        "set2": set_data['set2'],
        "set4": set_data['set4'],
        "main_attr": main_attr,
        "sub_attr_priority": set_data['sub_attr'] or ["暴击率", "暴击伤害", "攻击力", "元素精通"],
        "alternatives": alternatives,
        "reason": f"{character}作为{element}元素{role}，{set_data['name']}套装能最大化其输出"
    }

# ========== 数据管理 API ==========

# 角色管理
@app.get("/api/admin/characters")
async def get_all_characters():
    conn = get_db_connection()
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
            "best_set": row['best_set'] if 'best_set' in row.keys() else '',
            "synergy": json.loads(row['synergy']) if row['synergy'] else [],
            "picture": row['picture'] if 'picture' in row.keys() else ''
        })
    return result

@app.post("/api/admin/characters")
async def add_character(request: Request):
    data = await request.json()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
        INSERT INTO characters (id, name, element, role, rarity, skills, best_arcdisk, best_set, synergy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['name'].lower().replace(' ', '-'),
            data['name'],
            data['element'],
            data['role'],
            data['rarity'],
            json.dumps(data['skills']),
            data.get('best_arcdisk', ''),
            data.get('best_set', ''),
            json.dumps(data.get('synergy', []))
        ))
        conn.commit()
        conn.close()
        return {"message": "角色添加成功"}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="角色已存在")

@app.put("/api/admin/characters/{name}")
async def update_character(name: str, request: Request):
    data = await request.json()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
    UPDATE characters SET element=?, role=?, rarity=?, skills=?, best_arcdisk=?, best_set=?, synergy=?
    WHERE name=?
    ''', (
        data['element'],
        data['role'],
        data['rarity'],
        json.dumps(data['skills']),
        data.get('best_arcdisk', ''),
        data.get('best_set', ''),
        json.dumps(data.get('synergy', [])),
        name
    ))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="角色不存在")
    
    conn.commit()
    conn.close()
    return {"message": "角色更新成功"}

@app.delete("/api/admin/characters/{name}")
async def delete_character(name: str):
    from urllib.parse import unquote
    # 解码URL中的中文字符
    decoded_name = unquote(name)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 先检查角色是否存在
    cursor.execute("SELECT name FROM characters WHERE name=?", (decoded_name,))
    row = cursor.fetchone()
    
    if not row:
        # 尝试模糊匹配（去除空格）
        cursor.execute("SELECT name FROM characters WHERE TRIM(name)=?", (decoded_name.strip(),))
        row = cursor.fetchone()
        if row:
            decoded_name = row['name']
    
    if not row:
        # 列出所有角色名称用于调试
        cursor.execute("SELECT name FROM characters")
        all_names = [r['name'] for r in cursor.fetchall()]
        conn.close()
        raise HTTPException(status_code=404, detail=f"角色「{decoded_name}」不存在。数据库中的角色：{all_names}")
    
    cursor.execute("DELETE FROM characters WHERE name=?", (decoded_name,))
    conn.commit()
    conn.close()
    return {"message": f"角色「{decoded_name}」删除成功"}

# 弧盘管理（专武）
@app.get("/api/admin/arcdisks")
async def get_all_arcdisks():
    conn = get_db_connection()
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
            "suitable": json.loads(row['suitable']) if row['suitable'] else [],
            "picture": row['picture'] if 'picture' in row.keys() else ''
        })
    return result

@app.post("/api/admin/arcdisks")
async def add_arcdisk(request: Request):
    data = await request.json()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
        INSERT INTO arcdisks_new (id, name, element, rarity, attack, defense, hp, effect, effect_desc, suitable)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['id'],
            data['name'],
            data['element'],
            data['rarity'],
            int(data.get('attack', 0)),
            int(data.get('defense', 0)),
            int(data.get('hp', 0)),
            data['effect'],
            data.get('effect_desc', ''),
            json.dumps(data.get('suitable', []))
        ))
        conn.commit()
        conn.close()
        return {"message": "弧盘添加成功"}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="弧盘已存在")
    except (ValueError, TypeError) as e:
        conn.close()
        raise HTTPException(status_code=400, detail="数值字段格式错误")

@app.put("/api/admin/arcdisks/{id}")
async def update_arcdisk(id: str, request: Request):
    data = await request.json()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
    UPDATE arcdisks_new SET name=?, element=?, rarity=?, attack=?, defense=?, hp=?, effect=?, effect_desc=?, suitable=?
    WHERE id=?
    ''', (
        data['name'],
        data['element'],
        data['rarity'],
        int(data.get('attack', 0)),
        int(data.get('defense', 0)),
        int(data.get('hp', 0)),
        data['effect'],
        data.get('effect_desc', ''),
        json.dumps(data.get('suitable', [])),
        id
    ))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="弧盘不存在")
    
    conn.commit()
    conn.close()
    return {"message": "弧盘更新成功"}

@app.delete("/api/admin/arcdisks/{id}")
async def delete_arcdisk(id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM arcdisks_new WHERE id=?", (id,))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="弧盘不存在")
    
    conn.commit()
    conn.close()
    return {"message": "弧盘删除成功"}

# 套装管理
@app.get("/api/admin/sets")
async def get_all_sets():
    conn = get_db_connection()
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
            "main_attr": row['main_attr'],
            "sub_attr": json.loads(row['sub_attr']),
            "suitable": json.loads(row['suitable']),
            "picture": row['picture'] if 'picture' in row.keys() else ''
        })
    return result

@app.post("/api/admin/sets")
async def add_set(request: Request):
    data = await request.json()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
        INSERT INTO sets (id, name, set2, set4, main_attr, sub_attr, suitable)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['id'],
            data['name'],
            data['set2'],
            data['set4'],
            data['main_attr'],
            json.dumps(data['sub_attr']),
            json.dumps(data['suitable'])
        ))
        conn.commit()
        conn.close()
        return {"message": "套装添加成功"}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="套装已存在")

@app.put("/api/admin/sets/{id}")
async def update_set(id: str, request: Request):
    data = await request.json()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
    UPDATE sets SET name=?, set2=?, set4=?, main_attr=?, sub_attr=?, suitable=?
    WHERE id=?
    ''', (
        data['name'],
        data['set2'],
        data['set4'],
        data['main_attr'],
        json.dumps(data['sub_attr']),
        json.dumps(data['suitable']),
        id
    ))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="套装不存在")
    
    conn.commit()
    conn.close()
    return {"message": "套装更新成功"}

@app.delete("/api/admin/sets/{id}")
async def delete_set(id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sets WHERE id=?", (id,))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="套装不存在")
    
    conn.commit()
    conn.close()
    return {"message": "套装删除成功"}

# 材料管理
@app.get("/api/admin/materials")
async def get_all_materials():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM materials")
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        result.append({
            "id": row['id'],
            "name": row['name'],
            "type": row['type'],
            "tier": row['tier'],
            "source": row['source'],
            "source_type": row['source_type'],
            "element": row['element'],
            "picture": row['picture'] if 'picture' in row.keys() else ''
        })
    return result

@app.put("/api/admin/materials")
async def update_all_materials(request: Request):
    data = await request.json()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 清空现有材料并重新插入
        cursor.execute("DELETE FROM materials")
        
        for mat in data:
            cursor.execute('''
            INSERT INTO materials (id, name, type, tier, source, source_type, element)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                mat['id'],
                mat['name'],
                mat['type'],
                mat.get('tier'),
                mat['source'],
                mat['source_type'],
                mat.get('element')
            ))
        
        conn.commit()
        conn.close()
        return {"message": "材料数据更新成功"}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=f"材料更新失败: {str(e)}")

@app.post("/api/admin/materials")
async def add_material(request: Request):
    data = await request.json()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
        INSERT INTO materials (id, name, type, tier, source, source_type, element)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['id'],
            data['name'],
            data['type'],
            data.get('tier'),
            data['source'],
            data['source_type'],
            data.get('element')
        ))
        conn.commit()
        conn.close()
        return {"message": "材料添加成功"}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="材料已存在")

@app.put("/api/admin/materials/{id}")
async def update_material(id: str, request: Request):
    data = await request.json()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
    UPDATE materials SET name=?, type=?, tier=?, source=?, source_type=?, element=?
    WHERE id=?
    ''', (
        data['name'],
        data['type'],
        data.get('tier'),
        data['source'],
        data['source_type'],
        data.get('element'),
        id
    ))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="材料不存在")
    
    conn.commit()
    conn.close()
    return {"message": "材料更新成功"}

@app.delete("/api/admin/materials/{id}")
async def delete_material(id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM materials WHERE id=?", (id,))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="材料不存在")
    
    conn.commit()
    conn.close()
    return {"message": "材料删除成功"}

# 知识库管理
@app.get("/api/admin/knowledge")
async def get_all_knowledge():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM knowledge")
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        result.append({
            "id": row['id'],
            "title": row['title'],
            "content": row['content'],
            "keywords": json.loads(row['keywords']) if row['keywords'] else []
        })
    return result

@app.post("/api/admin/knowledge")
async def add_knowledge(request: Request):
    data = await request.json()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
        INSERT INTO knowledge (id, title, content, keywords)
        VALUES (?, ?, ?, ?)
        ''', (
            str(uuid.uuid4()),
            data['title'],
            data['content'],
            json.dumps(data.get('keywords', []))
        ))
        conn.commit()
        conn.close()
        return {"message": "知识库添加成功"}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="知识库已存在")

@app.put("/api/admin/knowledge/{id}")
async def update_knowledge(id: str, request: Request):
    data = await request.json()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
    UPDATE knowledge SET title=?, content=?, keywords=? WHERE id=?
    ''', (
        data['title'],
        data['content'],
        json.dumps(data.get('keywords', [])),
        id
    ))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="知识库不存在")
    
    conn.commit()
    conn.close()
    return {"message": "知识库更新成功"}

@app.delete("/api/admin/knowledge/{id}")
async def delete_knowledge(id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM knowledge WHERE id=?", (id,))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="知识库不存在")
    
    conn.commit()
    conn.close()
    return {"message": "知识库删除成功"}

# ========== 角色统计 ==========
@app.post("/api/stats/view/{character_name}")
async def log_character_view(character_name: str):
    """记录角色图鉴点击"""
    record_character_view(character_name)
    return {"message": "点击已记录"}

@app.post("/api/stats/query/{character_name}")
async def log_character_query(character_name: str):
    """记录AI查询角色"""
    record_character_query(character_name)
    return {"message": "查询已记录"}

@app.get("/api/stats/characters")
async def get_stats():
    """获取所有角色统计数据"""
    return get_character_stats()

@app.get("/api/stats/favorite")
async def get_favorite():
    """获取最喜好角色"""
    fav = get_favorite_character()
    if fav:
        return fav
    return {"character_name": None, "total_count": 0}

@app.get("/api/stats/pie-chart")
async def get_pie_chart_data():
    """获取饼图数据"""
    return get_stats_for_pie_chart()

@app.post("/api/stats/reset")
async def reset_stats():
    """重置所有角色统计数据"""
    reset_character_stats()
    return {"message": "统计数据已重置"}

# ========== 前端静态文件托管 ==========
# 打包后由 FastAPI 直接托管前端构建产物（frontend/dist/），
# 用户无需安装 Node.js，只需打开 http://localhost:8000 即可访问。
_frontend_dir = get_frontend_dir()
if os.path.isdir(os.path.join(_frontend_dir, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(_frontend_dir, "assets")), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(_frontend_dir, "index.html"))

    # SPA 兜底：非 /api 路径一律返回 index.html
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not found")
        return FileResponse(os.path.join(_frontend_dir, "index.html"))

# ========== 首次启动自动初始化数据库 ==========
def _ensure_database():
    """如果数据库不存在（首次运行 / 被删除），自动从 data/*.json 初始化"""
    if os.path.exists(DB_PATH):
        return
    print("[INIT] Database not found, initializing from data files...")
    try:
        import init_db
        init_db.main()
    except Exception as e:
        print(f"[INIT] init_db failed: {e}")
    try:
        import init_sets
        init_sets.main()
    except Exception as e:
        print(f"[INIT] init_sets failed: {e}")
    print("[INIT] Database ready.")

# 云端部署（uvicorn/gunicorn as module 模式）下 if __name__ == "__main__" 不会执行，
# 必须把首次建库挂到 FastAPI 启动钩子上。本地 python main.py 路径仍走 __main__ 块，
# 因 _ensure_database 内部 if os.path.exists(DB_PATH): return 保证幂等，可被安全重复调用。
@app.on_event("startup")
def _startup_init_db():
    _ensure_database()

if __name__ == "__main__":
    _ensure_database()
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)