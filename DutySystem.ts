/**
 * 差事任务系统 —— 三路线各自独立
 * 覆盖：每月自动刷新差事池 / 接受差事消耗行动点 / 完成发放奖励 /
 *       失败扣数值+负面事件 / 晋升专属差事（达门槛刷出，完成才可晋升）。
 * ⚠️ 权限锁：宫女勤谨/女官公务/妃嫔宫廷三路线各自屏蔽非本路线差事入口。
 * 所有数值读 config/DutyConfig，业务层零硬编码。
 */
import {
  AttributeKey,
  ConsortRank,
  DutyCategory,
  DutyConfigData,
  DutyResult,
  DutyReward,
  EventLogType,
  GameRoute,
  GameSaveData,
  MaidRank,
  OfficialRank,
} from '../types/types';
import {
  DUTY_CONFIGS,
  DUTY_REFRESH_CONFIG,
  getDutyConfig,
  getDutiesByCategory,
} from '../config/GameConfig';
import {
  addAttribute,
  addFavor,
  addItem,
  addPrestige,
  addSilver,
  getItemCount,
  removeItem,
} from '../data/saveData';
import { gameEvents, GameEvent } from '../core/EventBus';

/** 随机源 */
type Rng = () => number;

export class DutySystem {
  constructor(
    private save: GameSaveData,
    private persist: () => void = () => {},
    private rng: Rng = Math.random,
    /** 扣行动点回调（由 UI/地图层注入，返回是否扣成功；不传则内部直接扣） */
    private consumeAp?: (cost: number) => boolean,
  ) {}

  // ================================================================
  // 一、权限与差事池
  // ================================================================

  /** 当前路线的差事类别 */
  private currentCategory(): DutyCategory | null {
    switch (this.save.character.route) {
      case GameRoute.MAID: return DutyCategory.MAID_DILIGENCE;
      case GameRoute.OFFICIAL: return DutyCategory.OFFICIAL_DUTY;
      case GameRoute.CONSORT: return DutyCategory.CONSORT_DUTY;
      default: return null;
    }
  }

  /** 当前路线主阶位字符串（用于门槛比对） */
  private currentRank(): string | null {
    const ch = this.save.character;
    if (ch.route === GameRoute.MAID) return ch.maidRank;
    if (ch.route === GameRoute.OFFICIAL) return ch.officialRank;
    if (ch.route === GameRoute.CONSORT) return ch.consortRank;
    return null;
  }

  /** 阶位序位（数字越大越高）；不同枚举分别映射 */
  private rankOrder(rank: string | null): number {
    if (!rank) return -1;
    if (this.save.character.route === GameRoute.MAID) return Object.values(MaidRank).indexOf(rank as MaidRank);
    if (this.save.character.route === GameRoute.OFFICIAL) return Object.values(OfficialRank).indexOf(rank as OfficialRank);
    if (this.save.character.route === GameRoute.CONSORT) return Object.values(ConsortRank).indexOf(rank as ConsortRank);
    return -1;
  }

  /** 是否满足差事的阶位门槛 */
  private meetRank(cfg: DutyConfigData): boolean {
    if (!cfg.minRank) return true;
    return this.rankOrder(this.currentRank()) >= this.rankOrder(cfg.minRank);
  }

  /** 本月可接差事（跨月自动刷新） */
  getAvailableDuties(): DutyConfigData[] {
    const cur = `${this.save.time.year}-${this.save.time.month}`;
    if (this.save.dutyState.lastRefreshDate === null ||
        `${this.save.dutyState.lastRefreshDate.year}-${this.save.dutyState.lastRefreshDate.month}` !== cur) {
      this.refreshMonthly();
    }
    return this.save.dutyState.availableIds
      .map((id) => getDutyConfig(id))
      .filter((c): c is DutyConfigData => !!c && c.category === this.currentCategory());
  }

  /** 刷新本月差事池（普通差事随机抽 N + 晋升差事达门槛必出） */
  refreshMonthly(): DutyConfigData[] {
    const cat = this.currentCategory();
    if (!cat) return [];
    const all = getDutiesByCategory(cat);
    const normal = all.filter((d) => !d.isPromotion && this.meetRank(d));
    const promotions = all.filter((d) => d.isPromotion && this.meetRank(d));

    // 不重复随机抽普通差事
    const pool = [...normal];
    const picked: DutyConfigData[] = [];
    const count = Math.min(DUTY_REFRESH_CONFIG.count, pool.length);
    while (picked.length < count && pool.length > 0) {
      const idx = Math.floor(this.rng() * pool.length);
      picked.push(pool[idx]);
      pool.splice(idx, 1);
    }
    if (DUTY_REFRESH_CONFIG.promotionAlwaysInclude) picked.push(...promotions);

    this.save.dutyState = {
      availableIds: picked.map((d) => d.id),
      activeId: null,
      completedIds: [],
      lastRefreshDate: { ...this.save.time },
    };
    this.persist();
    gameEvents.emit(GameEvent.DUTY_REFRESHED, { ids: [...this.save.dutyState.availableIds] });
    return picked;
  }

  /** 查询当前进行中的差事 */
  getActiveDuty(): DutyConfigData | null {
    const id = this.save.dutyState.activeId;
    return id ? (getDutyConfig(id) ?? null) : null;
  }

  // ================================================================
  // 二、接受与结算
  // ================================================================

