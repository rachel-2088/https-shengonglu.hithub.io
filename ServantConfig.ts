/**
 * 侍从培养配置表 —— 三路线通用
 * 数值来源：《深宫录》全局数值配置表 第七节"侍从相关数值区间"+ 第三/四/五节侍从数量解锁。
 * ⚠️ 四维区间/赏赐增量/背叛阈值等全部集中于此，业务系统不得硬编码。
 */
import {
  ConsortRank,
  GameRoute,
  MaidRank,
  OfficialRank,
  ServantRole,
  ServantTemplate,
  ServantTrainingConfig,
} from '../types/types';

/** 侍从培养数值（全局第七节） */
export const SERVANT_TRAINING: ServantTrainingConfig = {
  initialAttrJitter: { min: -8, max: 8 },
  rewardLoyaltyGain: { min: 5, max: 12 },   // 赏赐物品：忠心+5~12
  trainAbilityGain: { min: 2, max: 5 },     // 调教：能力小幅提升
  trainExperienceGain: { min: 2, max: 5 },  // 调教：阅历小幅提升
  trainLoyaltyJitter: { min: -3, max: 3 },  // 调教：忠心随机小幅波动
  exerciseAbilityGain: { min: 1, max: 3 },  // 历练：能力长期提升
  exerciseExperienceGain: { min: 3, max: 6 },// 历练：阅历长期提升
  betrayalThreshold: 30,                    // 忠心<30 进入背叛风险
  betrayalRiskChance: 0.3,                  // 风险状态下事件额外泄密概率
  desertThreshold: 10,                      // 忠心<10 可能背离离走
};

/** 机敏/能力/阅历的联动阈值（全局第七节 + 用户要求5） */
export const SERVANT_ABILITY_THRESHOLDS = {
  /** 机敏≥70 自动化解部分陷害 */
  clevernessAutoCounter: 70,
  /** 机敏自动化解概率（宫斗系统 INTRIGUE 已引用 ServantLeakRule，此处为培养侧能力说明） */
  clevernessCounterChance: 0.4,
  /** 能力≥60 提升差事效率/办事成功率 */
  abilityEfficiency: 60,
  abilityEfficiencyBonus: 0.2,
  /** 阅历≥50 提升打探消息质量与事务应对 */
  experienceInsight: 50,
} as const;

/** 打探消息配置（消耗行动点，机敏/阅历影响成功率与质量） */
export const SERVANT_SPY_CONFIG = {
  actionCost: 1,
  /** 基础成功率 */
  baseSuccessRate: 0.5,
  /** 每点机敏加成 */
  clevernessPerPoint: 0.004,
  /** 每点阅历加成（提升质量与成功率） */
  experiencePerPoint: 0.003,
  maxSuccessRate: 0.95,
  /** 情报主题池 */
  topics: [
    { key: 'minister' as const, label: '朝臣动向', texts: ['听闻某位朝臣近日频频出入养心殿。', '有位大臣与某宫来往密切，恐非偶然。'] },
    { key: 'consort' as const, label: '嫔妃动向', texts: ['某位嫔妃近日颇得圣欢，风头正盛。', '听闻某宫主位正暗中笼络低位嫔妃。'] },
    { key: 'court' as const, label: '宫廷传闻', texts: ['宫中传闻今岁选秀或有变动。', '内廷某处夜里常有异动，众说纷纭。'] },
  ],
  /** 阅历≥阈值判为高质量，否则中等/低 */
  qualityThresholds: { high: 60, mid: 35 },
};

/** 侍从模板池（开局/招募随机抽取，id 稳定） */
export const SERVANT_TEMPLATES: ServantTemplate[] = [
  { id: 'svt_maid_1', name: '小翠', role: ServantRole.PALACE_MAID, backstory: '自小入宫，手脚麻利，最会察言观色。', base: { loyalty: 60, cleverness: 55, ability: 40, experience: 25 } },
  { id: 'svt_maid_2', name: '素云', role: ServantRole.PALACE_MAID, backstory: '书香门第沦落入宫，识得几字，心思细密。', base: { loyalty: 55, cleverness: 50, ability: 45, experience: 30 } },
  { id: 'svt_eunuch_1', name: '福安', role: ServantRole.EUNUCH, backstory: '在养心殿当过差，见多识广，善于打探。', base: { loyalty: 50, cleverness: 65, ability: 50, experience: 45 } },
  { id: 'svt_eunuch_2', name: '德顺', role: ServantRole.EUNUCH, backstory: '老成持重，办事稳妥，只是略显木讷。', base: { loyalty: 70, cleverness: 35, ability: 55, experience: 50 } },
  { id: 'svt_steward_1', name: '李嬷嬷', role: ServantRole.STEWARD, backstory: '曾掌事多年，阅历深厚，对宫中规矩了如指掌。', base: { loyalty: 65, cleverness: 60, ability: 65, experience: 70 } },
  { id: 'svt_steward_2', name: '周姑姑', role: ServantRole.STEWARD, backstory: '性情刚直，忠心可靠，就是不大懂得变通。', base: { loyalty: 75, cleverness: 45, ability: 60, experience: 60 } },
];

