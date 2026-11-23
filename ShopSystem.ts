/**
 * 背包商店系统 —— 三路线通用
 * 覆盖：道具存放/使用/赠送NPC / 背包容量限制 / 商店每月刷新货品 / 银两购买。
 * ⚠️ 送礼只扣背包库存，实际好感增量由 MarriageSystem / ConsortIntrigueSystem 计算（本系统不碰好感）。
 * 所有数值读 config/ShopConfig，业务层零硬编码。
 */
import {
  AttributeKey,
  GameSaveData,
  ShopItemConfig,
} from '../types/types';
import {
  SHOP_CONFIG,
  SHOP_ITEMS,
  getItemConfig,
  refreshShopStock,
} from '../config/GameConfig';
import {
  addItem,
  addSilver,
  getInventorySlots,
  getItemCount,
  removeItem,
} from '../data/saveData';
import { gameEvents, GameEvent } from '../core/EventBus';

export interface BuyResult {
  ok: boolean;
  reason?: string;
  itemId: string;
  count: number;
  cost: number;
}

export interface UseResult {
  ok: boolean;
  reason?: string;
  itemId: string;
  /** 使用增加的属性（用于 UI 展示） */
  attrGains: Partial<Record<AttributeKey, number>>;
}

export interface GiftResult {
  ok: boolean;
  reason?: string;
  itemId: string;
  targetId: string;
}

/** 随机源 */
type Rng = () => number;

export class ShopSystem {
  /** 本月商店货品 ID 列表（不持久化的会话态，读档后按需刷新） */
  private stock: string[] = [];
  /** 上次刷新的年月标记 */
  private stockMonth: string | null = null;

  constructor(
    private save: GameSaveData,
    private persist: () => void = () => {},
    private rng: Rng = Math.random,
  ) {}

  // ================================================================
  // 一、商店
  // ================================================================

  /** 本月商店货品（跨月自动刷新） */
  getStock(): ShopItemConfig[] {
    const cur = `${this.save.time.year}-${this.save.time.month}`;
    if (this.stockMonth !== cur || this.stock.length === 0) {
      this.refreshStock();
    }
    return this.stock.map((id) => getItemConfig(id)).filter((c): c is ShopItemConfig => !!c);
  }

  /** 强制刷新本月货品 */
  refreshStock(): string[] {
    this.stock = refreshShopStock(this.rng);
    this.stockMonth = `${this.save.time.year}-${this.save.time.month}`;
    gameEvents.emit(GameEvent.SHOP_REFRESHED, { stock: [...this.stock] });
    return [...this.stock];
  }

  /** 购买道具（检查银两/容量/货品在售） */
  buy(itemId: string, count: number = 1): BuyResult {
    const cfg = getItemConfig(itemId);
    if (!cfg) return { ok: false, reason: '道具不存在', itemId, count, cost: 0 };
    if (count <= 0) return { ok: false, reason: '购买数量无效', itemId, count, cost: 0 };
    if (!this.stock.includes(itemId) && this.stock.length > 0) {
      return { ok: false, reason: '该道具本月未在售', itemId, count, cost: 0 };
    }
    // 容量校验：新道具且已满
    if (getItemCount(this.save, itemId) === 0 && getInventorySlots(this.save) >= SHOP_CONFIG.inventoryCapacity) {
      return { ok: false, reason: '背包已满', itemId, count, cost: 0 };
    }
    const cost = cfg.price * count;
    if (this.save.character.silver < cost) {
      return { ok: false, reason: '银两不足', itemId, count, cost };
    }
    addSilver(this.save, -cost);
    addItem(this.save, itemId, count);
    this.persist();
    gameEvents.emit(GameEvent.ITEM_PURCHASED, { itemId, count, cost });
    return { ok: true, itemId, count, cost };
  }

  // ================================================================
  // 二、背包
  // ================================================================

  /** 使用道具（仅 usable=true；应用属性加成） */
  use(itemId: string): UseResult {
    const cfg = getItemConfig(itemId);
    if (!cfg) return { ok: false, reason: '道具不存在', itemId, attrGains: {} };
    if (!cfg.usable) return { ok: false, reason: '该道具不可使用', itemId, attrGains: {} };
    if (getItemCount(this.save, itemId) <= 0) return { ok: false, reason: '背包中没有此道具', itemId, attrGains: {} };

    const gains: Partial<Record<AttributeKey, number>> = {};
    if (cfg.attrBonus) {
      for (const [key, delta] of Object.entries(cfg.attrBonus)) {
        if (typeof delta === 'number' && delta > 0) {
          const attrKey = key as AttributeKey;
          const cur = this.save.character.attributes[attrKey] ?? 0;
          const next = cur + delta;
          this.save.character.attributes[attrKey] = next;
          gains[attrKey] = delta;
        }
      }
    }
    removeItem(this.save, itemId, 1);
    this.persist();
    gameEvents.emit(GameEvent.ITEM_USED, { itemId, gains });
    return { ok: true, itemId, attrGains: gains };
  }

  /**
   * 赠送道具（仅 giftable=true；只扣库存，好感由调用方系统计算）。
   * 调用方在好感计算成功后调本方法扣库存；失败则不调。
   */
  gift(itemId: string, targetId: string): GiftResult {
    const cfg = getItemConfig(itemId);
    if (!cfg) return { ok: false, reason: '道具不存在', itemId, targetId };
    if (!cfg.giftable) return { ok: false, reason: '该道具不可赠送', itemId, targetId };
    if (getItemCount(this.save, itemId) <= 0) return { ok: false, reason: '背包中没有此道具', itemId, targetId };
    if (!removeItem(this.save, itemId, 1)) return { ok: false, reason: '扣除道具失败', itemId, targetId };
    this.persist();
    gameEvents.emit(GameEvent.ITEM_GIFTED, { itemId, targetId });
    return { ok: true, itemId, targetId };
  }

  /** 背包条目（含配置详情，供 UI 展示） */
  listInventory(): { config: ShopItemConfig; count: number }[] {
    return this.save.inventory
      .map((entry) => {
        const cfg = getItemConfig(entry.itemId);
        return cfg ? { config: cfg, count: entry.count } : null;
      })
      .filter((x): x is { config: ShopItemConfig; count: number } => !!x);
  }

  /** 背包是否满 */
  isFull(): boolean {
    return getInventorySlots(this.save) >= SHOP_CONFIG.inventoryCapacity;
  }

  /** 按用途取道具（UI 分类展示用） */
  getItemsByUsage(usage: ShopItemConfig['usage']): ShopItemConfig[] {
    return SHOP_ITEMS.filter((i) => i.usage === usage);
  }
}
