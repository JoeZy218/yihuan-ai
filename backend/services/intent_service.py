"""
意图识别服务（纯规则、零依赖）：
- 黑名单关键词过滤（政治/色情/暴力等），命中即返回固定拒绝话术
- 问候语、闲聊（身份/能力/感谢/新手）识别，返回随机模板回复
- 游戏相关性判断：命中游戏关键词（角色名、机制术语）即放行；
  对 15 字以内的短问题宽松放行，避免误伤口语化提问
"""
import os
import json
import re
import random
from typing import Optional, List, Tuple

from path_resolver import get_data_dir

DATA_DIR = get_data_dir()

BLACKLIST_KEYWORDS = [
    "政治", "新闻", "色情", "暴力", "赌博", "违法", "广告"
]

REJECT_MESSAGE = "抱歉，这个问题超出了我的能力范围啦～ 我是《异环》游戏助手，可以帮你解答角色攻略、配队推荐、弧盘卡带等游戏相关问题哦！"

# 问候词汇
GREETING_KEYWORDS = [
    "你好", "嗨", "嘿", "hi", "hello", "您好", "在吗", "在不在",
    "早上好", "晚上好", "下午好", "早安", "晚安",
    "喂", "嘿嘿", "嗨嗨", "哈喽", "哈罗",
]

# 闲聊/日常对话词汇
CASUAL_KEYWORDS = [
    "你是谁", "你叫什么", "你能做什么", "你会什么",
    "谢谢", "感谢", "多谢", "可以", "好的", "明白了",
    "还有吗", "其他", "没事了", "先这样", "拜拜",
    "还行", "不错", "厉害", "牛",
    "帮我", "教我", "告诉我", "问一下", "想知道",
    "怎么用", "怎么玩", "新手", "刚入坑", "萌新",
]

# 游戏相关关键词（用于快速意图判断）
GAME_KEYWORDS = [
    "异环",
    # 角色名
    "九原", "哈索尔", "娜娜莉", "安魂曲", "小吱", "异能者", "零",
    "早雾", "法帝娅", "浔", "白藏", "达芙蒂尔", "哈尼娅",
    "埃德嘉", "海月", "翳", "薄荷", "阿德勒",
    # 游戏机制
    "配队", "弧盘", "技能", "材料", "突破", "元素", "反应", "副本",
    "装备", "卡带", "套装", "角色", "队伍", "阵容", "攻略", "养成", "升级",
    "主C", "副C", "辅助", "生存", "护盾", "治疗", "暴击", "伤害",
    "光", "暗", "灵", "相", "魂", "咒",
    "武器", "抽卡", "保底", "体力", "周本",
    "环合", "倾陷", "变轨", "极轨", "终结", "援护",
    "空幕", "调弧", "共鸣", "混频", "异能",
    "金谷", "闪送之力", "言灵", "噩梦", "敌神者",
]

# 问候回复模板
GREETING_RESPONSES = [
    "你好呀！😄 我是《异环》游戏助手，可以叫我小环。有什么关于游戏的问题尽管问我吧！",
    "嗨～欢迎来到异环战术教室！🌟 我可以帮你配队、推荐弧盘卡带、解答角色攻略，你想了解什么？",
    "你好呀！很高兴见到你！👋 我是你的异环游戏小助手，无论是角色培养、队伍搭配还是装备选择，都可以问我哦～",
]

# 闲聊回复模板
CASUAL_RESPONSES = {
    "identity": [
        "我是《异环》游戏助手小环！😊 熟悉游戏里所有角色的技能、弧盘卡带、配队策略。有什么想知道的尽管问！",
        "我是小环，你的异环战术顾问！🎮 角色攻略、配队推荐、弧盘卡带选择……我都能帮到你~",
    ],
    "thanks": [
        "不客气！😄 如果还有其他疑问随时可以问我哦～",
        "很高兴能帮到你！🌟 下次有问题再来找我吧~",
        "哈哈不用谢！祝你游戏玩得开心~ 🎉",
    ],
    "newbie": [
        "欢迎新玩家！🎉 建议你可以先了解一下角色定位，然后我帮你推荐配队和培养方向。\n\n你可以试试问我：\n- 「新手用什么角色好？」\n- 「小吱怎么配队？」\n- 「哪个角色值得培养？」",
    ],
    "capability": [
        "我可以帮你做很多事情哦~ 💪\n\n👤 **角色攻略**：技能解析、培养建议\n⚔️ **配队推荐**：根据你的角色推荐最佳阵容\n💎 **弧盘推荐**：专武选择和属性分析\n🎯 **卡带推荐**：卡带选择和词条搭配\n📦 **材料查询**：突破材料和获取途径\n\n直接问就行，比如「九原用什么弧盘？」",
    ],
}


def is_greeting(text: str) -> bool:
    """判断是否为问候语"""
    text_clean = text.strip().lower()
    # 短文本问候
    if len(text_clean) <= 5:
        for kw in GREETING_KEYWORDS:
            if kw in text_clean:
                return True
    # 稍长的问候
    for kw in GREETING_KEYWORDS:
        if text_clean.startswith(kw) or text_clean == kw:
            return True
    return False


def is_casual_chat(text: str) -> Optional[str]:
    """判断是否为闲聊/日常对话，返回闲聊类型或None"""
    text_clean = text.strip()
    # 身份询问
    if any(kw in text_clean for kw in ["你是谁", "你叫什么", "你是什么"]):
        return "identity"
    # 能力询问
    if any(kw in text_clean for kw in ["你能做什么", "你会什么", "怎么用", "帮我什么", "有什么功能"]):
        return "capability"
    # 感谢
    if any(kw in text_clean for kw in ["谢谢", "感谢", "多谢", "拜拜", "谢啦"]):
        return "thanks"
    # 新手
    if any(kw in text_clean for kw in ["新手", "刚入坑", "萌新", "刚开始玩", "刚下载"]):
        return "newbie"
    return None


def get_greeting_response() -> str:
    """获取随机问候回复"""
    return random.choice(GREETING_RESPONSES)


def get_casual_response(chat_type: str) -> str:
    """获取闲聊回复"""
    responses = CASUAL_RESPONSES.get(chat_type, CASUAL_RESPONSES["identity"])
    return random.choice(responses)


def check_blacklist(text: str) -> Tuple[bool, str]:
    """检查文本是否包含黑名单关键词，命中则返回拒绝话术"""
    for keyword in BLACKLIST_KEYWORDS:
        if keyword in text:
            return True, REJECT_MESSAGE
    return False, ""


def quick_intent_check(text: str) -> bool:
    """快速意图判断：文本是否包含游戏相关关键词"""
    for keyword in GAME_KEYWORDS:
        if keyword in text:
            return True
    return False


def validate_input(text: str) -> Tuple[bool, str]:
    """验证用户输入：长度检查 + 黑名单检查"""
    if len(text) > 500:
        return True, "问题太长啦～ 请精简一下再问我吧！😊"
    blocked, msg = check_blacklist(text)
    if blocked:
        return True, msg
    return False, ""


def is_game_related(text: str) -> bool:
    """判断问题是否与异环游戏相关"""
    if quick_intent_check(text):
        return True
    # 对于较短的模糊问题，宽松处理
    if len(text.strip()) <= 15:
        return True
    return False