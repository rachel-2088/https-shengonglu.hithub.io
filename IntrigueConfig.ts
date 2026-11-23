/**
 * 嫔妃博弈配置表 —— 关系玩法 + 宫斗随机事件
 * 数值来源：《深宫录》全局数值配置表 第九节"事件浮动参考"+ 第一/七节，关系玩法为原创设定。
 * ⚠️ 所有数值集中于此，业务系统不得硬编码。
 */
import {
  ConsortRelation,
  ConsortRelationConfig,
  IntrigueEventConfig,
  IntrigueEventType,
} from '../types/types';

/** 对嫔妃的七种关系玩法（好感 + 人脉/威望/心智增减） */
export const CONSORT_RELATION_CONFIGS: ConsortRelationConfig[] = [
  {
    type: ConsortRelation.BEFRIEND,
    name: '交好',
    desc: '主动亲近，闲话家常，结一份善缘。',
    affectionDelta: 8,
    effects: { attributes: { social: 2 }, prestige: 1 },
  },
  {
    type: ConsortRelation.ALLAY,
    name: '拉拢',
    desc: '许以好处，引为奥援，壮大己方声势。',
    affectionDelta: 12,
    effects: { attributes: { social: 3 }, silver: -10 },
  },
  {
    type: ConsortRelation.DISTANCE,
    name: '疏远',
    desc: '刻意回避，划清界限，免遭池鱼之殃。',
    affectionDelta: -6,
    effects: { attributes: { wit: 2 }, prestige: -1 },
  },
  {
    type: ConsortRelation.BALANCE,
    name: '制衡',
    desc: '表面周旋，暗中分散其势力，不令一家独大。',
    affectionDelta: -3,
    effects: { attributes: { wit: 3 }, prestige: 2 },
  },
  {
    type: ConsortRelation.COUNTER,
    name: '反击',
    desc: '抓住把柄，当众还以颜色，扳回一局。',
    affectionDelta: -12,
    effects: { attributes: { wit: 2 }, prestige: 3, favor: 1 },
  },
  {
    type: ConsortRelation.GIFT,
    name: '送礼',
    desc: '投其所好，以物传情。',
    affectionDelta: 6,
    favoriteBonus: 5,
    effects: {},
  },
  {
    type: ConsortRelation.SPY,
    name: '刺探消息',
    desc: '旁敲侧击，暗中打探，伺机掌握把柄。',
    affectionDelta: -5,
    effects: { attributes: { wit: 2 } },
  },
];

const RELATION_MAP: Record<string, ConsortRelationConfig> = {};
CONSORT_RELATION_CONFIGS.forEach((r) => { RELATION_MAP[r.type] = r; });
export function getRelationConfig(type: ConsortRelation): ConsortRelationConfig | undefined {
  return RELATION_MAP[type];
}

/** 送礼喜好物品（送对走 favoriteBonus） */
export const CONSORT_FAVORITE_ITEMS: Record<string, string[]> = {
  cnp_empress: ['silk_brocade', 'calligraphy'],
  cnp_guifei: ['pearl_jewelry', 'rare_incense'],
  cnp_fei: ['calligraphy', 'rare_incense'],
  cnp_pin: ['plain_silk', 'tonic_common'],
  cnp_zai: ['plain_silk', 'tonic_common'],
  cnp_ying: ['pearl_jewelry', 'silk_brocade'],
  cnp_de: ['calligraphy', 'plain_silk'],
  cnp_ning: ['calligraphy', 'rare_incense'],
};

