/**
 * 事件弹窗流程系统 —— 地点进入 → 操作列表 → 事件文本+选项 → 结算 → 反馈 → 扣AP → 自动存档。
 * ⚠️ 事件文本/选项/数值全部读 EventConfig；随机池按地点+路线抽取；隐藏支线选项需广告解锁。
 */
import {
  AdResult,
  AdSlot,
  ConsortEffect,
  EventChoiceConfig,
  EventFlowResult,
  EventFlowState,
  GameRoute,
  GameSaveData,
  LocationEventConfig,
  PalaceLocation,
} from '../types/types';
import { queryLocationEvents } from '../config/EventConfig';
import { getAdSlotConfig } from '../config/AdConfig';
import { applyConsortEffect, addFavor, addConsortAffection, addMinisterAffection } from '../data/saveData';
import { AdService } from '../utils/AdService';
import { gameEvents, GameEvent } from '../core/EventBus';
import { TimeSystem } from '../core/TimeSystem';
import { MapSystem } from './MapSystem';

export class EventFlowSystem {
  private state: EventFlowState = {
    stage: 'idle', locationId: null, event: null, chosen: null, resultText: '', apCharged: false,
  };

  constructor(
    private save: GameSaveData,
    private time: TimeSystem,
    private map: MapSystem,
    private ads: AdService,
    private random: () => number = Math.random,
  ) {}

  /** 当前弹窗状态（UI 只读渲染） */
  getState(): EventFlowState {
    return { ...this.state };
  }

  /**
   * 进入地点：打开操作列表 + 抽一个随机事件（不立即扣 AP，进地点本身由 MapSystem 扣）。
   * 返回的 LocationVisitResult 含操作列表与事件 ID。
   */
  enterLocation(id: PalaceLocation): { ok: boolean; reason?: string; actions: any[] } {
    const visit = this.map.enter(id);
    if (!visit.ok) {
      return { ok: false, reason: visit.reason, actions: [] };
    }
    // 从配置随机池抽事件（按地点+路线）
    const pool = queryLocationEvents(id, this.save.character.route);
    const picked = this.weightedPick(pool);
    this.state = {
      stage: picked ? 'event' : 'idle',
      locationId: id,
      event: picked,
      chosen: null,
      resultText: '',
      apCharged: false,
    };
    return { ok: true, actions: visit.actions };
  }

  /** 加权随机抽取事件 */
  private weightedPick(pool: LocationEventConfig[]): LocationEventConfig | null {
    if (pool.length === 0) return null;
    const total = pool.reduce((s, e) => s + (e.weight || 0), 0);
    if (total <= 0) return pool[Math.floor(this.random() * pool.length)];
    let pick = this.random() * total;
    for (const e of pool) {
      pick -= e.weight || 0;
      if (pick < 0) return e;
    }
    return pool[pool.length - 1];
  }

  /** 当前事件的选项列表（供 UI 渲染；标记需广告解锁的选项） */
  listChoices(): EventChoiceConfig[] {
    return this.state.event?.choices ?? [];
  }

  /**
   * 选择一个选项并结算。
   * 若选项 requiresAd，则先触发广告（成功才应用完整效果；失败/放弃走兜底效果或普通结果）。
   * 结算后扣 1 行动点、写结果反馈、发 EVENT_RESOLVED、返回 shouldSave=true。
   */
  async choose(choiceId: string): Promise<EventFlowResult> {
    if (this.state.stage !== 'event' || !this.state.event) {
      return { ok: false, reason: '当前无待结算事件', state: this.getState(), shouldSave: false };
    }
    const choice = this.state.event.choices.find((c) => c.id === choiceId);
    if (!choice) {
      return { ok: false, reason: '选项不存在', state: this.getState(), shouldSave: false };
    }

    let effect: ConsortEffect = choice.effect;
    let resultText = choice.resultText;
    let rewardGranted = true;

    // 广告解锁选项：看广告成功→完整效果；放弃/失败→兜底（不给该选项专属奖励，改用中性结果）
    if (choice.requiresAd) {
      const ad: AdResult = await this.ads.show(choice.requiresAd, {
        onReward: () => true,
        onFallback: () => false, // 兜底不发专属奖励
      });
      rewardGranted = ad.rewarded && ad.watched;
      if (!rewardGranted) {
        effect = {}; // 不看广告不给该选项的数值奖励
        resultText = `${getFallbackText(choice.requiresAd)}${choice.resultText ? '（未观看，未获得额外奖励）' : ''}`;
      }
    }

    // 应用数值效果（统一效果包）
    if (rewardGranted) applyConsortEffect(this.save, effect);

    // 应用好感结算（朝臣用 addMinisterAffection / 嫔妃用 addConsortAffection）
    if (rewardGranted && choice.affinity) {
      for (const { targetId, delta } of choice.affinity) {
        this.applyAffinity(targetId, delta);
      }
    }

    // 扣 1 行动点（进入地点已由 MapSystem 扣，这里选项结算再扣 1；不足则拦截）
    // 说明：事件选项作为一次独立操作扣 AP，与进入地点分开，符合"进入→操作→结算"流程。
    let apCharged = false;
    if (this.time.canAct(1)) {
      this.time.consume(1);
      apCharged = true;
    }

    this.state = {
      ...this.state,
      stage: 'result',
      chosen: choice,
      resultText,
      apCharged,
    };

    this.save.eventLog.push({
      date: this.time.currentDate,
      type: 3 as any, // EventLogType.EVENT
      title: `事件·${this.state.event!.title}`,
      detail: `${choice.label}｜${resultText}`,
    });
    gameEvents.emit(GameEvent.EVENT_RESOLVED, { eventId: this.state.event!.id, choiceId, apCharged, rewardGranted });

    return { ok: true, state: this.getState(), shouldSave: true };
  }

  /** 好感结算：按 NPC ID 前缀判断朝臣/嫔妃池 */
  private applyAffinity(targetId: string, delta: number): void {
    // 延迟引入避免顶层循环依赖：用 saveData 的局部更新函数
    if (targetId.startsWith('cnp_')) addConsortAffection(this.save, targetId, delta);
    else if (targetId.startsWith('min_') || targetId.startsWith('minister_')) addMinisterAffection(this.save, targetId, delta);
    else addFavor(this.save, delta); // 兜底：视作帝宠
  }

  /** 关闭结果弹窗，回到 idle */
  closeResult(): void {
    this.state = {
      stage: 'idle', locationId: null, event: null, chosen: null, resultText: '', apCharged: false,
    };
  }
}

/** 从广告配置取兜底文案（避免此处硬编码） */
function getFallbackText(slot: AdSlot): string {
  const cfg = getAdSlotConfig(slot);
  return cfg?.fallbackDesc ?? '广告不可用，已按普通结果结算。';
}