  /** 接受差事（消耗行动点；一次只能接一件） */
  accept(dutyId: string): { ok: boolean; reason?: string } {
    const cfg = getDutyConfig(dutyId);
    if (!cfg) return { ok: false, reason: '差事不存在' };
    if (cfg.category !== this.currentCategory()) return { ok: false, reason: '该差事不属于当前路线' };
    if (!this.save.dutyState.availableIds.includes(dutyId)) return { ok: false, reason: '本月该差事不可接' };
    if (this.save.dutyState.activeId) return { ok: false, reason: '已有进行中的差事' };
    if (!this.meetRank(cfg)) return { ok: false, reason: '阶位不足' };

    // 行动点：注入回调优先，否则内部检查并扣
    if (this.consumeAp) {
      if (!this.consumeAp(cfg.actionCost)) return { ok: false, reason: '行动点不足' };
    } else {
      if (this.save.time.actionPoints < cfg.actionCost) return { ok: false, reason: '行动点不足' };
      this.save.time.actionPoints -= cfg.actionCost;
      gameEvents.emit(GameEvent.ACTION_CONSUMED, { cost: cfg.actionCost });
    }
    this.save.dutyState.activeId = dutyId;
    this.persist();
    gameEvents.emit(GameEvent.DUTY_ACCEPTED, { dutyId });
    return { ok: true };
  }

  /**
   * 完成/结算当前差事（按难度判定成功或失败；成功发奖励，失败扣数值并挂 DEBUFF）。
   * @param rngBonus 外部传入的额外成功率修正（如侍从协助 +0.1），默认 0。
   */
  complete(rngBonus: number = 0): DutyResult {
    const id = this.save.dutyState.activeId;
    if (!id) return { ok: false, reason: '当前无进行中的差事', dutyId: '', success: false, reward: {}, penalty: {}, promotionReady: false };
    const cfg = getDutyConfig(id)!;

    // 差事需求品校验（接受时已可检查，这里再次确认）
    let extraBonus = rngBonus;
    if (cfg.requiredItem) {
      if (getItemCount(this.save, cfg.requiredItem) > 0) {
        removeItem(this.save, cfg.requiredItem, 1);
        extraBonus += 0.2; // 带齐需求品提升成功率
      } else {
        extraBonus -= 0.25; // 缺需求品降低成功率
      }
    }

    const successRate = Math.max(0.05, Math.min(0.95, 1 - cfg.difficulty + extraBonus));
    const success = this.rng() < successRate;
    if (success) {
      this.applyReward(cfg.reward);
      this.log(EventLogType.DUTY, `差事完成·${cfg.name}`, cfg.desc);
    } else {
      this.applyReward(cfg.penalty);
      this.log(EventLogType.DUTY, `差事失利·${cfg.name}`, '差事办砸，蒙受损失。');
      // 失败触发负面事件（挂 DEBUFF）
      const debuffId = `db_duty_fail_${cfg.id}`;
      if (!this.save.character.activeDebuffs.some((d) => d.id === debuffId)) {
        this.save.character.activeDebuffs.push({
          id: debuffId, name: '差事纰漏', desc: `${cfg.name}办砸留下的负面影响`, remainMonths: 2,
        });
      }
    }

    if (!this.save.dutyState.completedIds.includes(id)) this.save.dutyState.completedIds.push(id);
    this.save.dutyState.activeId = null;
    const promotionReady = !!cfg.isPromotion && success;
    this.persist();
    gameEvents.emit(GameEvent.DUTY_COMPLETED, { dutyId: id, success, promotionReady, category: cfg.category });
    return { ok: true, dutyId: id, success, reward: cfg.reward, penalty: cfg.penalty, promotionReady };
  }

  /** 放弃当前差事（不退行动点） */
  abandon(): { ok: boolean; reason?: string } {
    if (!this.save.dutyState.activeId) return { ok: false, reason: '当前无进行中的差事' };
    this.save.dutyState.activeId = null;
    this.persist();
    return { ok: true };
  }

  /** 晋升差事是否已完成（晋升系统可查询此状态作为门槛之一） */
  isPromotionDone(targetRank: string): boolean {
    const done = this.save.dutyState.completedIds;
    return DUTY_CONFIGS.some((d) => d.isPromotion && d.promotionTarget === targetRank && done.includes(d.id));
  }

  /**
   * 该职级是否配置了晋升专属差事（V4兜底）。
   * 无差事配置时晋升系统不应强求，避免新增职级遗漏配置导致永久卡死。
   */
  hasPromotionDuty(targetRank: string): boolean {
    return DUTY_CONFIGS.some((d) => d.isPromotion && d.promotionTarget === targetRank);
  }

  // ================================================================
  // 三、奖励结算
  // ================================================================

  /** 应用一段奖励/惩罚（数值可正可负） */
  private applyReward(reward: DutyReward): void {
    if (typeof reward.silver === 'number') addSilver(this.save, reward.silver);
    if (typeof reward.diligence === 'number') this.save.character.diligence = Math.max(0, this.save.character.diligence + reward.diligence);
    if (typeof reward.merit === 'number') this.save.character.merit = Math.max(0, this.save.character.merit + reward.merit);
    if (typeof reward.prestige === 'number') addPrestige(this.save, reward.prestige);
    if (typeof reward.reputation === 'number') this.save.character.reputation = Math.max(0, this.save.character.reputation + reward.reputation);
    if (typeof reward.favor === 'number') addFavor(this.save, reward.favor);
    if (reward.attributes) {
      for (const [key, delta] of Object.entries(reward.attributes)) {
        if (typeof delta === 'number') addAttribute(this.save, key as AttributeKey, delta);
      }
    }
  }

  private log(type: EventLogType, title: string, detail: string): void {
    this.save.eventLog.unshift({ date: { ...this.save.time }, type, title, detail });
    if (this.save.eventLog.length > 200) this.save.eventLog.length = 200;
  }
}
