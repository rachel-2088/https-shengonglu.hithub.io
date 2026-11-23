/**
 * 《深宫录》本地存档系统 saveData.ts
 * ------------------------------------------------------------------
 * 适用：Cocos Creator 3.x / 微信小游戏 / 纯单机
 * 职责：
 *   1. 封装本地存储（Cocos sys.localStorage，微信小游戏底层自动桥接 wx.setStorageSync）
 *   2. 新建 / 保存 / 读取 / 删除 / 重置存档
 *   3. 版本迁移（旧档缺字段自动补全，防止升级后读档崩溃）
 *   4. 局部更新辅助：朝臣好感、婚恋状态、恩爱值、银两、事件日志
 * 说明：所有数值来自 config/ 配置表；本文件只做"持久化"，不写游戏规则。
 * CHANGELOG:
 *   v1.0.0  初始版本，含婚姻 / 朝臣 / 恩爱值全量持久化
 */

import { sys } from 'cc';
import {
  AdStats,
  AffectionStage,
  AttributeKey,
  BaseAttributes,
  ChildData,
  ChildGender,
  ChildHealth,
  ChildGrowthStage,
  ConsortEffect,
  ConsortNpcStatus,
  ConsortRank,
  ConsortRelation,
  ConsortRuntime,
  Debuff,
  DutyRuntime,
  InventoryItem,
  ServantData,
  ServantRole,
  ServantStatus,
  EmperorFavorStage,
  EmperorState,
  FamilyOrigin,
  GameDate,
  GameRoute,
  GameSaveData,
  HusbandInfo,
  MarriageState,
  MarriageStatus,
  MaidBranch,
  MaidRank,
  MinisterRuntime,
  OfficialRank,
  PregnancyState,
  SaveValidation,
  SixBureau,
  TimeState,
} from '../types/types';

// ==================================================================
// 一、存储常量与底层适配
// ==================================================================

/** 本地存档键名（勿随意更改，改了会导致老玩家存档丢失） */
export const SAVE_KEY = 'shen_gong_lu_save_v1';

/** 当前存档格式版本（结构变更时 +1，并补 migrate 逻辑） */
export const SAVE_VERSION = 1;

/** 事件日志最大保留条数（超出裁剪，避免存档无限膨胀） */
const MAX_EVENT_LOG = 200;

/**
 * 底层存储适配器。
 * 优先使用 Cocos 官方 sys.localStorage（跨端统一 API）；
 * 若运行环境异常则降级到微信小游戏全局 wx.setStorageSync / getStorageSync。
 * 注：Cocos 在微信小游戏平台已把 sys.localStorage 桥接到 wx 本地存储，
 *     具体行为以 Cocos Creator 3.x 官方文档为准。
 */
const StorageAdapter = {
  getItem(key: string): string | null {
    try {
      return sys.localStorage.getItem(key);
    } catch (_) {
      try {
        const wx = (globalThis as any).wx;
        if (wx && typeof wx.getStorageSync === 'function') {
          const v = wx.getStorageSync(key);
          return v === '' || v == null ? null : String(v);
        }
      } catch (_e) { /* ignore */ }
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      sys.localStorage.setItem(key, value);
    } catch (_) {
      try {
        const wx = (globalThis as any).wx;
        if (wx && typeof wx.setStorageSync === 'function') {
          wx.setStorageSync(key, value);
        }
      } catch (_e) { /* ignore */ }
    }
  },

  removeItem(key: string): void {
    try {
      sys.localStorage.removeItem(key);
    } catch (_) {
      try {
        const wx = (globalThis as any).wx;
        if (wx && typeof wx.removeStorageSync === 'function') {
          wx.removeStorageSync(key);
        }
      } catch (_e) { /* ignore */ }
    }
  },
};

/** 手动存档槽位数（固定 3 个） */
export const SAVE_SLOT_COUNT = 3;

