"""
配装数据初始化脚本（start.bat 第 2 步执行）：
- 创建 arcdisks_new（弧盘/专武，含攻防血数值）和 sets（卡带/套装，含2件/4件效果）表
- 内置真实弧盘 15 个、卡带 12 套的静态数据并写入数据库（INSERT OR IGNORE）
- 通过 set_mapping 回填 characters.best_set（角色 → 推荐卡带）
- 同时给 characters 表补充 best_set 列（ALTER TABLE，已存在则忽略）
"""
import sqlite3
import json
import os

from path_resolver import get_db_path


# === 真实弧盘(专武)数据 ===
arcdisk_data = [
    {
        "id": "xiuxiri",
        "name": "休息日",
        "element": "光",
        "rarity": "S",
        "attack": 42,
        "defense": 0,
        "hp": 0,
        "effect": "日蚀·攻击力提升30%",
        "effect_desc": "攻击力提升30%，调弧可创造持续40秒的日蚀效果，日蚀期间击杀敌人恢复6点终结能量",
        "suitable": ["异能者·零"],
        "picture": "https://patchwiki.biligame.com/images/yh/4/42/evyexhb94t2ea4k64rv43e5cluvfesx.png"
    },
    {
        "id": "yinhezanliu",
        "name": "银河暂留",
        "element": "灵",
        "rarity": "S",
        "attack": 35,
        "defense": 0,
        "hp": 80,
        "effect": "水星图·魂属性增伤",
        "effect_desc": "魂属性异能伤害增加12%，造成魂属性伤害时暴击伤害提高2%，最多叠10层（总计20%暴伤）",
        "suitable": ["海月"],
        "picture": "https://patchwiki.biligame.com/images/yh/e/e9/2vuornv6vbqymboqefu513bnr16ufox.png"
    },
    {
        "id": "sikaomiao",
        "name": "思考喵",
        "element": "光",
        "rarity": "S",
        "attack": 45,
        "defense": 0,
        "hp": 0,
        "effect": "玛门·光属性增伤",
        "effect_desc": "每持有10万方斯（金谷），光属性异能伤害提高2.5%，最多叠10层（总计25%光伤加成）",
        "suitable": ["小吱"]
    },
    {
        "id": "yanhunkuangbiao",
        "name": "焰魂狂飙",
        "element": "相",
        "rarity": "S",
        "attack": 45,
        "defense": 0,
        "hp": 0,
        "effect": "无首铁驭·相属性增伤",
        "effect_desc": "相属性异能伤害提升(12.5+2.5*混频强度阶数)%，极轨终结后变轨和终结伤害进一步提升",
        "suitable": ["哈索尔"]
    },
    {
        "id": "yinbaoquanchang",
        "name": "引爆全场",
        "element": "暗",
        "rarity": "S",
        "attack": 42,
        "defense": 0,
        "hp": 0,
        "effect": "音霸魔王·攻击力提升",
        "effect_desc": "后台时当前角色攻击力+10%，造成伤害叠加攻击力；前台时魂属性伤害+12%",
        "suitable": ["哈尼娅"]
    },
    {
        "id": "jingzhige",
        "name": "鲸之歌",
        "element": "光",
        "rarity": "S",
        "attack": 30,
        "defense": 40,
        "hp": 100,
        "effect": "深蓝之恸·倾陷增伤",
        "effect_desc": "攻击力+12%，对处于倾陷状态的敌人伤害额外+12%",
        "suitable": ["娜娜莉", "异能者·零"]
    },
    {
        "id": "qiheiqingchunwangxiang",
        "name": "漆黑青春妄想",
        "element": "暗",
        "rarity": "S",
        "attack": 44,
        "defense": 0,
        "hp": 0,
        "effect": "黑之书·倾陷+暗伤",
        "effect_desc": "倾陷强度+60，解锁调弧后指定敌人受到的暗属性伤害提升20%",
        "suitable": ["达芙蒂尔"]
    },
    {
        "id": "xianshibinanso",
        "name": "现实避难所",
        "element": "灵",
        "rarity": "S",
        "attack": 44,
        "defense": 0,
        "hp": 0,
        "effect": "斑蝶·灵伤+附着物加成",
        "effect_desc": "灵属性异能伤害+15%，附着物伤害+10%，极轨终结后附着物伤害提升至+20%",
        "suitable": ["九原"]
    },
    {
        "id": "mianjuxiadeli",
        "name": "面具下的泪",
        "element": "咒",
        "rarity": "S",
        "attack": 40,
        "defense": 0,
        "hp": 0,
        "effect": "囿巢鸟·减伤+标记",
        "effect_desc": "极轨终结命中敌人标记「警告视线」，被标记敌人造成的伤害降低18%",
        "suitable": ["早雾"]
    },
    {
        "id": "chahuahui",
        "name": "茶花会",
        "element": "咒",
        "rarity": "S",
        "attack": 38,
        "defense": 0,
        "hp": 60,
        "effect": "静默庭园·暴伤提升",
        "effect_desc": "未受伤或降血后5秒内暴击伤害+16%，最多叠4次（总计64%暴伤），拥有调弧技能",
        "suitable": ["白藏"]
    },
    {
        "id": "yonghenyuanwuqu",
        "name": "永恒圆舞曲",
        "element": "魂",
        "rarity": "S",
        "attack": 30,
        "defense": 50,
        "hp": 120,
        "effect": "阿拉克涅·生命+心灵伤害",
        "effect_desc": "生命值+20%，极轨终结后心灵伤害+10%，稳定提升持续作战能力",
        "suitable": ["法帝娅"]
    },
    {
        "id": "haogougouzousifang",
        "name": "好狗狗走四方",
        "element": "咒",
        "rarity": "S",
        "attack": 38,
        "defense": 0,
        "hp": 60,
        "effect": "墨菲克斯·充能+全队攻击",
        "effect_desc": "充能效率+18%，极轨终结后全队攻击力+10%，控制效果额外+6%",
        "suitable": ["早雾"]
    },
    {
        "id": "qianjinnanmainikaixing",
        "name": "千金难买你开心",
        "element": "光",
        "rarity": "S",
        "attack": 36,
        "defense": 30,
        "hp": 60,
        "effect": "纳库佩达·生命+随机治疗",
        "effect_desc": "生命值+24%，极轨终结后随机触发治疗/护盾/全队回血效果",
        "suitable": ["通用"]
    },
    {
        "id": "haiteluodeanning",
        "name": "海特洛的安宁",
        "element": "光",
        "rarity": "S",
        "attack": 40,
        "defense": 30,
        "hp": 80,
        "effect": "通行正义·攻击+Boss增伤",
        "effect_desc": "攻击力+15%，对Boss伤害+15%，拥有调弧可召唤巡哨鼠鼠辅助作战",
        "suitable": ["异能者·零"]
    },
    {
        "id": "xingjinyushijianzhiwai",
        "name": "行进于时间之外",
        "element": "光",
        "rarity": "S",
        "attack": 44,
        "defense": 0,
        "hp": 0,
        "effect": "时间之外·攻击+荒时迷宫",
        "effect_desc": "攻击力+16%，拥有荒时迷宫机制，提升光属性伤害和无视防御能力",
        "suitable": ["浔"]
    }
]

