/**
 * 子嗣生育与培养数值配置表 —— 妃嫔线贵人及以上专属
 * ------------------------------------------------------------------
 * 所有子嗣相关数值集中于此，业务层零硬编码。
 * 生育概率公式复用 FAVOR_EFFECTS（EmperorConfig）：12% + 帝宠/300 + 体质/100。
 * ⚠️ 剧情文案含蓄（侍寝/龙胎/诞育以"承宠/龙胎不稳/诞下"表述），避免露骨描写，以微信官方最新规范为准。
 */
import {
  AdultOutcomeConfig,
  ChildEventConfig,
  ChildEventType,
  ChildHealth,
  ChildbirthConfig,
  EducationConfig,
  EducationFocus,
  GrowthStageConfig,
  PregnancyEventConfig,
  PregnancyEventType,
  ChildGrowthStage,
  ConsortRank,
} from '../types/types';

/** 子嗣生育基础配置 */
export const CHILDBIRTH_CONFIG: ChildbirthConfig = {
  unlockRank: ConsortRank.GUI_REN, // 贵人及以上解锁
  pregnancyMonths: 10,             // 怀胎十月
  initialFetalHealth: 100,         // 受孕时胎儿健康基准
  lowConstitutionThreshold: 35,    // 体质低于 35 视为过低，增加滑胎风险
  miscarriageBaseChance: 0.03,     // 滑胎基础概率 3%
  pregnancyDebuff: {
    id: 'db_pregnant',
    name: '龙胎不稳',
    desc: '身怀龙胎，行事需格外谨慎（怀孕状态标记，含蓄表述）。',
  },
};

/** 怀胎期随机事件（每月抽取一次，事件结果影响胎儿健康与滑胎概率） */
export const PREGNANCY_EVENTS: PregnancyEventConfig[] = [
  {
    type: PregnancyEventType.PEACEFUL,
    name: '安稳养胎',
    desc: '这一月风平浪静，你在宫中静心养胎，胎儿安稳。',
    weight: 55,
    fetalHealthDelta: 5,
    miscarriageChance: 0,
  },
  {
    type: PregnancyEventType.CALM_TROUBLE,
    name: '安胎风波',
    desc: '一时饮食不节，腹中隐隐不适，太医急来诊治。',
    weight: 30,
    fetalHealthDelta: -12,
    miscarriageChance: 0.05,
    effects: { attributes: { constitution: -3 } },
  },
  {
    type: PregnancyEventType.MALICIOUS,
    name: '被人暗算',
    desc: '宫中暗流涌动，一剂药的来路蹊跷，所幸察觉及时。',
    weight: 15,
    fetalHealthDelta: -22,
    miscarriageChance: 0.12,
    effects: { attributes: { wit: 2 } },
  },
];

/** 成长阶段年龄门槛（按 minAge 降序命中第一条） */
export const GROWTH_STAGES: GrowthStageConfig[] = [
  { stage: ChildGrowthStage.ADULT, minAge: 16, label: '成年' },
  { stage: ChildGrowthStage.YOUTH, minAge: 7, label: '少年' },
  { stage: ChildGrowthStage.TODDLER, minAge: 3, label: '幼童' },
  { stage: ChildGrowthStage.SWADDLE, minAge: 0, label: '襁褓' },
];

/** 教养方向配置（每月消耗银两，按方向提升四维） */
export const EDUCATION_CONFIGS: EducationConfig[] = [
  {
    focus: EducationFocus.LITERARY,
    name: '诗书',
    desc: '延请师傅教习诗书，重在天资与心性。',
    cost: 30,
    attrGain: { talent: 4, mind: 2 },
    minStageIndex: 1, // 幼童起
  },
  {
    focus: EducationFocus.MARTIAL,
    name: '骑射',
    desc: '习武强身，重在体魄。',
    cost: 35,
    attrGain: { physique: 5, mind: 1 },
    minStageIndex: 1,
  },
  {
    focus: EducationFocus.VIRTUE,
    name: '德行',
    desc: '教以礼仪德行，重在心性。',
    cost: 25,
    attrGain: { mind: 5, talent: 1 },
    minStageIndex: 0, // 襁褓起（启蒙）
  },
  {
    focus: EducationFocus.ARTS,
    name: '才艺',
    desc: '习琴棋书画，重在容貌气度。',
    cost: 40,
    attrGain: { appearance: 4, talent: 2 },
    minStageIndex: 1,
  },
];

/** 请教习额外加成（银两，按方向四维各 +N） */
export const TUTOR_CONFIG = {
  cost: 60,
  attrBonus: 6,
  favorBonus: 2, // 请教习答谢，主角威望小幅+（帝宠联动）
  prestigeBonus: 2,
} as const;

