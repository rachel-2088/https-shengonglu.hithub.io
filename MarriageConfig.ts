/**
 * 女官婚恋配置表 —— 数值来自《深宫录》全局数值配置表 第十一、十二节
 * 好感阶段 / 四类互动增量 / 好感下降 / 职级解锁品级 / 结婚条件 / 职场助力 / 婚后剧情。
 * ⚠️ 本文件所有数值均集中于此，业务系统不得硬编码。
 */
import {
  AffectionStage,
  CareerAssistConfig,
  EncounterSpot,
  MaritalEventConfig,
  MaritalEventType,
  MarriageConditionConfig,
  MinisterInteraction,
  OfficialGrade,
  OfficialRank,
} from '../types/types';

/** 好感阶段阈值（下限，闭区间；命中最高满足条件者） */
export const AFFECTION_STAGE_THRESHOLDS: { min: number; stage: AffectionStage; label: string }[] = [
  { min: 96, stage: AffectionStage.PROMISE, label: '相许' },
  { min: 81, stage: AffectionStage.DEEP, label: '情深' },
  { min: 61, stage: AffectionStage.FOND, label: '倾心' },
  { min: 41, stage: AffectionStage.ADMIRE, label: '欣赏' },
  { min: 21, stage: AffectionStage.ACQUAINT, label: '初识' },
  { min: 0, stage: AffectionStage.STRANGER, label: '陌生' },
];

/** 四类核心互动 + 兼容互动的好感增量（配置化，便于平衡） */
export const INTERACTION_AFFECTION_GAIN: Record<MinisterInteraction, number> = {
  [MinisterInteraction.GIFT]: 8,                // 送礼
  [MinisterInteraction.POEM]: 10,               // 诗文唱和
  [MinisterInteraction.ASSIST]: 12,             // 偶遇相助
  [MinisterInteraction.COURT_INTERACTION]: 6,   // 朝堂互动
  [MinisterInteraction.GREET]: 3,               // 搭讪（兼容）
  [MinisterInteraction.HEART_TALK]: 9,          // 交心（兼容）
};

/** 送对喜好物品的额外好感加成 */
export const FAVORITE_GIFT_BONUS = 6;

/** 好感下降规则（配置化，均为正数，系统内部取负） */
export const AFFECTION_DECAY = {
  /** 长时间不互动：每月自然衰减 */
  noContactMonthly: 2,
  /** 送错礼物（非喜好物品） */
  wrongGift: 4,
  /** 朝堂互动失利 */
  courtMisfire: 6,
  /** 剧情事件导致的好感暴跌 */
  storyScandal: 15,
} as const;

/** 职级 → 可邂逅朝臣的最高品级（数字越小品级越高，越难邂逅） */
export const RANK_MINISTER_UNLOCK: Record<OfficialRank, OfficialGrade | null> = {
  [OfficialRank.NV_SHI]: null,      // 女史：未解锁
  [OfficialRank.ZHANG_SHI]: null,   // 掌事：未解锁
  [OfficialRank.DIAN_SHI]: OfficialGrade.PIN_7,  // 典事：七品及以下
  [OfficialRank.SI_ZUO]: OfficialGrade.PIN_6,    // 司佐：六品及以下
  [OfficialRank.SI_SHI]: OfficialGrade.PIN_5,    // 司事：五品及以下
  [OfficialRank.SI_ZHENG]: OfficialGrade.PIN_4,  // 司正：四品及以下
  [OfficialRank.JU_CHENG]: OfficialGrade.PIN_3,  // 局丞：三品及以下
  [OfficialRank.JU_ZUO]: OfficialGrade.PIN_2,    // 局佐：二品及以下
  [OfficialRank.SHANG_SHU]: OfficialGrade.PIN_1, // 尚属：一品及以下
  [OfficialRank.SHANG_GONG]: OfficialGrade.PIN_1,// 尚宫：全部
};