/** 自动存档专用键（与手动槽位隔离，避免互相覆盖） */
export const AUTOSAVE_KEY = 'shen_gong_lu_autosave';

/** 手动存档槽位键（slot 从 1 开始） */
export function getSlotKey(slot: number): string {
  return `shen_gong_lu_slot_${slot}`;
}

/** 槽位号合法性 */
export function isValidSlot(slot: number): boolean {
  return Number.isInteger(slot) && slot >= 1 && slot <= SAVE_SLOT_COUNT;
}

/**
 * 存档数据完整性 + 路线一致性校验。
 * 不抛异常，返回结构化结果供 UI 提示；损坏档由调用方决定是否丢弃。
 */
export function validateSaveData(raw: any): SaveValidation {
  const messages: string[] = [];
  let routeConsistent = true;

  if (!raw || typeof raw !== 'object') {
    return { valid: false, messages: ['存档内容为空或格式错误'], routeConsistent: false };
  }
  // 必需顶层节点
  const required = ['version', 'time', 'character', 'inventory', 'servants', 'children', 'pregnancy', 'marriage'];
  for (const k of required) {
    if (raw[k] === undefined || raw[k] === null) messages.push(`缺少字段：${k}`);
  }
  // 关键子字段
  if (raw.character) {
    if (typeof raw.character.name !== 'string') messages.push('角色名异常');
    if (![GameRoute.CONSORT, GameRoute.MAID, GameRoute.OFFICIAL].includes(raw.character.route)) {
      messages.push('路线值非法');
      routeConsistent = false;
    }
    if (!raw.character.attributes || typeof raw.character.attributes !== 'object') messages.push('属性数据异常');
  }
  if (raw.time && (typeof raw.time.year !== 'number' || typeof raw.time.month !== 'number')) {
    messages.push('时间数据异常');
  }
  // 路线一致性：不同路线不应携带他路线专属的节点数据
  if (raw.character && raw.character.route === GameRoute.OFFICIAL) {
    if (raw.character.consortRank != null) { messages.push('女官档混入妃嫔阶位'); routeConsistent = false; }
    if (raw.character.maidRank != null) { messages.push('女官档混入宫女品级'); routeConsistent = false; }
  }
  if (raw.character && raw.character.route === GameRoute.MAID) {
    if (raw.character.consortRank != null) { messages.push('宫女档混入妃嫔阶位'); routeConsistent = false; }
    if (raw.character.officialRank != null) { messages.push('宫女档混入女官职级'); routeConsistent = false; }
  }
  if (raw.character && raw.character.route === GameRoute.CONSORT) {
    // 宫女转妃嫔后 maidRank 可能保留残留，属合法继承，不判为不一致
  }

  return { valid: messages.length === 0, messages, routeConsistent };
}

/** 底层原始字符串读取（供槽位系统使用） */
export function rawGet(key: string): string | null {
  return StorageAdapter.getItem(key);
}

/** 底层原始字符串写入（供槽位系统使用） */
export function rawSet(key: string, value: string): void {
  StorageAdapter.setItem(key, value);
}

/** 底层原始删除（供槽位系统使用） */
export function rawRemove(key: string): void {
  StorageAdapter.removeItem(key);
}

// ==================================================================
// 二、默认结构工厂
// ==================================================================

/** 创建一份空的基础属性（全 0） */
export function createEmptyAttributes(): BaseAttributes {
  return { appearance: 0, talent: 0, wit: 0, social: 0, constitution: 0 };
}

/** 创建默认时间状态 */
export function createDefaultTime(): TimeState {
  return { year: 1, month: 1, actionPoints: 5, actionPointMax: 5 };
}

/** 创建默认广告统计 */
export function createDefaultAdStats(): AdStats {
  return { watchCount: {}, totalWatched: 0, lastWatchedAt: 0 };
}

