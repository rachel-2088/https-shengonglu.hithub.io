/**
 * 家世出身配置表 —— 数值来自《深宫录》全局数值配置表 第二节"家世出身"。
 * 五档家世决定：五大属性随机区间 + 初始银两，全部读表，业务层不得硬编码。
 * ⚠️ 属性列序（与原始数值表一致）：容貌 | 才情 | 心智 | 人脉 | 体质 | 初始银两。
 *
 * CHANGELOG:
 *   v1.0.0  初始五档家世配置（数值逐格照抄用户数值表）
 */
import { AttributeKey, FamilyConfig, FamilyOrigin } from '../types/types';

/** 五档家世（区间闭区间 [min, max]） */
export const FAMILY_CONFIGS: FamilyConfig[] = [
  {
    id: FamilyOrigin.COMMONER,
    name: '布衣寒门',
    attrRanges: {
      [AttributeKey.APPEARANCE]: { min: 10, max: 30 },
      [AttributeKey.TALENT]: { min: 10, max: 30 },
      [AttributeKey.WIT]: { min: 20, max: 40 },
      [AttributeKey.SOCIAL]: { min: 0, max: 15 },
      [AttributeKey.CONSTITUTION]: { min: 25, max: 45 },
    },
    initialSilver: 30,
  },
  {
    id: FamilyOrigin.LOW_OFFICIAL,
    name: '小吏之家',
    attrRanges: {
      [AttributeKey.APPEARANCE]: { min: 20, max: 40 },
      [AttributeKey.TALENT]: { min: 20, max: 40 },
      [AttributeKey.WIT]: { min: 25, max: 45 },
      [AttributeKey.SOCIAL]: { min: 15, max: 30 },
      [AttributeKey.CONSTITUTION]: { min: 25, max: 45 },
    },
    initialSilver: 60,
  },
  {
    id: FamilyOrigin.SCHOLAR,
    name: '书香门第',
    attrRanges: {
      [AttributeKey.APPEARANCE]: { min: 25, max: 45 },
      [AttributeKey.TALENT]: { min: 35, max: 60 },
      [AttributeKey.WIT]: { min: 30, max: 50 },
      [AttributeKey.SOCIAL]: { min: 20, max: 35 },
      [AttributeKey.CONSTITUTION]: { min: 20, max: 40 },
    },
    initialSilver: 80,
  },
  {
    id: FamilyOrigin.OFFICIAL,
    name: '官宦世家',
    attrRanges: {
      [AttributeKey.APPEARANCE]: { min: 35, max: 55 },
      [AttributeKey.TALENT]: { min: 30, max: 50 },
      [AttributeKey.WIT]: { min: 35, max: 55 },
      [AttributeKey.SOCIAL]: { min: 35, max: 60 },
      [AttributeKey.CONSTITUTION]: { min: 25, max: 45 },
    },
    initialSilver: 120,
  },
  {
    id: FamilyOrigin.NOBLE,
    name: '世家望族',
    attrRanges: {
      [AttributeKey.APPEARANCE]: { min: 45, max: 65 },
      [AttributeKey.TALENT]: { min: 40, max: 60 },
      [AttributeKey.WIT]: { min: 40, max: 60 },
      [AttributeKey.SOCIAL]: { min: 50, max: 75 },
      [AttributeKey.CONSTITUTION]: { min: 30, max: 50 },
    },
    initialSilver: 180,
  },
];

const FAMILY_MAP: Record<string, FamilyConfig> = {};
FAMILY_CONFIGS.forEach((c) => { FAMILY_MAP[c.id] = c; });

/** 按 ID 取家世配置 */
export function getFamilyConfig(id: FamilyOrigin): FamilyConfig | undefined {
  return FAMILY_MAP[id];
}

/** 家世抽取权重（合计 100）。用户未指定概率，此处为设计假设，配置化便于平衡调整。 */
export const FAMILY_WEIGHTS: Record<FamilyOrigin, number> = {
  [FamilyOrigin.COMMONER]: 42,
  [FamilyOrigin.LOW_OFFICIAL]: 28,
  [FamilyOrigin.SCHOLAR]: 17,
  [FamilyOrigin.OFFICIAL]: 9,
  [FamilyOrigin.NOBLE]: 4,
};

/** 五大属性枚举顺序（随机生成时按此顺序逐项取值，保证稳定） */
export const FAMILY_ATTR_ORDER: AttributeKey[] = [
  AttributeKey.APPEARANCE,
  AttributeKey.TALENT,
  AttributeKey.WIT,
  AttributeKey.SOCIAL,
  AttributeKey.CONSTITUTION,
];
