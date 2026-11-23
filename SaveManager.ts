/**
 * 存档读档管理系统 —— 本轮重点
 * 覆盖：自动存档（每月结束/事件分支/身份转换/结婚/生子等关键节点）/
 *       3 个独立手动存档槽（存档·读档·删除）/ 存档数据全范围持久化 /
 *       读档完整性校验 + 路线隔离校验 / 损坏档容错不崩溃 / 序列化反序列化。
 * ⚠️ 微信小游戏本地存储：底层复用 saveData 的 StorageAdapter（Cocos sys.localStorage → wx.setStorageSync）。
 * 所有数值读 config（槽位数/自动存档等常量在 saveData 导出），业务层零硬编码。
 */
import {
  GameRoute,
  GameSaveData,
  SaveSlotMeta,
  SaveValidation,
} from '../types/types';
import {
  AUTOSAVE_KEY,
  SAVE_KEY,
  SAVE_SLOT_COUNT,
  SAVE_VERSION,
  getSlotKey,
  isValidSlot,
  migrateSave,
  rawGet,
  rawRemove,
  rawSet,
  saveGame,
  validateSaveData,
} from '../data/saveData';
import { gameEvents, GameEvent } from '../core/EventBus';

/** 自动存档触发原因（枚举，供日志与 UI 展示） */
export enum AutoSaveReason {
  MONTH_END = 'monthEnd',       // 每月结束
  STORY_CHOICE = 'storyChoice', // 事件分支选择完成
  IDENTITY_CHANGE = 'identityChange', // 身份转换
  MARRIAGE = 'marriage',        // 结婚
  CHILD_BIRTH = 'childBirth',   // 生子
  PROMOTION = 'promotion',      // 晋升
  MANUAL = 'manual',            // 手动触发
}

export interface SaveResult {
  ok: boolean;
  reason?: string;
  /** 保存位置说明 */
  target?: string;
}

export interface LoadResult {
  ok: boolean;
  reason?: string;
  data: GameSaveData | null;
  /** 校验信息（Warnings） */
  validation?: SaveValidation;
}

/** 存档序列化/反序列化工具（可单独测试） */
export const SaveCodec = {
  serialize(data: GameSaveData): string {
    return JSON.stringify(data);
  },
  deserialize(raw: string): { ok: boolean; data: GameSaveData | null; validation?: SaveValidation } {
    if (!raw) return { ok: false, data: null };
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      return { ok: false, data: null, validation: { valid: false, messages: ['存档 JSON 解析失败，文件可能损坏'], routeConsistent: false } };
    }
    const validation = validateSaveData(parsed);
    if (!validation.valid) {
      return { ok: false, data: null, validation };
    }
    // 校验通过后再迁移补全（老档缺字段兜底）
    try {
      return { ok: true, data: migrateSave(parsed), validation };
    } catch (e) {
      return { ok: false, data: null, validation: { valid: false, messages: ['存档迁移失败'], routeConsistent: false } };
    }
  },
};

export class SaveManager {
  /** 当前持有的存档引用（存档时序列化它） */
  constructor(private current: GameSaveData | null = null) {}

  /** 更新当前持有的存档引用 */
  setCurrent(data: GameSaveData): void {
    this.current = data;
  }

  /** 当前存档引用 */
  getCurrent(): GameSaveData | null {
    return this.current;
  }

  // ================================================================
  // 一、自动存档（关键节点）
  // ================================================================

  /** 自动存档到专用键（不占用手动槽位） */
  autoSave(reason: AutoSaveReason = AutoSaveReason.MANUAL): SaveResult {
    if (!this.current) return { ok: false, reason: '无当前存档' };
    try {
      const data = SaveCodec.serialize(this.current);
      rawSet(AUTOSAVE_KEY, data);
      // 同时镜像到主存档键，保证 loadGame() 与槽位系统一致
      rawSet(SAVE_KEY, data);
      this.current.updatedAt = Date.now();
      gameEvents.emit(GameEvent.GAME_SAVED, { slot: 'auto', reason });
      return { ok: true, target: 'auto' };
    } catch (e) {
      return { ok: false, reason: `自动存档失败：${String(e)}` };
    }
  }

  /** 读取自动存档 */
  loadAuto(): LoadResult {
    const raw = rawGet(AUTOSAVE_KEY);
    if (!raw) return { ok: false, reason: '无自动存档', data: null };
    return this.decode(raw);
  }

  /** 是否存在自动存档 */
  hasAuto(): boolean {
    return !!rawGet(AUTOSAVE_KEY);
  }

