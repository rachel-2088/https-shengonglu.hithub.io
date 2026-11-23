/**
 * 差事任务数值配置表 —— 宫女勤谨 / 女官公务 / 妃嫔宫廷 三路线
 * ------------------------------------------------------------------
 * 每月自动刷新差事池；晋升专属差事在达门槛后刷出，完成才可晋升。
 * 所有奖励/惩罚/难度读此表，业务层零硬编码。
 */
import { ConsortRank, DutyCategory, DutyConfigData, MaidRank, OfficialRank } from '../types/types';

export const DUTY_CONFIGS: DutyConfigData[] = [
  // ==================== 宫女勤谨差事 ====================
  {
    id: 'duty_laundry', name: '浣衣当值', desc: '在浣衣局浆洗衣物，勤谨当差。',
    category: DutyCategory.MAID_DILIGENCE, minRank: null, actionCost: 1, difficulty: 0.15,
    requiredItem: 'duty_laundry_token',
    reward: { silver: 8, diligence: 12, attributes: { constitution: 2 } },
    penalty: { diligence: -6, attributes: { constitution: -2 } },
  },
  {
    id: 'duty_bureau_daily', name: '六局值夜', desc: '在本局值房当夜差，谨慎侍上。',
    category: DutyCategory.MAID_DILIGENCE, minRank: MaidRank.PU_TONG, actionCost: 1, difficulty: 0.25,
    reward: { silver: 12, diligence: 16, attributes: { wit: 2 } },
    penalty: { diligence: -8 },
  },
  {
    id: 'duty_herb_gather', name: '太医院采药', desc: '为太医院采集草药，需几分眼力。',
    category: DutyCategory.MAID_DILIGENCE, minRank: MaidRank.GUAN_SHI, actionCost: 1, difficulty: 0.35,
    reward: { silver: 15, diligence: 20, attributes: { constitution: 3 } },
    penalty: { diligence: -10, attributes: { constitution: -3 } },
  },
  {
    id: 'duty_promote_guan_shi', name: '晋位考校·管事', desc: '管事宫女晋位考校，需妥善处置一桩纠纷。',
    category: DutyCategory.MAID_DILIGENCE, minRank: MaidRank.PU_TONG, actionCost: 1, difficulty: 0.45,
    isPromotion: true, promotionTarget: MaidRank.GUAN_SHI,
    reward: { diligence: 30, silver: 20 },
    penalty: { diligence: -12 },
  },
  {
    id: 'duty_promote_zhang_shi', name: '晋位考校·掌事', desc: '掌事姑姑晋位考校，需统管一局月务。',
    category: DutyCategory.MAID_DILIGENCE, minRank: MaidRank.GUAN_SHI, actionCost: 1, difficulty: 0.55,
    isPromotion: true, promotionTarget: MaidRank.ZHANG_SHI,
    reward: { diligence: 40, silver: 30 },
    penalty: { diligence: -15 },
  },

  // ==================== 女官公务差事 ====================
  {
    id: 'duty_memorial', name: '誊录奏章', desc: '在尚宫局誊录奏章副本，无误为要。',
    category: DutyCategory.OFFICIAL_DUTY, minRank: null, actionCost: 1, difficulty: 0.2,
    reward: { silver: 15, merit: 12, reputation: 4, attributes: { talent: 2 } },
    penalty: { merit: -6, reputation: -3 },
  },
  {
    id: 'duty_bureau_affairs', name: '本局日常公务', desc: '处理本局日常文书与事务。',
    category: DutyCategory.OFFICIAL_DUTY, minRank: null, actionCost: 1, difficulty: 0.25,
    reward: { silver: 18, merit: 14, reputation: 5 },
    penalty: { merit: -7, reputation: -4 },
  },
  {
    id: 'duty_bureau_special', name: '六局专项核账', desc: '核查本局账册，需账册副本一份。',
    category: DutyCategory.OFFICIAL_DUTY, minRank: OfficialRank.ZHANG_SHI, actionCost: 1, difficulty: 0.4,
    requiredItem: 'duty_ledger',
    reward: { silver: 25, merit: 22, reputation: 8, attributes: { wit: 3 } },
    penalty: { merit: -10, reputation: -6 },
  },
  // 女官晋升专属差事（9级全覆盖：女史→掌事→…→尚宫；V4修复补齐7条缺失职级）
  {
    id: 'duty_promote_zhang_shi', name: '晋阶考课·掌事', desc: '女官晋掌事考课，需协理一司文书。',
    category: DutyCategory.OFFICIAL_DUTY, minRank: OfficialRank.NV_SHI, actionCost: 1, difficulty: 0.45,
    isPromotion: true, promotionTarget: OfficialRank.ZHANG_SHI,
    reward: { merit: 28, reputation: 12, silver: 24 },
    penalty: { merit: -10 },
  },
  {
    id: 'duty_promote_dian_shi', name: '晋阶考课·典事', desc: '女官晋典事考课，需独当一面处置公务。',
    category: DutyCategory.OFFICIAL_DUTY, minRank: OfficialRank.ZHANG_SHI, actionCost: 1, difficulty: 0.5,
    isPromotion: true, promotionTarget: OfficialRank.DIAN_SHI,
    reward: { merit: 35, reputation: 15, silver: 30 },
    penalty: { merit: -12 },
  },
  {
    id: 'duty_promote_si_zuo', name: '晋阶考课·司佐', desc: '女官晋司佐考课，需佐理局务、统筹属吏。',
    category: DutyCategory.OFFICIAL_DUTY, minRank: OfficialRank.DIAN_SHI, actionCost: 1, difficulty: 0.55,
    isPromotion: true, promotionTarget: OfficialRank.SI_ZUO,
    reward: { merit: 40, reputation: 18, silver: 36 },
    penalty: { merit: -13 },
  },
  {
    id: 'duty_promote_si_shi', name: '晋阶考课·司事', desc: '女官晋司事考课，需统筹一司事务。',
    category: DutyCategory.OFFICIAL_DUTY, minRank: OfficialRank.SI_ZUO, actionCost: 1, difficulty: 0.6,
    isPromotion: true, promotionTarget: OfficialRank.SI_SHI,
    reward: { merit: 45, reputation: 20, silver: 40 },
    penalty: { merit: -15 },
  },
  {
    id: 'duty_promote_si_zheng', name: '晋阶考课·司正', desc: '女官晋司正考课，需纠察六局、持正不阿。',
    category: DutyCategory.OFFICIAL_DUTY, minRank: OfficialRank.SI_SHI, actionCost: 1, difficulty: 0.65,
    isPromotion: true, promotionTarget: OfficialRank.SI_ZHENG,
    reward: { merit: 50, reputation: 24, silver: 46 },
    penalty: { merit: -17 },
  },
  {
    id: 'duty_promote_ju_cheng', name: '晋阶考课·局丞', desc: '女官晋局丞考课，需总揽一局、调度有方。',
    category: DutyCategory.OFFICIAL_DUTY, minRank: OfficialRank.SI_ZHENG, actionCost: 1, difficulty: 0.7,
    isPromotion: true, promotionTarget: OfficialRank.JU_CHENG,
    reward: { merit: 56, reputation: 28, silver: 54 },
    penalty: { merit: -19 },
  },
  {
    id: 'duty_promote_ju_zuo', name: '晋阶考课·局佐', desc: '女官晋局佐考课，需协理宫务、应对非常。',
    category: DutyCategory.OFFICIAL_DUTY, minRank: OfficialRank.JU_CHENG, actionCost: 1, difficulty: 0.75,
    isPromotion: true, promotionTarget: OfficialRank.JU_ZUO,
    reward: { merit: 62, reputation: 32, silver: 62 },
    penalty: { merit: -21 },
  },
  {
    id: 'duty_promote_shang_shu', name: '晋阶考课·尚属', desc: '女官晋尚属考课，需通晓六局、赞襄宫政。',
    category: DutyCategory.OFFICIAL_DUTY, minRank: OfficialRank.JU_ZUO, actionCost: 1, difficulty: 0.8,
    isPromotion: true, promotionTarget: OfficialRank.SHANG_SHU,
    reward: { merit: 70, reputation: 36, silver: 72 },
    penalty: { merit: -24 },
  },
  {
    id: 'duty_promote_shang_gong', name: '晋阶考课·尚宫', desc: '女官晋尚宫考课，需总领六局、位极女官之试。',
    category: DutyCategory.OFFICIAL_DUTY, minRank: OfficialRank.SHANG_SHU, actionCost: 1, difficulty: 0.85,
    isPromotion: true, promotionTarget: OfficialRank.SHANG_GONG,
    reward: { merit: 80, reputation: 42, silver: 84 },
    penalty: { merit: -27 },
  },

  // ==================== 妃嫔宫廷差事 ====================
  {
    id: 'duty_tribute', name: '料理宫宴', desc: '筹备宫中宴席，得体者得圣心。',
    category: DutyCategory.CONSORT_DUTY, minRank: null, actionCost: 1, difficulty: 0.25,
    reward: { silver: 20, prestige: 10, attributes: { social: 3 } },
    penalty: { prestige: -6 },
  },
  {
    id: 'duty_draw_salary', name: '库房领月例', desc: '前往库房领取本月俸禄。',
    category: DutyCategory.CONSORT_DUTY, minRank: null, actionCost: 1, difficulty: 0.05,
    reward: { silver: 5, prestige: 1 },
    penalty: {},
  },
  {
    id: 'duty_palace_etiquette', name: '宫廷礼仪应对', desc: '宴上应对得体，彰显气度。',
    category: DutyCategory.CONSORT_DUTY, minRank: ConsortRank.CHANG_ZAI, actionCost: 1, difficulty: 0.35,
    reward: { silver: 25, prestige: 15, favor: 3, attributes: { wit: 3 } },
    penalty: { prestige: -8, favor: -2 },
  },
  {
    id: 'duty_promote_pin', name: '晋位差事·嫔', desc: '晋嫔专属差事，需于宫宴上独当一面。',
    category: DutyCategory.CONSORT_DUTY, minRank: ConsortRank.GUI_REN, actionCost: 1, difficulty: 0.55,
    isPromotion: true, promotionTarget: ConsortRank.PIN,
    reward: { prestige: 40, favor: 5, silver: 50 },
    penalty: { prestige: -12 },
  },
];

/** 每月刷新的普通差事数量（晋升差事不计入） */
export const DUTY_REFRESH_CONFIG = {
  count: 4,
  /** 晋升差事：达门槛后必定刷出 */
  promotionAlwaysInclude: true,
} as const;

const DUTY_MAP: Record<string, DutyConfigData> = {};
DUTY_CONFIGS.forEach((d) => { DUTY_MAP[d.id] = d; });

/** 按 ID 查差事配置 */
export function getDutyConfig(id: string): DutyConfigData | undefined {
  return DUTY_MAP[id];
}

/** 按路线取差事池（含晋升差事，运行时再按门槛过滤） */
export function getDutiesByCategory(cat: DutyCategory): DutyConfigData[] {
  return DUTY_CONFIGS.filter((d) => d.category === cat);
}
