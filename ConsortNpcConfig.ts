/**
 * 嫔妃 NPC 池配置表 —— 妃嫔线博弈核心（固定 NPC，8 名）
 * 字段：ID / 姓名 / 位分 / 性格 / 派系 / 初始好感 / 当前状态 / 所持把柄 / 背景设定。
 * ⚠️ 全部数值与文案集中于此，业务系统不得硬编码。
 */
import {
  ConsortFaction,
  ConsortNpcConfig,
  ConsortNpcStatus,
  ConsortRank,
} from '../types/types';

export const CONSORT_NPC_CONFIGS: ConsortNpcConfig[] = [
  {
    id: 'cnp_empress',
    name: '皇后·慕容婉',
    rank: ConsortRank.HUANG_HOU,
    personality: '端肃持重、城府深沉',
    faction: ConsortFaction.EMPRESS,
    initialAffection: 40,
    initialStatus: ConsortNpcStatus.FAVORED,
    leverage: '母族曾私自挪用宫中采买银两',
    backstory: '名门嫡女，十六岁入主中宫，行事恪守礼法，是后宫名义上的主宰。表面端方，暗中笼络低位嫔妃巩固后位。',
  },
  {
    id: 'cnp_guifei',
    name: '贵妃·萧云艳',
    rank: ConsortRank.GUI_FEI,
    personality: '骄矜泼辣、恃宠而骄',
    faction: ConsortFaction.GUI_FEI,
    initialAffection: 28,
    initialStatus: ConsortNpcStatus.FAVORED,
    leverage: '曾暗中克扣低阶宫人份例，宫中多有怨言',
    backstory: '舞姬出身，以艳色博宠，盛时风头无两。性子急躁，最恨有人分宠，常借端寻衅。',
  },
  {
    id: 'cnp_fei',
    name: '宠妃·沈含嫣',
    rank: ConsortRank.FEI,
    personality: '柔婉善妒、外柔内狠',
    faction: ConsortFaction.IMPERIAL,
    initialAffection: 35,
    initialStatus: ConsortNpcStatus.FAVORED,
    leverage: '曾假称染疾以避侍寝，事为贴身宫女所知',
    backstory: '出身书香，善诗词音律，最得帝心。表面与世无争，实则工于心计，是主角晋升高位的最大阻碍之一。',
  },
  {
    id: 'cnp_pin',
    name: '庶妃·董良人',
    rank: ConsortRank.PIN,
    personality: '沉默寡言、明哲保身',
    faction: ConsortFaction.NEUTRAL,
    initialAffection: 55,
    initialStatus: ConsortNpcStatus.DISFAVORED,
    leverage: '其兄在外间与人有钱财往来',
    backstory: '家世不显，入宫多年仍居嫔位。凡事不掺和，只想平安终老，是少数可交好的中立之人。',
  },
  {
    id: 'cnp_zai',
    name: '低位嫔妃·安常在',
    rank: ConsortRank.CHANG_ZAI,
    personality: '胆小怕事、心思单纯',
    faction: ConsortFaction.NEUTRAL,
    initialAffection: 62,
    initialStatus: ConsortNpcStatus.DISFAVORED,
    leverage: '曾私藏宫中库银小物，怕被人揭发',
    backstory: '选秀入宫时年纪最小，至今位分未进。胆子极小，谁对她稍示好便感恩戴德，易被拉拢。',
  },
  {
    id: 'cnp_ying',
    name: '丽妃·赵飞燕',
    rank: ConsortRank.FEI,
    personality: '张扬妩媚、争强好胜',
    faction: ConsortFaction.GUI_FEI,
    initialAffection: 22,
    initialStatus: ConsortNpcStatus.FAVORED,
    leverage: '私藏逾制的珠翠首饰，按宫规当罚',
    backstory: '与萧贵妃同入宫，表面姐妹相称，暗中互较妆饰恩宠。最喜在宴会上争风头。',
  },
  {
    id: 'cnp_de',
    name: '德妃·贤妃柳氏',
    rank: ConsortRank.FEI,
    personality: '温良恭俭、与世无争',
    faction: ConsortFaction.EMPRESS,
    initialAffection: 60,
    initialStatus: ConsortNpcStatus.DISFAVORED,
    leverage: '母族曾与朝中某臣来往密切',
    backstory: '以贤德著称，侍奉太后恭谨，皇后再三拉拢。虽不争宠，却深得宫中人心。',
  },
  {
    id: 'cnp_ning',
    name: '宁嫔·冷如月',
    rank: ConsortRank.PIN,
    personality: '清冷孤傲、不屑逢迎',
    faction: ConsortFaction.NEUTRAL,
    initialAffection: 48,
    initialStatus: ConsortNpcStatus.CONFINED,
    leverage: '曾当众顶撞高位嫔妃，留有把柄在他人手中',
    backstory: '性情刚烈，因言语冲撞被禁足半月。虽有才情却不肯低头，是后宫中最难捉摸的一人。',
  },
];

const MAP: Record<string, ConsortNpcConfig> = {};
CONSORT_NPC_CONFIGS.forEach((c) => { MAP[c.id] = c; });

/** 按 ID 取嫔妃配置 */
export function getConsortNpcConfig(id: string): ConsortNpcConfig | undefined {
  return MAP[id];
}

/** 取全部嫔妃配置（复制数组，避免外部误改） */
export function listConsortNpcConfigs(): ConsortNpcConfig[] {
  return [...CONSORT_NPC_CONFIGS];
}