/** 创建默认婚恋状态（未婚、无夫君、恩爱值 0） */
export function createDefaultMarriage(): MarriageState {
  return {
    status: MarriageStatus.SINGLE,
    husband: null,
    loveValue: 0,
    lastVisitDate: null,
    triggeredMaritalEvents: [],
    troublesResolved: 0,
  };
}

/** 创建默认皇帝状态（帝宠数值复用 character.favor） */
export function createDefaultEmperor(): EmperorState {
  return {
    stage: EmperorFavorStage.STRANGER,
    lastInteractionDate: null,
    lastSummonMonth: null,
    angerCount: 0,
    unlockedStories: [],
  };
}

/** 创建一份"嫔妃运行时数据"模板 */
export function createConsortRuntime(id: string, initialAffection: number = 0, status: ConsortNpcStatus = ConsortNpcStatus.DISFAVORED): ConsortRuntime {
  return {
    id,
    affection: Math.max(0, Math.min(100, Math.round(initialAffection))),
    status,
    relation: null,
    leverageKnown: false,
    interactionCount: {},
  };
}

/** 创建一份"朝臣运行时数据"模板（好感 0、未邂逅） */
export function createMinisterRuntime(id: string, initialAffection: number = 0): MinisterRuntime {
  const aff = Math.max(0, Math.min(100, Math.round(initialAffection)));
  return {
    id,
    affection: aff,
    stage: resolveAffectionStage(aff),
    met: false,
    interactionCount: {},
    proposalTriggered: false,
    imperialMarriageTriggered: false,
  };
}

/** 创建一名侍从（完整字段；老数据缺字段由 normalizeServant 兜底） */
export function createServant(
  id: string,
  name: string,
  attrs: { loyalty: number; cleverness: number; ability: number; experience: number },
  opts: Partial<Pick<ServantData, 'role' | 'servingRank' | 'status' | 'allegiance' | 'backstory'>> = {},
): ServantData {
  return {
    id, name,
    loyalty: clamp100(attrs.loyalty),
    cleverness: clamp100(attrs.cleverness),
    ability: clamp100(attrs.ability),
    experience: clamp100(attrs.experience),
    role: opts.role ?? ServantRole.PALACE_MAID,
    servingRank: opts.servingRank ?? '',
    status: opts.status ?? ServantStatus.AVAILABLE,
    allegiance: opts.allegiance ?? '',
    backstory: opts.backstory ?? '',
  };
}

/** 归一化侍从数据（老档/旧测试数据缺扩展字段时补齐，不覆盖已有值） */
export function normalizeServant(raw: Partial<ServantData>): ServantData {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '无名侍从',
    loyalty: clamp100(raw.loyalty ?? 50),
    cleverness: clamp100(raw.cleverness ?? 30),
    ability: clamp100(raw.ability ?? 30),
    experience: clamp100(raw.experience ?? 20),
    role: raw.role ?? ServantRole.PALACE_MAID,
    servingRank: raw.servingRank ?? '',
    status: raw.status ?? ServantStatus.AVAILABLE,
    allegiance: raw.allegiance ?? '',
    backstory: raw.backstory ?? '',
    lastTrainDate: raw.lastTrainDate,
    lastSpyDate: raw.lastSpyDate,
  };
}

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** 创建默认怀孕状态（未孕） */
export function createDefaultPregnancy(): PregnancyState {
  return {
    active: false,
    startDate: null,
    monthsElapsed: 0,
    durationMonths: 0,
    fetalHealth: 0,
    eventHistory: [],
  };
}

/** 创建默认差事状态（空差事池） */
export function createDefaultDutyState(): DutyRuntime {
  return {
    availableIds: [],
    activeId: null,
    completedIds: [],
    lastRefreshDate: null,
  };
}

