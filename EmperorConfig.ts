/**
 * 皇帝互动 / 帝宠配置表 —— 妃嫔线核心
 * 数值来源：《深宫录》全局数值配置表 第一/三/八节，帝宠阶段与互动分支为原创设定。
 * ⚠️ 剧情文案含蓄处理（"侍寝"以夜侍/承宠表述，不涉露骨描写），以微信官方最新规范为准。
 * ⚠️ 所有数值集中于此，业务系统不得硬编码。
 */
import {
  EmperorChoice,
  EmperorFavorStage,
  EmperorFavorStageConfig,
  EmperorInteraction,
  EmperorInteractionConfig,
  FavorEffectConfig,
} from '../types/types';

/** 帝宠阶段阈值（下限，闭区间；命中最高满足条件者） */
export const EMPEROR_FAVOR_STAGES: EmperorFavorStageConfig[] = [
  { min: 91, stage: EmperorFavorStage.EXCLUSIVE, label: '独宠' },
  { min: 71, stage: EmperorFavorStage.GLORY, label: '盛宠' },
  { min: 51, stage: EmperorFavorStage.PREFERRED, label: '偏爱' },
  { min: 31, stage: EmperorFavorStage.FAVORED, label: '青睐' },
  { min: 11, stage: EmperorFavorStage.PLAIN, label: '平淡' },
  { min: 0, stage: EmperorFavorStage.STRANGER, label: '陌生' },
];

/** 帝宠阶段 → 序号（0=陌生 … 5=独宠），用于互动解锁门槛比较 */
export const EMPEROR_STAGE_ORDER: EmperorFavorStage[] = [
  EmperorFavorStage.STRANGER,
  EmperorFavorStage.PLAIN,
  EmperorFavorStage.FAVORED,
  EmperorFavorStage.PREFERRED,
  EmperorFavorStage.GLORY,
  EmperorFavorStage.EXCLUSIVE,
];

/** 六种皇帝互动及其分支（侍寝文案含蓄） */
export const EMPEROR_INTERACTIONS: EmperorInteractionConfig[] = [
  {
    type: EmperorInteraction.SUMMON,
    name: '随机召见',
    desc: '养心殿传旨，召你即刻觐见。',
    minStageIndex: 1,
    choices: [
      { id: 'summon_humble', label: '恭谨应对，不卑不亢', effects: { favor: 4, prestige: 2 } },
      { id: 'summon_talent', label: '借机展露才情', effects: { favor: 6, prestige: 3, attributes: { talent: 2 } } },
      { id: 'summon_cautious', label: '慎言守礼，不多一言', effects: { favor: 1, attributes: { wit: 2 } } },
    ],
  },
  {
    type: EmperorInteraction.NIGHT_ATTENDANCE,
    name: '夜侍承宠',
    desc: '入夜传召，烛影摇红，一夜承恩。',
    minStageIndex: 3,
    choices: [
      { id: 'night_grace', label: '温柔承恩，曲意逢迎', effects: { favor: 9, attributes: { appearance: 2 } } },
      { id: 'night_recline', label: '以身子不适婉辞', effects: { favor: -3, prestige: 2, attributes: { constitution: 2 } } },
      { id: 'night_talk', label: '侍坐闲谈，倾诉心事', effects: { favor: 7, attributes: { wit: 2 } } },
    ],
  },
  {
    type: EmperorInteraction.GARDEN_STROLL,
    name: '御园同游',
    desc: '春色正好，帝携你同游御花园。',
    minStageIndex: 2,
    choices: [
      { id: 'stroll_poem', label: '即景赋诗，助兴帝怀', effects: { favor: 5, attributes: { talent: 2 } } },
      { id: 'stroll_care', label: '细心照拂，体贴入微', effects: { favor: 4, attributes: { social: 2 } } },
      { id: 'stroll_fumble', label: '一时失仪，差些跌倒', effects: { favor: -4, prestige: -3 } },
    ],
  },
  {
    type: EmperorInteraction.MIDNIGHT_TALK,
    name: '深夜谈心',
    desc: '夜深人静，帝留你独坐，问你心中所想。',
    minStageIndex: 2,
    choices: [
      { id: 'talk_heart', label: '倾诉肺腑，以心相待', effects: { favor: 7, attributes: { wit: 2 } } },
      { id: 'talk_advice', label: '婉进良言，针砭时弊', effects: { favor: 3, prestige: 4 } },
      { id: 'talk_reckless', label: '妄议朝局，口无遮拦', effects: { favor: -8, prestige: -5 } },
    ],
  },
  {
    type: EmperorInteraction.OFFER_GIFT,
    name: '献礼',
    desc: '亲手备下礼物，寻机献于御前。',
    minStageIndex: 0,
    choices: [
      { id: 'gift_needle', label: '献上亲手缝制的帕子', effects: { favor: 5, attributes: { talent: 1 } } },
      { id: 'gift_rare', label: '献上稀世珍玩', effects: { favor: 6, prestige: 2 } },
      { id: 'gift_shabby', label: '礼物粗陋，难入法眼', effects: { favor: -3 } },
    ],
  },
  {
    type: EmperorInteraction.BANQUET_PERFORMANCE,
    name: '宴会表现',
    desc: '宫宴之上，众目睽睽，正是表现之时。',
    minStageIndex: 1,
    choices: [
      { id: 'banquet_shine', label: '一曲惊四座', effects: { favor: 8, prestige: 5, attributes: { appearance: 2 } } },
      { id: 'banquet_steady', label: '中规中矩，不失礼数', effects: { favor: 2, prestige: 1 } },
      { id: 'banquet_lose', label: '失言失态，惹人侧目', effects: { favor: -6, prestige: -5 } },
    ],
  },
];