  /** 绑定关键节点事件为自动存档（在应用初始化时调用一次） */
  enableAutoSaveByEvents(): void {
    gameEvents.on(GameEvent.MONTH_CHANGED, () => this.autoSave(AutoSaveReason.MONTH_END));
    gameEvents.on(GameEvent.STORY_READY, () => this.autoSave(AutoSaveReason.STORY_CHOICE));
    gameEvents.on(GameEvent.IDENTITY_TRANSITIONED, () => this.autoSave(AutoSaveReason.IDENTITY_CHANGE));
    gameEvents.on(GameEvent.MARRIAGE_CHANGED, () => this.autoSave(AutoSaveReason.MARRIAGE));
    gameEvents.on(GameEvent.CHILD_BORN, () => this.autoSave(AutoSaveReason.CHILD_BIRTH));
  }

  // ================================================================
  // 二、手动存档槽位
  // ================================================================

  /** 手动存档到指定槽位（1~3） */
  saveToSlot(slot: number): SaveResult {
    if (!isValidSlot(slot)) return { ok: false, reason: `槽位号无效（需 1~${SAVE_SLOT_COUNT}）` };
    if (!this.current) return { ok: false, reason: '无当前存档' };
    try {
      const data = SaveCodec.serialize(this.current);
      rawSet(getSlotKey(slot), data);
      this.current.updatedAt = Date.now();
      gameEvents.emit(GameEvent.GAME_SAVED, { slot, reason: AutoSaveReason.MANUAL });
      return { ok: true, target: `slot_${slot}` };
    } catch (e) {
      return { ok: false, reason: `存档失败：${String(e)}` };
    }
  }

  /** 从指定槽位读档（返回完整存档；不自动 setCurrent，由调用方决定） */
  loadFromSlot(slot: number): LoadResult {
    if (!isValidSlot(slot)) return { ok: false, reason: `槽位号无效（需 1~${SAVE_SLOT_COUNT}）`, data: null };
    const raw = rawGet(getSlotKey(slot));
    if (!raw) return { ok: false, reason: '空存档槽', data: null };
    return this.decode(raw);
  }

  /** 读取并接管为当前存档 */
  loadAndSetCurrent(slot: number): LoadResult {
    const r = this.loadFromSlot(slot);
    if (r.ok && r.data) {
      this.current = r.data;
      gameEvents.emit(GameEvent.GAME_LOADED, { slot });
    }
    return r;
  }

  /** 删除指定槽位 */
  deleteSlot(slot: number): SaveResult {
    if (!isValidSlot(slot)) return { ok: false, reason: `槽位号无效（需 1~${SAVE_SLOT_COUNT}）` };
    rawRemove(getSlotKey(slot));
    return { ok: true, target: `slot_${slot}` };
  }

  /** 列出全部槽位元信息（供存档 UI 展示） */
  listSlots(): SaveSlotMeta[] {
    const metas: SaveSlotMeta[] = [];
    for (let slot = 1; slot <= SAVE_SLOT_COUNT; slot++) {
      const raw = rawGet(getSlotKey(slot));
      if (!raw) {
        metas.push({ slot, empty: true, name: '', route: GameRoute.CONSORT, year: 0, month: 0, savedAt: 0, version: 0 });
        continue;
      }
      try {
        const parsed = JSON.parse(raw);
        metas.push({
          slot, empty: false,
          name: parsed.character?.name ?? '未知',
          route: parsed.character?.route ?? GameRoute.CONSORT,
          year: parsed.time?.year ?? 0,
          month: parsed.time?.month ?? 0,
          savedAt: parsed.updatedAt ?? 0,
          version: parsed.version ?? 0,
        });
      } catch (_) {
        // 损坏档：标记为空但SavedAt=0，UI 可提示"存档损坏"
        metas.push({ slot, empty: false, name: '（存档损坏）', route: GameRoute.CONSORT, year: 0, month: 0, savedAt: -1, version: 0 });
      }
    }
    return metas;
  }

  /** 校验指定槽位（不读取完整数据，只返回校验结果） */
  validateSlot(slot: number): SaveValidation {
    if (!isValidSlot(slot)) return { valid: false, messages: ['槽位号无效'], routeConsistent: false };
    const raw = rawGet(getSlotKey(slot));
    if (!raw) return { valid: false, messages: ['空存档槽'], routeConsistent: false };
    const r = SaveCodec.deserialize(raw);
    return r.validation ?? { valid: r.ok, messages: r.ok ? [] : ['存档无法解析'], routeConsistent: true };
  }

  // ================================================================
  // 三、内部
  // ================================================================

  /** 反序列化 + 校验 + 迁移 + 发读档事件 */
  private decode(raw: string): LoadResult {
    const r = SaveCodec.deserialize(raw);
    if (!r.ok || !r.data) {
      return { ok: false, reason: r.validation?.messages.join('；') ?? '读档失败', data: null, validation: r.validation };
    }
    gameEvents.emit(GameEvent.GAME_LOADED, { slot: 'auto' });
    return { ok: true, data: r.data, validation: r.validation };
  }
}