/** 子嗣随机事件（每月教养后有概率触发） */
export const CHILD_EVENTS: ChildEventConfig[] = [
  {
    type: ChildEventType.ILLNESS,
    name: '偶感风寒',
    desc: '{childName}偶感风寒，汤药不断，幸无大碍。',
    weight: 25,
    minAge: 0,
    healthDelta: -15,
  },
  {
    type: ChildEventType.DILIGENT,
    name: '勤学不辍',
    desc: '{childName}近日勤学不辍，师傅连连称赞。',
    weight: 30,
    minAge: 3,
    healthDelta: 0,
    attrGain: { talent: 3, mind: 2 },
  },
  {
    type: ChildEventType.MISCHIEF,
    name: '顽皮闯祸',
    desc: '{childName}顽皮闯祸，打碎了御赐的器物，你不得不暗中赔付。',
    weight: 20,
    minAge: 3,
    healthDelta: 0,
    silverDelta: -20,
    attrGain: { mind: 1 },
  },
  {
    type: ChildEventType.SOCIAL,
    name: '皇子往来',
    desc: '{childName}与其他皇子公主来往，结识了不少玩伴。',
    weight: 25,
    minAge: 5,
    healthDelta: 2,
    attrGain: { mind: 2, appearance: 1 },
  },
];

/** 子嗣随机事件触发概率（每月教养后判定） */
export const CHILD_EVENT_TRIGGER = {
  baseChance: 0.35,
  /** 健康状态为虚弱/病危时的额外发病概率 */
  weakHealthBonus: 0.2,
  /** 健康状态阈值：低于此值视为病弱 */
  weakHealthThreshold: 50,
} as const;

/** 健康状态阈值（按健康值降序命中第一条） */
export const HEALTH_THRESHOLDS = [
  { min: 75, health: ChildHealth.HEALTHY },
  { min: 40, health: ChildHealth.WEAK },
  { min: 15, health: ChildHealth.CRITICAL },
  { min: 0, health: ChildHealth.DECEASED },
];

/** 夭折判定（健康病危时每月概率） */
export const MORTALITY_RULE = {
  criticalHealthThreshold: 40, // 健康低于 40 即进入病危区间（对应 HEALTH_THRESHOLDS.CRITICAL），可触发夭折
  deathChancePerMonth: 0.15,   // 每月 15% 夭折概率
} as const;

/** 成年结局分支（四维总分 = talent+physique+mind+appearance，按 minScore 降序命中第一条） */
export const ADULT_OUTCOMES: AdultOutcomeConfig[] = [
  {
    minScore: 320,
    title: '封亲王/固伦公主',
    marriage: '赐婚显贵，权倾朝野',
    courtAid: '朝堂助力极强，可为母族荫庇',
    prestigeBonus: 30,
  },
  {
    minScore: 260,
    title: '封郡王/和硕公主',
    marriage: '婚配世家，门第显赫',
    courtAid: '朝堂助力可观',
    prestigeBonus: 20,
  },
  {
    minScore: 200,
    title: '封贝勒/庶公主',
    marriage: '婚配官宦人家',
    courtAid: '略有朝堂助力',
    prestigeBonus: 12,
  },
  {
    minScore: 0,
    title: '闲散宗室',
    marriage: '婚配寻常人家',
    courtAid: '无朝堂助力',
    prestigeBonus: 5,
  },
];

/** 出生四维随机区间（0~100，取该区间内随机） */
export const BIRTH_ATTR_RANGE = {
  min: 35,
  max: 70,
} as const;

/** 名字池（皇子/公主各一组，出生时随机取用） */
export const CHILD_NAMES = {
  male: ['弘曦', '弘玦', '弘珩', '承乾', '承烨', '昭珩', '昭凛', '景珩'],
  female: ['昭宁', '昭华', '明仪', '明玥', '婉清', '婉宁', '柔嘉', '静姝'],
} as const;

/** 按四维总分查询成年结局 */
export function getAdultOutlook(score: number): AdultOutcomeConfig {
  return ADULT_OUTCOMES.find((o) => score >= o.minScore) ?? ADULT_OUTCOMES[ADULT_OUTCOMES.length - 1];
}

/** 按健康值查询健康状态 */
export function resolveHealthState(health: number): ChildHealth {
  return HEALTH_THRESHOLDS.find((t) => health >= t.min)?.health ?? ChildHealth.DECEASED;
}

/** 按年龄查询成长阶段 */
export function resolveGrowthStage(age: number): GrowthStageConfig {
  return GROWTH_STAGES.find((s) => age >= s.minAge) ?? GROWTH_STAGES[GROWTH_STAGES.length - 1];
}
