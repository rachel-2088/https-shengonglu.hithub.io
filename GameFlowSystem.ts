/**
 * 游戏总控编排器 —— 整合所有系统的中枢。
 * ------------------------------------------------------------------
 * 职责：
 *   1. 月结束编排：行动点归零 → TimeSystem 跨月 → 俸禄 → 差事刷新 → 朝臣列表刷新 → 晋升判定 → 年末总结
 *   2. 行动点统一校验：进入地点/差事/拜访/回家相聚统一走 TimeSystem.canAct，不足禁止
 *   3. 身份转换：宫女转线后切换权限、迁移数据（由 MaidTransitionSystem 完成）、刷新主界面入口
 *   4. 存档钩子：月结束/关键事件/转线/结婚/生子/手动操作自动或手动存档
 *   5. 读档后完整恢复 UI 状态（重建视图模型）
 * ⚠️ 所有刷新与数值读配置；本编排器不重复实现业务规则，只负责"按序调用 + 存档 + 通知"。
 */
import {
  ConsortRank,
  GameActionResult,
  GameRoute,
  GameSaveData,
  MainUIViewModel,
  MonthTickResult,
  PromotionResult,
  YearEndSummary,
} from '../types/types';
import { TimeSystem } from '../core/TimeSystem';
import { MapSystem } from './MapSystem';
import { DutySystem } from './DutySystem';
import { MinisterEncounterSystem } from './MinisterEncounterSystem';
import { PromotionSystem } from './PromotionSystem';
import { MaidTransitionSystem, TransitionResult } from './MaidTransitionSystem';
import { MainUISystem } from '../ui/MainUISystem';
import { SaveManager, AutoSaveReason } from './SaveManager';
import { gameEvents, GameEvent } from '../core/EventBus';

export class GameFlowSystem {
  /** 上次年末总结（供弹窗展示） */
  private lastYearEnd: YearEndSummary | null = null;
  /** 上次晋升结果（供专属剧情弹窗展示） */
  private lastPromotion: PromotionResult | null = null;

  constructor(
    private save: GameSaveData,
    public time: TimeSystem,
    public map: MapSystem,
    public duty: DutySystem,
    public encounter: MinisterEncounterSystem,
    public promotion: PromotionSystem,
    public transition: MaidTransitionSystem,
    public ui: MainUISystem,
    private saves: SaveManager,
    /** 主存档槽位（默认 1） */
    private slot: number = 1,
  ) {}

  /** 统一行动点校验（所有消耗 AP 的操作入口都走这里） */
  canAct(cost: number = 1): boolean {
    return this.time.canAct(cost);
  }

  /** 进入地点（统一走行动点校验 + 失败禁止） */
  enterLocation(id: any): GameActionResult {
    if (!this.canAct(1)) {
      return { ok: false, reason: '行动点不足，本月已结束', refreshUI: false };
    }
    const r = this.map.enter(id);
    if (!r.ok) return { ok: false, reason: r.reason, refreshUI: false };
    this.ui.refresh();
    // 行动点可能归零触发跨月，交由 consume 内部处理；此处检查是否需要月编排
    return { ok: true, refreshUI: true };
  }

  /**
   * 月结束编排（在 TimeSystem.advanceMonth 之后调用，或由外部主动触发）。
   * 串联：差事刷新 → 朝臣列表刷新 → 晋升判定 → 年末总结 → 存档。
   */
  tickMonth(): MonthTickResult {
    const beforeDate = { ...this.time.currentDate };

    // 1) 推进时间（内部已发俸禄/重置AP/年末结算/发 MONTH_CHANGED 事件）
    const report = this.time.advanceMonth();

    // 2) 差事池刷新
    this.duty.refreshMonthly();

    // 3) 朝臣邂逅列表刷新（女官线且解锁时）
    if (this.save.character.route === GameRoute.OFFICIAL) {
      this.encounter.refreshMonthly(false);
    }

    // 4) 晋升判定（每月一次）
    const promo = this.promotion.checkAndPromote();
    this.lastPromotion = promo.promoted ? promo : null;

    // 5) 年末总结（转换结构供 UI 弹窗）
    const yearEnd: YearEndSummary | null = report.yearEnd
      ? { year: report.yearEnd.year, silverBonus: report.yearEnd.silverBonus, attrBonuses: report.yearEnd.attrBonuses }
      : null;
    this.lastYearEnd = yearEnd;

    // 6) 存档钩子：月结束自动存档
    this.saves.setCurrent(this.save);
    this.saves.autoSave(AutoSaveReason.MONTH_END);

    // 7) 刷新主界面 + 发月编排完成事件（UI 可据此弹年末/晋升剧情弹窗）
    this.ui.refresh();
    gameEvents.emit(GameEvent.MONTH_TICKED, { date: this.time.currentDate, promotion: promo, yearEnd });
    gameEvents.emit(GameEvent.YEAR_END_SUMMARY, yearEnd);

    return {
      ok: true,
      date: this.time.currentDate,
      salary: report.salaryGranted,
      yearEnd,
      promotion: promo,
      transitionReady: this.isTransitionReady(),
    };
  }

  /** 宫女是否已达转线抉择条件（掌事姑姑） */
  private isTransitionReady(): boolean {
    return this.save.character.route === GameRoute.MAID &&
      this.save.character.maidRank === 'zhangShi';
  }

  /** 宫女宠幸进封 → 妃嫔线（迁移数据由转线系统完成，这里负责存档+UI刷新） */
  imperialFavorTransition(): GameActionResult {
    const r: TransitionResult = this.transition.imperialFavorPromotion();
    if (!r.ok) return { ok: false, reason: r.reason, refreshUI: false };
    return this.afterIdentityChange('宠幸进封');
  }

  /** 宫女考选 → 女官线 */
  examinationTransition(): GameActionResult {
    const r: TransitionResult = this.transition.examinationToOfficial();
    if (!r.ok) return { ok: false, reason: r.reason, refreshUI: false };
    return this.afterIdentityChange('考选转女官');
  }

  /** 身份转换后统一处理：存档 + 重建 UI 入口 + 剧情弹窗通知 */
  private afterIdentityChange(detail: string): GameActionResult {
    this.saves.setCurrent(this.save);
    this.saves.autoSave(AutoSaveReason.IDENTITY_CHANGE);
    this.ui.refresh();
    gameEvents.emit(GameEvent.KEY_STORY_READY, { type: 'transition', detail, route: this.save.character.route });
    return { ok: true, refreshUI: true, autoSaveReason: 'identityChange' };
  }

  /** 手动存档钩子 */
  manualSave(): GameActionResult {
    this.saves.setCurrent(this.save);
    const r = this.saves.saveToSlot(this.slot);
    if (!r.ok) return { ok: false, reason: r.reason, refreshUI: false };
    return { ok: true, refreshUI: false, autoSaveReason: 'manual' };
  }

  /**
   * 读档后完整恢复 UI 状态：重建所有系统引用由外层完成，这里只负责刷新视图模型。
   * 返回重建后的视图模型供 UI 直接渲染。
   */
  restoreUIAfterLoad(): MainUIViewModel {
    this.saves.setCurrent(this.save);
    return this.ui.refresh();
  }

  /** 当前主界面视图模型（不触发事件） */
  getViewModel(): MainUIViewModel {
    return this.ui.buildViewModel();
  }

  getLastYearEnd(): YearEndSummary | null { return this.lastYearEnd; }
  getLastPromotion(): PromotionResult | null { return this.lastPromotion; }
}