/** 女官结婚硬性条件（职级≥典事、好感满值、声望≥60、无负面DEBUFF） */
export const MARRIAGE_CONDITIONS: MarriageConditionConfig = {
  minOfficialRank: OfficialRank.DIAN_SHI,
  requiredAffection: 96,   // V4修复：与"相许"阶段阈值(AFFECTION_STAGE_THRESHOLDS)对齐，原100与96倒挂
  minReputation: 60,
  requireNoDebuff: true,
};

/** 婚后恩爱值规则 */
export const MARRIAGE_LOVE_CONFIG = {
  initialLove: 50,
  visitGain: 6,
  birthdayGain: 10,
  quarrelLoss: 8,
  fullBonusThreshold: 80,
} as const;

/** 品级对应的年末声望加成 */
export const GRADE_YEARLY_REPUTATION_BONUS: Record<OfficialGrade, number> = {
  [OfficialGrade.PIN_9]: 2,
  [OfficialGrade.PIN_8]: 4,
  [OfficialGrade.PIN_7]: 6,
  [OfficialGrade.PIN_6]: 9,
  [OfficialGrade.PIN_5]: 12,
  [OfficialGrade.PIN_4]: 16,
  [OfficialGrade.PIN_3]: 20,
  [OfficialGrade.PIN_2]: 25,
  [OfficialGrade.PIN_1]: 30,
};

/**
 * 职场助力数值化配置（按夫君品级）—— 数值来自配置表第十节"职场/宫廷助力效果"
 * 用于年末结算与每月助力，替代原 assistEffect 文本在逻辑层的硬编码判断。
 */
export const CAREER_ASSIST_BY_GRADE: Record<OfficialGrade, CareerAssistConfig> = {
  [OfficialGrade.PIN_9]: { monthlyMeritBonus: 0, monthlyReputationBonus: 0, penaltyExemptPerYear: 0, promotionDifficultyReduction: 0 },
  [OfficialGrade.PIN_8]: { monthlyMeritBonus: 0, monthlyReputationBonus: 1, penaltyExemptPerYear: 0, promotionDifficultyReduction: 0 },
  [OfficialGrade.PIN_7]: { monthlyMeritBonus: 0, monthlyReputationBonus: 1, penaltyExemptPerYear: 0, promotionDifficultyReduction: 0 },
  [OfficialGrade.PIN_6]: { monthlyMeritBonus: 5, monthlyReputationBonus: 0, penaltyExemptPerYear: 0, promotionDifficultyReduction: 0 },
  [OfficialGrade.PIN_5]: { monthlyMeritBonus: 8, monthlyReputationBonus: 0, penaltyExemptPerYear: 0, promotionDifficultyReduction: 0 },
  [OfficialGrade.PIN_4]: { monthlyMeritBonus: 0, monthlyReputationBonus: 0, penaltyExemptPerYear: 0, promotionDifficultyReduction: 0 },
  [OfficialGrade.PIN_3]: { monthlyMeritBonus: 0, monthlyReputationBonus: 0, penaltyExemptPerYear: 1, promotionDifficultyReduction: 0 },
  [OfficialGrade.PIN_2]: { monthlyMeritBonus: 0, monthlyReputationBonus: 5, penaltyExemptPerYear: 0, promotionDifficultyReduction: 0 },
  [OfficialGrade.PIN_1]: { monthlyMeritBonus: 0, monthlyReputationBonus: 0, penaltyExemptPerYear: 0, promotionDifficultyReduction: 0.5 },
};

/** 婚后专属剧情配置（恩爱/争执/独处/生辰，入口预留，权重用于随机抽取） */
export const MARITAL_EVENT_CONFIGS: MaritalEventConfig[] = [
  { type: MaritalEventType.AFFECTIONATE, name: '琴瑟和鸣', loveDelta: 6, weight: 40 },
  { type: MaritalEventType.QUARREL, name: '闺阁争执', loveDelta: -8, weight: 15 },
  { type: MaritalEventType.SOLITUDE, name: '独处幽思', loveDelta: 2, weight: 25 },
  { type: MaritalEventType.BIRTHDAY, name: '夫君生辰', loveDelta: 10, weight: 20 },
];

/** 每月刷新邂逅列表时，每个点位抽取的朝臣数量 */
export const ENCOUNTER_REFRESH_COUNT = 3;