# 弧盘图片映射（来源：Bilibili Wiki CDN）
arcdisk_pictures = {
    "休息日": "https://patchwiki.biligame.com/images/yh/4/42/evyexhb94t2ea4k64rv43e5cluvfesx.png",
    "思考喵": "https://patchwiki.biligame.com/images/yh/b/b8/axfjdmt6cwvii91d9cqd290zo1pmd6s.png",
    "焰魂狂飙": "https://patchwiki.biligame.com/images/yh/8/83/lss4m5imozuq75fi978i9tjiq7qwr33.png",
    "引爆全场": "https://patchwiki.biligame.com/images/yh/7/74/d792syd8oa0k3oimxh4a9ae5ximsk97.png",
    "鲸之歌": "https://patchwiki.biligame.com/images/yh/2/2b/bnbrk5ssq4dfbf2ahywkzbeqh43l9df.png",
    "漆黑青春妄想": "https://patchwiki.biligame.com/images/yh/1/1c/55iqg8aryr4cr0x49nbey1ce5p4v1id.png",
    "现实避难所": "https://patchwiki.biligame.com/images/yh/a/af/q4mt27dkjcy31fqhuu58xfohzuqb3bz.png",
    "面具下的泪": "https://patchwiki.biligame.com/images/yh/b/b3/13nwm3np3wezazt3cuujopbuf17xahi.png",
    "茶花会": "https://patchwiki.biligame.com/images/yh/b/b9/h7iq14tui5l0jd2muzvha7ci2pb6k0y.png",
    "永恒圆舞曲": "https://patchwiki.biligame.com/images/yh/b/ba/t84qy84zaqfdurz80nioyh8ejlm1kkk.png",
    "好狗狗走四方": "https://patchwiki.biligame.com/images/yh/3/33/nwtp0ltxzeqi9ey0bbcbkywnyi2xb7m.png",
    "千金难买你开心": "https://patchwiki.biligame.com/images/yh/3/3d/iqiefhcsk752pathkntxisx80a4rnr0.png",
    "海特洛的安宁": "https://patchwiki.biligame.com/images/yh/2/20/q0rgh9v7r41xqh35m0ovfv261es4nqj.png",
    "行进于时间之外": "https://patchwiki.biligame.com/images/yh/b/b9/47xo2qx1t42bth92c63tt74c018bttp.png",
}