/** 归一化子嗣数据（老档/旧数据缺扩展字段时补齐，不覆盖已有值） */
export function normalizeChild(raw: Partial<ChildData>): ChildData {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '无名',
    gender: raw.gender ?? ChildGender.MALE,
    talent: clamp100(raw.talent ?? 50),
    physique: clamp100(raw.physique ?? 50),
    mind: clamp100(raw.mind ?? 50),
    appearance: raw.appearance ?? 50,
    birthDate: raw.birthDate ?? { year: 1, month: 1 },
    age: raw.age ?? 0,
    health: raw.health ?? ChildHealth.HEALTHY,
    motherId: raw.motherId ?? 'self',
    educationCost: raw.educationCost ?? 0,
    growthStage: raw.growthStage ?? ChildGrowthStage.SWADDLE,
    educationFocus: raw.educationFocus ?? null,
    isAlive: raw.isAlive ?? true,
  };
}

/** 创建一名子嗣（完整字段） */
export function createChild(
  id: string,
  name: string,
  gender: ChildGender,
  attrs: { talent: number; physique: number; mind: number; appearance: number },
  birthDate: GameDate,
): ChildData {
  return normalizeChild({ id, name, gender, ...attrs, birthDate });
}

/**
 * 开局参数（由开局流程收集后传入，用于生成新存档）。
 * 开局属性重刷（广告点位 REROLL_ATTRS）也在此阶段完成。
 */
export interface NewGameOptions {
  name: string;
  /** 角色年龄（开局随机；缺省时工厂兜底 14） */
  age?: number;
  route: GameRoute;
  familyOrigin: FamilyOrigin;
  attributes: BaseAttributes;
  silver: number;
  bureau?: SixBureau | null;
}

/**
 * 新建一份完整存档。
 * 依据路线初始化对应阶位：妃嫔=秀女 / 宫女=粗使宫女 / 女官=女史。
 */
export function createNewSave(options: NewGameOptions): GameSaveData {
  const now = Date.now();
  const consortRank = options.route === GameRoute.CONSORT ? ConsortRank.XIU_NV : null;
  const officialRank = options.route === GameRoute.OFFICIAL ? OfficialRank.NV_SHI : null;

  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    time: createDefaultTime(),
    character: {
      name: options.name || '无名氏',
      age: options.age ?? 14,
      familyOrigin: options.familyOrigin,
      route: options.route,
      attributes: { ...options.attributes },
      silver: options.silver,
      favor: 0,
      prestige: 0,
      diligence: 0,
      merit: 0,
      reputation: 0,
      consortRank,
      maidRank: options.route === GameRoute.MAID ? MaidRank.CU_SHI : null,
      officialRank,
      bureau: options.bureau ?? null,
      officialTitle: '',
      maidBranch: MaidBranch.UNDECIDED,
      underHouseArrest: false,
      activeDebuffs: [],
    },
    inventory: [],
    npcAffinity: {},
    ministers: {},
    encounterCache: {},
    lastEncounterRefresh: null,
    storyQueue: [],
    consorts: {},
    emperor: createDefaultEmperor(),
    marriage: createDefaultMarriage(),
    servants: [],
    children: [],
    pregnancy: createDefaultPregnancy(),
    dutyState: createDefaultDutyState(),
    flags: { gameStarted: true },
    adStats: createDefaultAdStats(),
    eventLog: [],
  };
}

/**
 * 生成一份"空白兜底存档"，仅在读档失败且需要临时对象时使用。
 * 正常流程禁止用它覆盖玩家真实存档。
 */