const INTERACTION_MAP: Record<string, EmperorInteractionConfig> = {};
EMPEROR_INTERACTIONS.forEach((i) => { INTERACTION_MAP[i.type] = i; });
export function getEmperorInteractionConfig(type: EmperorInteraction): EmperorInteractionConfig | undefined {
  return INTERACTION_MAP[type];
}

/** 帝宠关联参数（偶遇 / 晋升 / 生育 / 嫔妃态度 / 专属剧情 / 惹怒惩罚） */
export const FAVOR_EFFECTS: FavorEffectConfig = {
  encounterBase: 0.15,
  encounterPerPoint: 0.005,          // 满宠 100 → +0.5，偶遇概率最高约 0.65
  prestigeThresholdReliefPerPoint: 0.5, // 满宠 100 → 威望晋升门槛降低 50
  prestigeFloorRatio: 0.3,           // V4修复：减免后至少保留原门槛的30%，防低位阶(答应15/常在35)归零
  pregnancyBase: 0.08,               // V4修复：怀孕基础概率 8%（原12%过高）
  pregnancyPerPoint: 1 / 300,        // 帝宠系数（帝宠/300）
  pregnancyConstitutionPerPoint: 1 / 250, // V4修复：体质系数 1/250（原1/100是帝宠3倍权重，导致大面积溢出100%）
  jealousyThreshold: 70,            // 帝宠过高，低位嫔妃转为嫉妒
  exclusiveStoryThreshold: 85,      // 盛宠以上解锁专属剧情
  anger: {
    favorLoss: 12,
    demoteChance: 0.35,
    confinementMonths: 3,
    prestigeLoss: 20,
  },
};

/** 高帝宠专属剧情入口（门槛配置，文案由剧情系统消费） */
export const EMPEROR_EXCLUSIVE_STORIES = [
  { id: 'story_exclusive_glory', name: '独赐宫灯', minFavor: 85, desc: '上元夜，帝独留你在宫中赏灯。' },
  { id: 'story_exclusive_exclusive', name: '许诺来生', minFavor: 95, desc: '帝于无人处，许你一句来生之约。' },
];

/** 宫女偶遇皇帝的轻幸 / 进封参数（宫女线仅保留此入口） */
export const MAID_IMPERIAL_ENCOUNTER = {
  /** 基础宠幸概率（低阶宫女） */
  baseFavorChance: 0.12,
  /** 每点容貌加成 */
  appearancePerPoint: 0.004,
  /** 进封为常在的容貌门槛 */
  promotionAppearance: 55,
  /** 轻幸提升的帝好感 */
  lightFavorGain: 8,
};