# === 真实卡带数据 - 12套 ===
set_data = [
    {
        "id": "diyabolusi",
        "name": "迪亚波罗斯",
        "set2": "暗属性伤害+10%",
        "set4": "无视12%暗属性抗性，参与暗属性相关反应后提升至24%无视暗属性抗性",
        "main_attr": '{"position_1":"攻击力","position_2":"攻击力","position_3":"暗属性伤害加成","position_4":"暴击率"}',
        "sub_attr": '["暴击率", "暴击伤害", "攻击力", "攻击力%"]',
        "suitable": '["安魂曲", "达芙蒂尔"]'
    },
    {
        "id": "emozhixue",
        "name": "恶魔之血",
        "set2": "魂属性伤害+10%",
        "set4": "2件套+4件套总共提高46%增伤（属性单一，容易稀释）",
        "main_attr": '{"position_1":"攻击力","position_2":"攻击力","position_3":"魂属性伤害加成","position_4":"暴击率"}',
        "sub_attr": '["暴击率", "暴击伤害", "攻击力", "攻击力%"]',
        "suitable": '["暂无适配"]'
    },
    {
        "id": "jietouquanwang",
        "name": "街头拳王",
        "set2": "相属性伤害+10%",
        "set4": "最多提高28%暴击率，大幅优化双暴面板配比",
        "main_attr": '{"position_1":"攻击力","position_2":"攻击力","position_3":"相属性伤害加成","position_4":"暴击伤害"}',
        "sub_attr": '["暴击率", "暴击伤害", "攻击力", "攻击力%"]',
        "suitable": '["哈索尔", "翳"]'
    },
    {
        "id": "jingmishanzhuang",
        "name": "静谧山庄",
        "set2": "心灵伤害+10%",
        "set4": "最多提供46%心灵伤害增伤，普攻C可保证满覆盖",
        "main_attr": '{"position_1":"攻击力","position_2":"攻击力","position_3":"心灵伤害加成","position_4":"暴击率"}',
        "sub_attr": '["暴击率", "暴击伤害", "攻击力", "攻击力%"]',
        "suitable": '["暂无适配"]'
    },
    {
        "id": "senlingyinghuozhixin",
        "name": "森林萤火之心",
        "set2": "灵属性伤害+10%",
        "set4": "敌人受到灵属性伤害时提高8%暴击伤害，最多叠7层(56%暴伤)，后台生效",
        "main_attr": '{"position_1":"攻击力","position_2":"攻击力","position_3":"灵属性伤害加成","position_4":"暴击率"}',
        "sub_attr": '["暴击率", "暴击伤害", "攻击力", "攻击力%"]',
        "suitable": '["娜娜莉", "九原", "薄荷"]'
    },
    {
        "id": "shiluoguangmang",
        "name": "失落光芒",
        "set2": "光属性伤害+10%",
        "set4": "开大后获得持续20秒的25%无视防御",
        "main_attr": '{"position_1":"攻击力","position_2":"攻击力","position_3":"光属性伤害加成","position_4":"暴击率"}',
        "sub_attr": '["暴击率", "暴击伤害", "攻击力", "攻击力%"]',
        "suitable": '["浔", "小吱", "异能者·零"]'
    },
    {
        "id": "shouweiwangguo",
        "name": "守卫王国",
        "set2": "防御力+20%",
        "set4": "护盾吸收量增加30%，防御属性依赖的盾辅专用",
        "main_attr": '{"position_1":"防御力","position_2":"生命值","position_3":"防御力%","position_4":"防御力%"}',
        "sub_attr": '["防御力", "防御力%", "生命值", "生命值%"]',
        "suitable": '["阿德勒"]'
    },
    {
        "id": "tinadeyejianjinuguan",
        "name": "缇娜的夜间酒馆",
        "set2": "治疗效果+15%",
        "set4": "生命属性依赖的奶妈专用套装，提升治疗量",
        "main_attr": '{"position_1":"生命值","position_2":"生命值","position_3":"治疗加成","position_4":"生命值%"}',
        "sub_attr": '["生命值", "生命值%", "防御力", "充能效率"]',
        "suitable": '["埃德嘉"]'
    },
    {
        "id": "xiaoxiaodamaoxian",
        "name": "小小大冒险",
        "set2": "生命值+20%",
        "set4": "开大后直接吃满总共50%生命加成，高频少量掉血容易叠满",
        "main_attr": '{"position_1":"生命值","position_2":"生命值","position_3":"生命值%","position_4":"生命值%"}',
        "sub_attr": '["生命值", "生命值%", "防御力", "充能效率"]',
        "suitable": '["法帝娅"]'
    },
    {
        "id": "yinsulanciwei",
        "name": "音速蓝刺猬",
        "set2": "充能效率+12%",
        "set4": "开大后为全队带来持续20秒的15%攻击力加成",
        "main_attr": '{"position_1":"充能效率","position_2":"攻击力","position_3":"攻击力%","position_4":"充能效率"}',
        "sub_attr": '["充能效率", "攻击力", "攻击力%", "生命值%"]',
        "suitable": '["早雾", "哈尼娅", "埃德嘉", "异能者·零", "薄荷", "九原"]'
    },
    {
        "id": "yingzhixintiao",
        "name": "影之信条",
        "set2": "攻击力+10%",
        "set4": "施放变轨技能后获得持续20秒的25%攻击力加成",
        "main_attr": '{"position_1":"攻击力","position_2":"攻击力","position_3":"攻击力%","position_4":"暴击率"}',
        "sub_attr": '["暴击率", "暴击伤害", "攻击力", "攻击力%"]',
        "suitable": '["娜娜莉", "浔", "安魂曲", "小吱", "九原", "达芙蒂尔", "哈索尔", "早雾", "白藏", "异能者·零", "翳", "薄荷"]'
    },
    {
        "id": "zhenhongshuangshengdie",
        "name": "真红：双生蝶",
        "set2": "咒属性伤害+10%",
        "set4": "敌人受到咒属性伤害时叠层，叠满6层提高36%攻击力，后台生效",
        "main_attr": '{"position_1":"攻击力","position_2":"攻击力","position_3":"咒属性伤害加成","position_4":"暴击率"}',
        "sub_attr": '["暴击率", "暴击伤害", "攻击力", "攻击力%"]',
        "suitable": '["白藏", "早雾"]'
    }
]

