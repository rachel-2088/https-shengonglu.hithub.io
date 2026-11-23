/**
 * 朝廷文武百官配置表 —— 数值来自《深宫录》全局数值配置表 第十节
 * 含：18 个官职模板（文9+武9）+ 18 名具名 NPC 完整人设（文武九品至一品各一名）。
 * 每个朝臣字段：ID/姓名/官职品级/文武类型/性格标签/外貌气质/初始好感/喜好物品/邂逅地点/背景人设。
 * 女官线专属，职级达【典事】后按品级上限逐步解锁。
 */
import {
  EncounterSpot,
  MinisterConfig,
  MinisterType,
  OfficialGrade,
} from '../types/types';

/** 官职模板（品级 → 名称/加成/助力），九品最低、一品最高 */
export interface MinisterTemplate {
  grade: OfficialGrade;
  type: MinisterType;
  title: string;
  annualSilverBonus: number;
  assistEffect: string;
}

/** 文官体系 */
export const CIVIL_TEMPLATES: MinisterTemplate[] = [
  { grade: OfficialGrade.PIN_9, type: MinisterType.CIVIL, title: '县衙主簿', annualSilverBonus: 20, assistEffect: '无' },
  { grade: OfficialGrade.PIN_8, type: MinisterType.CIVIL, title: '县衙县丞', annualSilverBonus: 35, assistEffect: '小幅声望加成' },
  { grade: OfficialGrade.PIN_7, type: MinisterType.CIVIL, title: '监察御史', annualSilverBonus: 60, assistEffect: '减少被弹劾概率' },
  { grade: OfficialGrade.PIN_6, type: MinisterType.CIVIL, title: '州府通判', annualSilverBonus: 90, assistEffect: '每月额外功勋+5' },
  { grade: OfficialGrade.PIN_5, type: MinisterType.CIVIL, title: '州府知州', annualSilverBonus: 120, assistEffect: '每月额外功勋+8' },
  { grade: OfficialGrade.PIN_4, type: MinisterType.CIVIL, title: '六部侍郎', annualSilverBonus: 180, assistEffect: '差事容错率大幅提升' },
  { grade: OfficialGrade.PIN_3, type: MinisterType.CIVIL, title: '六部尚书', annualSilverBonus: 260, assistEffect: '直接免除一次职场责罚' },
  { grade: OfficialGrade.PIN_2, type: MinisterType.CIVIL, title: '内阁大学士', annualSilverBonus: 350, assistEffect: '每年大幅全属性加成' },
  { grade: OfficialGrade.PIN_1, type: MinisterType.CIVIL, title: '当朝丞相', annualSilverBonus: 500, assistEffect: '女官晋升难度减半，权势滔天' },
];

/** 武官体系 */
export const MILITARY_TEMPLATES: MinisterTemplate[] = [
  { grade: OfficialGrade.PIN_9, type: MinisterType.MILITARY, title: '巡检巡尉', annualSilverBonus: 18, assistEffect: '小幅安保加持' },
  { grade: OfficialGrade.PIN_8, type: MinisterType.MILITARY, title: '禁军校尉', annualSilverBonus: 32, assistEffect: '减少被害、陷害概率' },
  { grade: OfficialGrade.PIN_7, type: MinisterType.MILITARY, title: '边关守备', annualSilverBonus: 55, assistEffect: '体质永久+5' },
  { grade: OfficialGrade.PIN_6, type: MinisterType.MILITARY, title: '军营参将', annualSilverBonus: 85, assistEffect: '人脉每月+6' },
  { grade: OfficialGrade.PIN_5, type: MinisterType.MILITARY, title: '游击将军', annualSilverBonus: 110, assistEffect: '宫廷威慑提升' },
  { grade: OfficialGrade.PIN_4, type: MinisterType.MILITARY, title: '副将', annualSilverBonus: 160, assistEffect: '不被低位嫔妃欺凌' },
  { grade: OfficialGrade.PIN_3, type: MinisterType.MILITARY, title: '镇守总兵', annualSilverBonus: 220, assistEffect: '大幅声望加成' },
  { grade: OfficialGrade.PIN_2, type: MinisterType.MILITARY, title: '大都督', annualSilverBonus: 320, assistEffect: '宫廷地位大幅拔高' },
  { grade: OfficialGrade.PIN_1, type: MinisterType.MILITARY, title: '护国大将军', annualSilverBonus: 480, assistEffect: '后宫无人敢惹，权势极高' },
];