export function createBlankSave(): GameSaveData {
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    time: createDefaultTime(),
    character: {
      name: '',
      age: 14,
      familyOrigin: FamilyOrigin.COMMONER,
      route: GameRoute.CONSORT,
      attributes: createEmptyAttributes(),
      silver: 0,
      favor: 0,
      prestige: 0,
      diligence: 0,
      merit: 0,
      reputation: 0,
      consortRank: null,
      maidRank: null,
      officialRank: null,
      bureau: null,
      officialTitle: '',
      maidBranch: MaidBranch.UNDECIDED,
      underHouseArrest: false,
      activeDebuffs: [],
    },
    inventory: [],
    npcAffinity: {},
    ministers: {},
    encounterCache: {},
    lastEncounterRefresh: null,
    storyQueue: [],
    consorts: {},
    emperor: createDefaultEmperor(),
    marriage: createDefaultMarriage(),
    servants: [],
    children: [],
    pregnancy: createDefaultPregnancy(),
    dutyState: createDefaultDutyState(),
    flags: {},
    adStats: createDefaultAdStats(),
    eventLog: [],
  };
}

// ==================================================================
// 三、存 / 读 / 删 / 版本迁移
// ==================================================================

/** 是否存在有效存档 */
export function hasSave(): boolean {
  const raw = StorageAdapter.getItem(SAVE_KEY);
  return !!raw && raw.length > 0;
}

/**
 * 保存存档。成功返回 true。
 * 保存前自动刷新 updatedAt，并裁剪事件日志。
 */
export function saveGame(data: GameSaveData): boolean {
  try {
    data.version = SAVE_VERSION;
    data.updatedAt = Date.now();
    if (data.eventLog.length > MAX_EVENT_LOG) {
      data.eventLog = data.eventLog.slice(data.eventLog.length - MAX_EVENT_LOG);
    }
    StorageAdapter.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('[saveData] 保存失败：', e);
    return false;
  }
}

/**
 * 读取存档。无存档或解析失败返回 null。
 * 读取后自动执行版本迁移，补齐老档缺失字段（尤其婚姻 / 朝臣 / 恩爱字段）。
 */
export function loadGame(): GameSaveData | null {
  const raw = StorageAdapter.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GameSaveData>;
    return migrateSave(parsed);
  } catch (e) {
    console.error('[saveData] 读档解析失败：', e);
    return null;
  }
}

/** 删除存档（用于"重新开始"） */
export function deleteSave(): void {
  StorageAdapter.removeItem(SAVE_KEY);
}

/**
 * 版本迁移：把任意旧档结构补全为当前完整 GameSaveData。
 * 逐个字段兜底，确保新增的婚恋 / 朝臣 / 恩爱字段在老档中也存在。
 */
export function migrateSave(raw: Partial<GameSaveData>): GameSaveData {
  const base = createBlankSave();
  const c = (raw.character || {}) as Partial<GameSaveData['character']>;

  return {
    version: SAVE_VERSION,
    createdAt: raw.createdAt ?? base.createdAt,
    updatedAt: raw.updatedAt ?? base.updatedAt,
    time: { ...base.time, ...(raw.time || {}) },
    character: {
      ...base.character,
      ...c,
      attributes: { ...base.character.attributes, ...(c.attributes || {}) },
      activeDebuffs: c.activeDebuffs ?? [],
    },
    inventory: Array.isArray(raw.inventory) ? raw.inventory : [],
    npcAffinity: raw.npcAffinity ?? {},
    // ★ 朝臣数据池兜底
    ministers: raw.ministers ?? {},
    // ★ 邂逅缓存兜底（老档缺字段时自动补空）
    encounterCache: raw.encounterCache ?? {},
    lastEncounterRefresh: raw.lastEncounterRefresh ?? null,
    // ★ 剧情队列兜底
    storyQueue: Array.isArray(raw.storyQueue) ? raw.storyQueue : [],
    // ★ 嫔妃博弈 / 帝宠状态兜底（老档缺字段自动补空）
    consorts: raw.consorts ?? {},
    emperor: { ...createDefaultEmperor(), ...(raw.emperor || {}) },
    // ★ 婚恋 / 夫君 / 恩爱数据兜底（老档缺这些字段时自动补默认未婚状态）
    marriage: { ...createDefaultMarriage(), ...(raw.marriage || {}) },
    servants: Array.isArray(raw.servants) ? raw.servants.map((sv) => normalizeServant(sv)) : [],
    children: Array.isArray(raw.children) ? raw.children.map((c) => normalizeChild(c)) : [],
    // ★ 怀孕状态兜底（老档缺字段自动补未孕）
    pregnancy: { ...createDefaultPregnancy(), ...(raw.pregnancy || {}) },
    // ★ 差事状态兜底
    dutyState: { ...createDefaultDutyState(), ...(raw.dutyState || {}) },
    flags: raw.flags ?? {},
    adStats: { ...createDefaultAdStats(), ...(raw.adStats || {}) },
    eventLog: Array.isArray(raw.eventLog) ? raw.eventLog.slice(-MAX_EVENT_LOG) : [],
  };
}