# 更新角色的推荐套装
set_mapping = {
    "安魂曲": "迪亚波罗斯",
    "达芙蒂尔": "迪亚波罗斯",
    "哈索尔": "街头拳王",
    "翳": "街头拳王",
    "娜娜莉": "森林萤火之心",
    "九原": "森林萤火之心",
    "薄荷": "森林萤火之心",
    "浔": "失落光芒",
    "小吱": "失落光芒",
    "异能者·零": "失落光芒",
    "阿德勒": "守卫王国",
    "埃德嘉": "缇娜的夜间酒馆",
    "法帝娅": "小小大冒险",
    "早雾": "音速蓝刺猬",
    "哈尼娅": "音速蓝刺猬",
    "白藏": "真红：双生蝶",
    "海月": "音速蓝刺猬"
}


def main():
    DB_PATH = get_db_path()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS arcdisks_new (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            element TEXT NOT NULL,
            rarity TEXT NOT NULL,
            attack INTEGER,
            defense INTEGER,
            hp INTEGER,
            effect TEXT NOT NULL,
            effect_desc TEXT,
            suitable TEXT,
            picture TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sets (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            set2 TEXT NOT NULL,
            set4 TEXT NOT NULL,
            main_attr TEXT NOT NULL,
            sub_attr TEXT NOT NULL,
            suitable TEXT NOT NULL,
            picture TEXT
        )
    ''')

    try:
        cursor.execute("ALTER TABLE characters ADD COLUMN best_set TEXT")
    except sqlite3.OperationalError:
        pass

    conn.commit()
    print("[OK] Tables created/updated")

    # 将图片URL注入arcdisk数据
    for disk in arcdisk_data:
        if disk['name'] in arcdisk_pictures:
            disk['picture'] = arcdisk_pictures[disk['name']]

    for disk in arcdisk_data:
        try:
            cursor.execute('''
                INSERT OR IGNORE INTO arcdisks_new (id, name, element, rarity, attack, defense, hp, effect, effect_desc, suitable, picture)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                disk['id'],
                disk['name'],
                disk['element'],
                disk['rarity'],
                disk['attack'],
                disk['defense'],
                disk['hp'],
                disk['effect'],
                disk['effect_desc'],
                json.dumps(disk['suitable']),
                disk.get('picture', '')
            ))
        except Exception as e:
            print("[WARN] Failed to import arcdisk " + disk['name'] + ": " + str(e))

    for s in set_data:
        try:
            cursor.execute('''
                INSERT OR IGNORE INTO sets (id, name, set2, set4, main_attr, sub_attr, suitable, picture)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                s['id'],
                s['name'],
                s['set2'],
                s['set4'],
                s['main_attr'],
                s['sub_attr'],
                s['suitable'],
                ''
            ))
        except Exception as e:
            print("[WARN] Failed to import set " + s['name'] + ": " + str(e))

    for name, set_name in set_mapping.items():
        cursor.execute("UPDATE characters SET best_set = ? WHERE name = ?", (set_name, name))

    conn.commit()
    print("[OK] Data imported")
    conn.close()
    print("\n[DONE] Database updated with separate arcdisk and set tables!")


if __name__ == "__main__":
    main()