/** 宫斗随机事件池（陷害/反制/流言/解围/站队/宴会争风吃醋） */
export const INTRIGUE_EVENT_CONFIGS: IntrigueEventConfig[] = [
  {
    type: IntrigueEventType.FRAME,
    name: '无端陷害',
    desc: '有嫔妃暗中使人将失窃之物塞进你的宫中，欲加罪于你。',
    weight: 25,
    threshold: { wit: 45, social: 35 },
    baseSuccessRate: 0.5,
    success: { prestige: 12, attributes: { wit: 5, social: 3 } },
    fail: { prestige: -15, favor: -8, attributes: { wit: -5 }, debuff: { id: 'db_frame', name: '流言缠身', desc: '宫中流言四起，晋升受阻', remainMonths: 3 } },
  },
  {
    type: IntrigueEventType.COUNTER,
    name: '借力反制',
    desc: '对手步步进逼，你决定抓住其疏漏，反将一军。',
    weight: 15,
    threshold: { wit: 55 },
    baseSuccessRate: 0.55,
    success: { prestige: 10, attributes: { wit: 8, social: 6 } },
    fail: { prestige: -8, attributes: { social: -5 } },
  },
  {
    type: IntrigueEventType.RUMOR,
    name: '暗地流言',
    desc: '宫中悄然传起关于你的闲话，来源不明。',
    weight: 20,
    threshold: { wit: 40, social: 40 },
    baseSuccessRate: 0.45,
    success: { prestige: 8, attributes: { wit: 4 } },
    fail: { prestige: -10, attributes: { social: -4 }, debuff: { id: 'db_rumor', name: '流言在耳', desc: '流言未平，帝宠稍减', remainMonths: 2 } },
  },
  {
    type: IntrigueEventType.RESCUE,
    name: '贵人解围',
    desc: '你因小事被人发难，一位嫔妃出言为你解围。',
    weight: 12,
    threshold: { social: 50, prestige: 40 },
    baseSuccessRate: 0.6,
    success: { favor: 5, prestige: 10, attributes: { social: 8 } },
    fail: { prestige: -6, attributes: { social: -3 } },
  },
  {
    type: IntrigueEventType.ALIGN,
    name: '宫宴站队',
    desc: '宫宴之上两派对峙，你必须表明立场。',
    weight: 18,
    threshold: { prestige: 50 },
    baseSuccessRate: 0.6,
    success: { prestige: 8, attributes: { social: 8 } },
    fail: { prestige: -5, attributes: { social: -8 }, debuff: { id: 'db_align', name: '站队失当', desc: '得罪一方，行事受阻', remainMonths: 2 } },
  },
  {
    type: IntrigueEventType.BANQUET_JEALOUSY,
    name: '宴会争风',
    desc: '席间有人借敬酒之名讽你专宠，四座目光齐聚。',
    weight: 10,
    threshold: { favor: 60, wit: 40 },
    baseSuccessRate: 0.5,
    success: { favor: 8, prestige: 10, attributes: { appearance: 3 } },
    fail: { favor: -10, prestige: -12, debuff: { id: 'db_jealousy', name: '妒火中伤', desc: '风头太盛，招致嫉恨', remainMonths: 3 } },
  },
];

/** 低忠心侍从泄密反噬规则（对应全局设定第七节） */
export const SERVANT_LEAK_RULE = {
  /** 忠心低于此值有泄密风险 */
  lowLoyaltyThreshold: 30,
  /** 每次陷害事件中，低忠心侍从泄密的基础概率 */
  leakBaseChance: 0.3,
  /** 泄密导致额外惩罚（威望/帝宠） */
  leakPenalty: { prestige: -6, favor: -4 },
  /** 机敏≥此值可自动化解部分陷害 */
  clevernessAutoCounter: 70,
  /** 机敏达标时的化解概率 */
  autoCounterChance: 0.4,
} as const;

/** 事件浮动：好事成功 / 坏事失败的属性与威望区间（全局第九节） */
export const INTRIGUE_EVENT_FLOAT = {
  good: { attr: { min: 5, max: 15 }, prestige: { min: 8, max: 20 } },
  bad: { attr: { min: 5, max: 15 }, prestige: { min: 8, max: 20 }, debuffChance: 0.3 },
} as const;

/** 嫔妃对主角的态度阈值（按好感，命中最高满足条件者） */
export const CONSORT_ATTITUDE_THRESHOLDS = [
  { min: 80, label: '亲近' },
  { min: 60, label: '友善' },
  { min: 40, label: '平淡' },
  { min: 20, label: '戒备' },
  { min: 0, label: '敌视' },
];

/** 刺探消息规则（掌握把柄概率） */
export const SPY_RULE = {
  baseChance: 0.35,
  witPerPoint: 0.004,
  maxChance: 0.9,
} as const;

/** 宫斗事件成功判定算法常数（门槛达标度 → 成功率） */
export const INTRIGUE_SUCCESS_RULE = {
  missPenaltyPerThreshold: 0.12,
  exceedBonusPerPoint: 0.002,
  exceedBonusCap: 0.1,
  minRate: 0.05,
  maxRate: 0.95,
} as const;