// ==================================================================
// 四、局部更新辅助（业务系统通过这些函数改存档，避免直接散改）
// ==================================================================

/** 根据好感数值推导好感阶段 */
export function resolveAffectionStage(affection: number): AffectionStage {
  if (affection <= 20) return AffectionStage.STRANGER;
  if (affection <= 40) return AffectionStage.ACQUAINT;
  if (affection <= 60) return AffectionStage.ADMIRE;
  if (affection <= 80) return AffectionStage.FOND;
  if (affection <= 95) return AffectionStage.DEEP;
  return AffectionStage.PROMISE;
}

/** 设置某朝臣好感（自动同步好感阶段），不存在则新建运行时数据 */
export function setMinisterAffection(save: GameSaveData, ministerId: string, affection: number): void {
  const clamped = Math.max(0, Math.min(100, Math.round(affection)));
  const rt = save.ministers[ministerId] ?? createMinisterRuntime(ministerId);
  rt.affection = clamped;
  rt.stage = resolveAffectionStage(clamped);
  save.ministers[ministerId] = rt;
}

/** 增减某朝臣好感 */
export function addMinisterAffection(save: GameSaveData, ministerId: string, delta: number): void {
  const cur = save.ministers[ministerId]?.affection ?? 0;
  setMinisterAffection(save, ministerId, cur + delta);
}

/** 记录一次与朝臣的互动 */
export function recordMinisterInteraction(save: GameSaveData, ministerId: string, interaction: string): void {
  const rt = save.ministers[ministerId] ?? createMinisterRuntime(ministerId);
  rt.met = true;
  rt.interactionCount[interaction] = (rt.interactionCount[interaction] ?? 0) + 1;
  save.ministers[ministerId] = rt;
}

/** 更新婚恋状态（局部补丁） */
export function updateMarriage(save: GameSaveData, patch: Partial<MarriageState>): void {
  save.marriage = { ...save.marriage, ...patch };
}

/** 设置夫君（赐婚完成时调用，同时切状态为已婚） */
export function setHusband(save: GameSaveData, husband: HusbandInfo): void {
  save.marriage.husband = { ...husband };
  save.marriage.status = MarriageStatus.MARRIED;
  // 已婚时恩爱值从 50 起步（可依配置表调整）
  if (save.marriage.loveValue <= 0) save.marriage.loveValue = 50;
}

/** 增减恩爱值（0~100 钳制） */
export function addLoveValue(save: GameSaveData, delta: number): void {
  save.marriage.loveValue = Math.max(0, Math.min(100, save.marriage.loveValue + delta));
}

/** 增减银两（下限 0） */
export function addSilver(save: GameSaveData, delta: number): void {
  save.character.silver = Math.max(0, save.character.silver + delta);
}

/** 增减某项属性 */
export function addAttribute(save: GameSaveData, key: AttributeKey, delta: number): void {
  const cur = save.character.attributes[key] ?? 0;
  save.character.attributes[key] = Math.max(0, Math.round(cur + delta));
}

// ==================================================================
// 五、妃嫔线局部更新助手（帝宠 / 嫔妃 / DEBUFF / 禁足）
// ==================================================================