/** 开局按路线分配初始侍从（模板 ID） */
export const INITIAL_SERVANTS: Record<GameRoute, string[]> = {
  [GameRoute.CONSORT]: ['svt_maid_1'],                 // 秀女开局带 1 名贴身宫女
  [GameRoute.MAID]: [],                                // 宫女开局无侍从
  [GameRoute.OFFICIAL]: ['svt_eunuch_2'],              // 女官开局带 1 名老成太监
};

/** 各路线侍从数量上限解锁（按阶位） */
export const SERVANT_CAPACITY = {
  consort: [
    { rank: ConsortRank.XIU_NV, cap: 1 },
    { rank: ConsortRank.DA_YING, cap: 1 },
    { rank: ConsortRank.CHANG_ZAI, cap: 2 },  // 常在：开局1名+增养1名
    { rank: ConsortRank.GUI_REN, cap: 2 },
    { rank: ConsortRank.PIN, cap: 2 },        // 嫔可拥有两名侍从
    { rank: ConsortRank.FEI, cap: 3 },
    { rank: ConsortRank.GUI_FEI, cap: 3 },
    { rank: ConsortRank.HUANG_GUI_FEI, cap: 4 },
    { rank: ConsortRank.HUANG_HOU, cap: 5 },
  ] as { rank: ConsortRank; cap: number }[],
  official: [
    { rank: OfficialRank.NV_SHI, cap: 1 },
    { rank: OfficialRank.ZHANG_SHI, cap: 1 },
    { rank: OfficialRank.DIAN_SHI, cap: 2 },
    { rank: OfficialRank.SI_ZUO, cap: 2 },
    { rank: OfficialRank.SI_SHI, cap: 3 },
    { rank: OfficialRank.SI_ZHENG, cap: 3 },
    { rank: OfficialRank.JU_CHENG, cap: 4 },
    { rank: OfficialRank.JU_ZUO, cap: 4 },
    { rank: OfficialRank.SHANG_SHU, cap: 5 },
    { rank: OfficialRank.SHANG_GONG, cap: 6 },
  ] as { rank: OfficialRank; cap: number }[],
  maid: [
    { rank: MaidRank.CU_SHI, cap: 0 },
    { rank: MaidRank.PU_TONG, cap: 0 },
    { rank: MaidRank.GUAN_SHI, cap: 1 },
    { rank: MaidRank.ZHANG_SHI, cap: 1 },
  ] as { rank: MaidRank; cap: number }[],
};

/** 赏赐物品对应的忠心加成（可覆盖默认区间，道具 ID 对齐商店配置） */
export const REWARD_ITEM_BONUS: Record<string, number> = {
  tonic_common: 5,
  tonic_fine: 9,
  plain_silk: 6,
  brocade: 10,
  pearl_jewelry: 12,
};

const TPL_MAP: Record<string, ServantTemplate> = {};
SERVANT_TEMPLATES.forEach((t) => { TPL_MAP[t.id] = t; });
export function getServantTemplate(id: string): ServantTemplate | undefined {
  return TPL_MAP[id];
}

/** 侍从事件联动效果（按场景 × 协助/反噬，全部配置化） */
export const SERVANT_ASSIST_EFFECTS: Record<string, { assist: Record<string, number>; backfire: Record<string, number> }> = {
  intrigue: { assist: { prestige: 8, wit: 3 }, backfire: { prestige: -6, favor: -4 } },
  spy:      { assist: { wit: 2, social: 2 },  backfire: { social: -3 } },
  duty:     { assist: { ability: 2 },        backfire: { prestige: -5 } },
  summon:   { assist: { favor: 4, prestige: 2 }, backfire: { favor: -3 } },
};

/** 尽责回升忠心 / 背离概率（配置化） */
export const SERVANT_LOYALTY_RULES = {
  dutyLoyaltyGain: 2,
  desertChance: 0.4,
} as const;