function templateKey(grade: OfficialGrade, type: MinisterType): string {
  return `${type}_${grade}`;
}
const TEMPLATE_MAP: Record<string, MinisterTemplate> = {};
[...CIVIL_TEMPLATES, ...MILITARY_TEMPLATES].forEach((t) => {
  TEMPLATE_MAP[templateKey(t.grade, t.type)] = t;
});
export function getMinisterTemplate(grade: OfficialGrade, type: MinisterType): MinisterTemplate | undefined {
  return TEMPLATE_MAP[templateKey(grade, type)];
}

/**
 * 具名朝臣 NPC 花名册（完整人设）。
 * 喜好物品 ID 对应商店道具表（ShopConfig.ts）；邂逅点位对应 EncounterSpot 四点位。
 */
interface RosterEntry {
  id: string;
  name: string;
  type: MinisterType;
  grade: OfficialGrade;
  tags: string[];                 // 性格标签
  appearanceTrait: string;        // 外貌气质
  initialAffection: number;       // 初始好感
  favoriteItems: string[];        // 喜好物品 ID
  encounterSpots: EncounterSpot[];// 邂逅地点
  backstory: string;              // 背景人设
}

export const MINISTER_ROSTER: RosterEntry[] = [
  // —————————————————— 文官 ——————————————————
  { id: 'min_c9', name: '沈文清', type: MinisterType.CIVIL, grade: OfficialGrade.PIN_9,
    tags: ['年轻才俊', '谦逊', '好学'], appearanceTrait: '清秀斯文', initialAffection: 5,
    favoriteItems: ['brush_painting', 'plain_silk'], encounterSpots: [EncounterSpot.GATE, EncounterSpot.HAN_LIN],
    backstory: '寒门苦读新科及第，初入仕途，常怀治国安民之志。' },
  { id: 'min_c8', name: '陆知微', type: MinisterType.CIVIL, grade: OfficialGrade.PIN_8,
    tags: ['清正', '耿直', '洁癖'], appearanceTrait: '清癯儒雅', initialAffection: 4,
    favoriteItems: ['brush_painting', 'fine_incense'], encounterSpots: [EncounterSpot.GATE, EncounterSpot.HAN_LIN],
    backstory: '以明经入仕，为官清正不阿，最厌趋炎附势之辈。' },
  { id: 'min_c7', name: '苏御史', type: MinisterType.CIVIL, grade: OfficialGrade.PIN_7,
    tags: ['刚直不阿', '铁面', '孤傲'], appearanceTrait: '剑眉星目', initialAffection: 2,
    favoriteItems: ['brush_painting'], encounterSpots: [EncounterSpot.GATE, EncounterSpot.BANQUET],
    backstory: '掌纠弹之责，不畏权贵，朝中权臣皆忌其三分。' },
  { id: 'min_c6', name: '范通判', type: MinisterType.CIVIL, grade: OfficialGrade.PIN_6,
    tags: ['干练', '圆融', '务实'], appearanceTrait: '温文敦厚', initialAffection: 6,
    favoriteItems: ['fine_incense', 'pearl_jewelry'], encounterSpots: [EncounterSpot.GATE, EncounterSpot.BANQUET],
    backstory: '久历州府，深谙世故，办事稳妥，颇得上官赏识。' },
  { id: 'min_c5', name: '欧阳修撰', type: MinisterType.CIVIL, grade: OfficialGrade.PIN_5,
    tags: ['风雅', '才子', '多情'], appearanceTrait: '玉树临风', initialAffection: 8,
    favoriteItems: ['brush_painting', 'fine_incense'], encounterSpots: [EncounterSpot.HAN_LIN, EncounterSpot.BANQUET],
    backstory: '诗文冠绝一时，风流倜傥，坊间传其才子佳人轶事甚多。' },
  { id: 'min_c4', name: '李侍郎', type: MinisterType.CIVIL, grade: OfficialGrade.PIN_4,
    tags: ['权臣', '深沉', '城府'], appearanceTrait: '面如冠玉', initialAffection: 3,
    favoriteItems: ['pearl_jewelry', 'brocade'], encounterSpots: [EncounterSpot.BANQUET, EncounterSpot.GATE],
    backstory: '六部侍郎，位高权重，行事深沉难测，善于经营朝中关系。' },
  { id: 'min_c3', name: '张尚书', type: MinisterType.CIVIL, grade: OfficialGrade.PIN_3,
    tags: ['位高权重', '威严', '持重'], appearanceTrait: '雍容华贵', initialAffection: 2,
    favoriteItems: ['brocade', 'pearl_jewelry'], encounterSpots: [EncounterSpot.BANQUET],
    backstory: '六部尚书，历经数朝，门生故吏遍天下，一言可定朝局。' },
  { id: 'min_c2', name: '徐阁老', type: MinisterType.CIVIL, grade: OfficialGrade.PIN_2,
    tags: ['三朝元老', '睿智', '慈和'], appearanceTrait: '鹤发童颜', initialAffection: 5,
    favoriteItems: ['brush_painting', 'fine_incense'], encounterSpots: [EncounterSpot.BANQUET],
    backstory: '内阁大学士，三朝元老，德高望重，天子亦敬其三分。' },
  { id: 'min_c1', name: '当朝丞相', type: MinisterType.CIVIL, grade: OfficialGrade.PIN_1,
    tags: ['权倾朝野', '运筹帷幄', '冷峻'], appearanceTrait: '气宇轩昂', initialAffection: 0,
    favoriteItems: ['brocade', 'pearl_jewelry'], encounterSpots: [EncounterSpot.BANQUET],
    backstory: '位极人臣，权倾朝野，一人之下万人之上，寻常人难得一见。' },
  // —————————————————— 武官 ——————————————————
  { id: 'min_m9', name: '赵巡尉', type: MinisterType.MILITARY, grade: OfficialGrade.PIN_9,
    tags: ['年轻武弁', '热血', '爽直'], appearanceTrait: '朝气蓬勃', initialAffection: 6,
    favoriteItems: ['tonic_fine', 'plain_silk'], encounterSpots: [EncounterSpot.GATE, EncounterSpot.YAN_WU_CHANG],
    backstory: '初入禁军的小校，血气方刚，一心建功立业。' },
  { id: 'min_m8', name: '钱校尉', type: MinisterType.MILITARY, grade: OfficialGrade.PIN_8,
    tags: ['禁军', '忠勇', '豪爽'], appearanceTrait: '虎背熊腰', initialAffection: 5,
    favoriteItems: ['tonic_fine', 'fine_incense'], encounterSpots: [EncounterSpot.GATE, EncounterSpot.YAN_WU_CHANG],
    backstory: '掌禁军巡值，忠勇可靠，宫中上下皆知其名。' },
  { id: 'min_m7', name: '孙守备', type: MinisterType.MILITARY, grade: OfficialGrade.PIN_7,
    tags: ['边关将领', '坚毅', '寡言'], appearanceTrait: '棱角分明', initialAffection: 3,
    favoriteItems: ['tonic_fine'], encounterSpots: [EncounterSpot.YAN_WU_CHANG, EncounterSpot.GATE],
    backstory: '镇守边关多年，刀疤满身，性情坚毅寡言。' },
  { id: 'min_m6', name: '周参将', type: MinisterType.MILITARY, grade: OfficialGrade.PIN_6,
    tags: ['豪爽', '仗义', '好酒'], appearanceTrait: '浓眉大眼', initialAffection: 7,
    favoriteItems: ['tonic_fine', 'pearl_jewelry'], encounterSpots: [EncounterSpot.YAN_WU_CHANG, EncounterSpot.BANQUET],
    backstory: '军中豪杰，仗义疏财，最爱交游，常赴宫宴。' },
  { id: 'min_m5', name: '吴游击', type: MinisterType.MILITARY, grade: OfficialGrade.PIN_5,
    tags: ['威震宫廷', '果敢', '严厉'], appearanceTrait: '英气逼人', initialAffection: 4,
    favoriteItems: ['tonic_fine', 'brocade'], encounterSpots: [EncounterSpot.YAN_WU_CHANG, EncounterSpot.BANQUET],
    backstory: '游击将军，用兵如神，宫廷禁卫多出其麾下。' },
  { id: 'min_m4', name: '郑副将', type: MinisterType.MILITARY, grade: OfficialGrade.PIN_4,
    tags: ['沉稳', '缜密', '护短'], appearanceTrait: '不怒自威', initialAffection: 4,
    favoriteItems: ['brocade', 'tonic_fine'], encounterSpots: [EncounterSpot.BANQUET, EncounterSpot.YAN_WU_CHANG],
    backstory: '副将，行事沉稳缜密，极重情义，护短之名军中皆知。' },
  { id: 'min_m3', name: '冯总兵', type: MinisterType.MILITARY, grade: OfficialGrade.PIN_3,
    tags: ['镇守一方', '威严', '战功赫赫'], appearanceTrait: '魁梧雄健', initialAffection: 2,
    favoriteItems: ['brocade', 'pearl_jewelry'], encounterSpots: [EncounterSpot.BANQUET],
    backstory: '镇守总兵，战功赫赫，边关几十年，敌军闻风丧胆。' },
  { id: 'min_m2', name: '楚大都督', type: MinisterType.MILITARY, grade: OfficialGrade.PIN_2,
    tags: ['位极人臣', '霸气', '深沉'], appearanceTrait: '龙章凤姿', initialAffection: 1,
    favoriteItems: ['brocade', 'fine_incense'], encounterSpots: [EncounterSpot.BANQUET],
    backstory: '大都督，掌全国兵马，宫廷地位崇高，非大典不轻现身。' },
  { id: 'min_m1', name: '护国大将军', type: MinisterType.MILITARY, grade: OfficialGrade.PIN_1,
    tags: ['权势极高', '冷峻', '传奇'], appearanceTrait: '威武不屈', initialAffection: 0,
    favoriteItems: ['brocade', 'pearl_jewelry'], encounterSpots: [EncounterSpot.BANQUET],
    backstory: '护国大将军，国之柱石，后宫无人敢惹，寻常场合难觅踪影。' },
];

/** 由花名册 + 模板生成完整 MinisterConfig（运行时使用） */
export const MINISTER_CONFIGS: MinisterConfig[] = MINISTER_ROSTER.map((entry) => {
  const tpl = getMinisterTemplate(entry.grade, entry.type)!;
  return {
    id: entry.id,
    name: entry.name,
    type: entry.type,
    grade: entry.grade,
    title: tpl.title,
    tags: entry.tags,
    annualSilverBonus: tpl.annualSilverBonus,
    assistEffect: tpl.assistEffect,
    encounterScenes: [],
    appearanceTrait: entry.appearanceTrait,
    initialAffection: entry.initialAffection,
    favoriteItems: entry.favoriteItems,
    backstory: entry.backstory,
    encounterSpots: entry.encounterSpots,
  };
});

const CONFIG_MAP: Record<string, MinisterConfig> = {};
MINISTER_CONFIGS.forEach((c) => { CONFIG_MAP[c.id] = c; });

export function getMinisterConfig(id: string): MinisterConfig | undefined {
  return CONFIG_MAP[id];
}

/** 按文武类别取朝臣池 */
export function getMinistersByType(type: MinisterType): MinisterConfig[] {
  return MINISTER_CONFIGS.filter((c) => c.type === type);
}