/** 设置/同步帝宠值（0~100 钳制），返回钳制后的值 */
export function setFavor(save: GameSaveData, favor: number): number {
  const v = Math.max(0, Math.min(100, Math.round(favor)));
  save.character.favor = v;
  return v;
}

/** 增减帝宠 */
export function addFavor(save: GameSaveData, delta: number): number {
  return setFavor(save, save.character.favor + delta);
}

/** 增减威望（0 下限） */
export function addPrestige(save: GameSaveData, delta: number): number {
  save.character.prestige = Math.max(0, Math.round(save.character.prestige + delta));
  return save.character.prestige;
}

/** 设置某嫔妃好感（不存在则新建运行时数据） */
export function setConsortAffection(save: GameSaveData, npcId: string, affection: number): void {
  const v = Math.max(0, Math.min(100, Math.round(affection)));
  const rt = save.consorts[npcId] ?? createConsortRuntime(npcId);
  rt.affection = v;
  save.consorts[npcId] = rt;
}

/** 增减某嫔妃好感 */
export function addConsortAffection(save: GameSaveData, npcId: string, delta: number): void {
  setConsortAffection(save, npcId, (save.consorts[npcId]?.affection ?? 0) + delta);
}

/** 更新嫔妃运行时数据（局部补丁） */
export function updateConsort(save: GameSaveData, npcId: string, patch: Partial<ConsortRuntime>): void {
  const rt = save.consorts[npcId] ?? createConsortRuntime(npcId);
  save.consorts[npcId] = { ...rt, ...patch, id: npcId };
}

/** 更新皇帝状态（局部补丁） */
export function updateEmperor(save: GameSaveData, patch: Partial<EmperorState>): void {
  save.emperor = { ...save.emperor, ...patch };
}

/** 添加一个负面 DEBUFF（去重：同 id 不重复挂） */
export function addDebuff(save: GameSaveData, debuff: Debuff): void {
  if (!save.character.activeDebuffs.some((d) => d.id === debuff.id)) {
    save.character.activeDebuffs.push({ ...debuff });
  }
}

/** 移除一个负面 DEBUFF（按 id） */
export function removeDebuff(save: GameSaveData, debuffId: string): void {
  save.character.activeDebuffs = save.character.activeDebuffs.filter((d) => d.id !== debuffId);
}

/** 设置/解除禁足 */
export function setHouseArrest(save: GameSaveData, confined: boolean): void {
  save.character.underHouseArrest = confined;
}

/** 统一应用一段效果包（宫斗/皇帝互动共用；debuff 去重，属性下限 0） */
export function applyConsortEffect(save: GameSaveData, effect: ConsortEffect | undefined): void {
  if (!effect) return;
  if (effect.attributes) {
    for (const [key, delta] of Object.entries(effect.attributes)) {
      if (typeof delta === 'number') addAttribute(save, key as AttributeKey, delta);
    }
  }
  if (typeof effect.favor === 'number') addFavor(save, effect.favor);
  if (typeof effect.prestige === 'number') addPrestige(save, effect.prestige);
  if (typeof effect.silver === 'number') addSilver(save, effect.silver);
  if (effect.debuff) addDebuff(save, {
    id: effect.debuff.id,
    name: effect.debuff.name,
    desc: effect.debuff.desc,
    remainMonths: effect.debuff.remainMonths,
  });
  if (effect.clearHouseArrest) setHouseArrest(save, false);
}

// ==================================================================
// 六、侍从局部更新助手
// ==================================================================

/** 更新某侍从（局部补丁，不存在则忽略），返回更新后的数据 */
export function updateServant(save: GameSaveData, servantId: string, patch: Partial<ServantData>): ServantData | null {
  const idx = save.servants.findIndex((sv) => sv.id === servantId);
  if (idx < 0) return null;
  const merged = normalizeServant({ ...save.servants[idx], ...patch, id: servantId });
  save.servants[idx] = merged;
  return merged;
}

