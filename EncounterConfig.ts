/**
 * 朝臣邂逅点位配置表 —— 女官线四大点位
 * 宫门/宫道、翰林院、演武场、宫宴。所有解锁与品级规则集中于此。
 */
import {
  EncounterSpot,
  EncounterSpotConfig,
  MinisterType,
  OfficialGrade,
} from '../types/types';

/** 四点位配置（allowedType=null 表示文武皆可） */
export const ENCOUNTER_SPOT_CONFIGS: EncounterSpotConfig[] = [
  {
    id: EncounterSpot.GATE,
    name: '宫门/宫道',
    desc: '朝臣高频出入之处，文武百官皆有，以中低阶为主',
    allowedType: null,
    favoredMinGrade: OfficialGrade.PIN_6, // 偏好六品及以下
  },
  {
    id: EncounterSpot.HAN_LIN,
    name: '翰林院',
    desc: '文官专属，清流雅士云集',
    allowedType: MinisterType.CIVIL,
    favoredMinGrade: OfficialGrade.PIN_5,
  },
  {
    id: EncounterSpot.YAN_WU_CHANG,
    name: '演武场',
    desc: '武官专属，将校校武之所',
    allowedType: MinisterType.MILITARY,
    favoredMinGrade: OfficialGrade.PIN_5,
  },
  {
    id: EncounterSpot.BANQUET,
    name: '宫宴',
    desc: '宫廷盛宴，高阶朝臣赴宴，遇贵人也遇权臣',
    allowedType: null,
    favoredMinGrade: OfficialGrade.PIN_4, // 偏好四品及以上（数字更小）
  },
];

const SPOT_MAP: Record<string, EncounterSpotConfig> = {};
ENCOUNTER_SPOT_CONFIGS.forEach((c) => { SPOT_MAP[c.id] = c; });

export function getEncounterSpotConfig(id: EncounterSpot): EncounterSpotConfig | undefined {
  return SPOT_MAP[id];
}

/** 品级抽取权重：中低阶更易邂逅，高阶稀有（配置化） */
export const GRADE_ENCOUNTER_WEIGHT: Record<OfficialGrade, number> = {
  [OfficialGrade.PIN_9]: 10,
  [OfficialGrade.PIN_8]: 10,
  [OfficialGrade.PIN_7]: 9,
  [OfficialGrade.PIN_6]: 8,
  [OfficialGrade.PIN_5]: 7,
  [OfficialGrade.PIN_4]: 5,
  [OfficialGrade.PIN_3]: 4,
  [OfficialGrade.PIN_2]: 2,
  [OfficialGrade.PIN_1]: 1,
};

/** 宫宴点位对高阶朝臣的权重翻倍系数（体现"遇贵人"） */
export const BANQUET_HIGH_GRADE_BOOST = 3;