/** 增减侍从某项四维（0~100 钳制） */
export function addServantAttr(save: GameSaveData, servantId: string, key: 'loyalty' | 'cleverness' | 'ability' | 'experience', delta: number): number {
  const sv = save.servants.find((x) => x.id === servantId);
  if (!sv) return 0;
  const cur = sv[key] ?? 0;
  const val = clamp100(cur + delta);
  updateServant(save, servantId, { [key]: val } as Partial<ServantData>);
  return val;
}

/** 按忠心阈值同步侍从状态（低于阈值自动进入背叛风险） */
export function syncServantStatus(save: GameSaveData, servantId: string, betrayalThreshold: number): ServantStatus {
  const sv = save.servants.find((x) => x.id === servantId);
  if (!sv) return ServantStatus.AVAILABLE;
  const status: ServantStatus = sv.loyalty < betrayalThreshold
    ? ServantStatus.BETRAYAL_RISK
    : (sv.status === ServantStatus.BETRAYAL_RISK ? ServantStatus.AVAILABLE : (sv.status ?? ServantStatus.AVAILABLE));
  updateServant(save, servantId, { status });
  return status;
}

// ==================================================================
// 七、子嗣 / 怀孕局部更新助手
// ==================================================================

/** 更新某子嗣（局部补丁，不存在则忽略） */
export function updateChild(save: GameSaveData, childId: string, patch: Partial<ChildData>): ChildData | null {
  const idx = save.children.findIndex((c) => c.id === childId);
  if (idx < 0) return null;
  const merged = normalizeChild({ ...save.children[idx], ...patch, id: childId });
  save.children[idx] = merged;
  return merged;
}

/** 增减子嗣某项四维（0~100 钳制） */
export function addChildAttr(save: GameSaveData, childId: string, key: 'talent' | 'physique' | 'mind' | 'appearance', delta: number): number {
  const c = save.children.find((x) => x.id === childId);
  if (!c) return 0;
  const val = clamp100((c[key] ?? 0) + delta);
  updateChild(save, childId, { [key]: val } as Partial<ChildData>);
  return val;
}

/** 更新怀孕状态（局部补丁） */
export function updatePregnancy(save: GameSaveData, patch: Partial<PregnancyState>): PregnancyState {
  save.pregnancy = { ...save.pregnancy, ...patch };
  return save.pregnancy;
}

/** 结束怀孕（分娩/滑胎后调用，重置为未孕） */
export function clearPregnancy(save: GameSaveData): void {
  save.pregnancy = createDefaultPregnancy();
}

// ==================================================================
// 八、背包道具局部更新助手
// ==================================================================

/** 查询某道具数量 */
export function getItemCount(save: GameSaveData, itemId: string): number {
  return save.inventory.find((i) => i.itemId === itemId)?.count ?? 0;
}

/** 增加道具（不存在则新建条目），返回增加后的数量 */
export function addItem(save: GameSaveData, itemId: string, count: number = 1): number {
  if (count <= 0) return getItemCount(save, itemId);
  const existing = save.inventory.find((i) => i.itemId === itemId);
  if (existing) {
    existing.count += count;
    return existing.count;
  }
  save.inventory.push({ itemId, count } as InventoryItem);
  return count;
}

/** 移除道具（数量不足返回 false，不产生负数条目） */
export function removeItem(save: GameSaveData, itemId: string, count: number = 1): boolean {
  const idx = save.inventory.findIndex((i) => i.itemId === itemId);
  if (idx < 0 || count <= 0) return false;
  const entry = save.inventory[idx];
  if (entry.count < count) return false;
  entry.count -= count;
  if (entry.count <= 0) save.inventory.splice(idx, 1);
  return true;
}

/** 背包当前占用格数（不同道具 ID 计一格） */
export function getInventorySlots(save: GameSaveData): number {
  return save.inventory.length;
}
