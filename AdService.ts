/**
 * 激励广告 SDK 接入框架 —— 统一封装，仅 4 点位，绝不强制。
 * ------------------------------------------------------------------
 * 设计原则：
 *   1. 广告位 ID 运行时注入（AD_SLOT_CONFIGS.adUnitId 留空，微信后台创建后填入），代码不写死。
 *   2. 平台 SDK 适配层注入（load/show 回调），本框架不直接依赖 wx 对象，便于测试与多端。
 *   3. 广告未加载 / 失败 / 用户放弃 → 一律走"普通结果兜底"，返回 rewarded=false 或 fallback=true，绝不卡死流程。
 *   4. 严禁强制观看、严禁诱导分享：所有点位均在玩家主动点击后触发，可随时放弃。
 *   5. 频控 + 统计写入存档 adStats。
 *
 * ⚠️ 微信激励视频广告 API（如 wx.createRewardedVideoAd）的具体名称与回调签名以官方文档为准；
 *    本框架通过 AdPlatformAdapter 抽象，接入时由适配层实现，避免 API 误用。
 */
import {
  AdResult,
  AdSlot,
  AdStats,
  EventLogType,
  GameSaveData,
} from '../types/types';
import { AD_POLICY, getAdSlotConfig } from '../config/AdConfig';
import { gameEvents, GameEvent } from '../core/EventBus';

/** 平台广告适配器（由接入层实现真实 wx 激励广告调用；这里只约定回调契约） */
export interface AdPlatformAdapter {
  /** 预加载广告；onLoad/onError 二选一回调 */
  load(adUnitId: string, onLoad: () => void, onError: (err?: any) => void): void;
  /** 展示广告；onReward=完整观看发放奖励；onClose(completed)=关闭，completed=true 表示看完 */
  show(onReward: () => void, onClose: (completed: boolean) => void): void;
  /** 广告位 ID 是否有效（未配置/占位返回 false，直接走兜底） */
  isConfigured(adUnitId: string): boolean;
}

/** 广告执行选项 */
export interface AdShowOptions {
  /** 是否允许在看广告前先给普通兜底（默认 true，保证不卡死） */
  allowFallback?: boolean;
  /** 自定义兜底回调（广告不可用时执行，返回是否成功发放普通结果） */
  onFallback?: () => boolean;
  /** 看广告成功后的奖励回调（返回是否成功应用奖励） */
  onReward?: () => boolean;
}

export class AdService {
  constructor(
    private save: GameSaveData,
    private adapter: AdPlatformAdapter,
    /** 广告位 ID 配置注入（点位→ID），缺省时读 AD_SLOT_CONFIGS（通常为空占位→走兜底） */
    private idProvider: Partial<Record<AdSlot, string>> = {},
    private random: () => number = Math.random,
  ) {}

  /** 取某点位的最终广告位 ID（运行时注入优先，其次配置表，空则未配置） */
  private resolveAdUnitId(slot: AdSlot): string {
    return this.idProvider[slot] ?? getAdSlotConfig(slot)?.adUnitId ?? '';
  }

  /** 频控检查：距上次观看不足间隔，或超每日上限，则不允许再看（走兜底） */
  private isRateLimited(slot: AdSlot): boolean {
    const stats = this.save.adStats;
    if (stats.lastWatchedAt > 0 && Date.now() - stats.lastWatchedAt < AD_POLICY.minIntervalMs) return true;
    const cap = AD_POLICY.perSlotDailyCap;
    if (cap > 0 && (stats.watchCount[slot] ?? 0) >= cap) return true;
    return false;
  }

  /**
   * 展示激励广告（统一入口）。
   * 返回 AdResult：rewarded 表示玩家最终拿到了奖励（看广告成功 或 兜底发放）。
   * 任何异常都不抛出，保证调用方流程不中断。
   */
  show(slot: AdSlot, opts: AdShowOptions = {}): Promise<AdResult> {
    const cfg = getAdSlotConfig(slot);
    const adUnitId = this.resolveAdUnitId(slot);

    // 未配置 / 频控 / 无适配器 → 直接兜底
    if (!this.adapter || !this.adapter.isConfigured(adUnitId) || this.isRateLimited(slot)) {
      return Promise.resolve(this.fallback(slot, opts, '广告暂不可用，已按普通结果结算'));
    }

    return new Promise<AdResult>((resolve) => {
      let settled = false;
      let rewardGranted = false;

      const finish = (result: AdResult) => {
        if (settled) return;
        settled = true;
        this.recordAdEvent(slot, result);
        resolve(result);
      };

      const fallbackOnFail = (reason: string) => finish(this.fallback(slot, opts, reason));

      try {
        // 1) 加载
        const loadTimer = setTimeout(() => fallbackOnFail('广告加载超时'), AD_POLICY.loadTimeoutMs);
        this.adapter.load(
          adUnitId,
          () => {
            clearTimeout(loadTimer);
            // 2) 展示
            try {
              this.adapter.show(
                () => {
                  // 成功回调：发放奖励
                  rewardGranted = opts.onReward ? opts.onReward() : true;
                },
                (completed: boolean) => {
                  // 关闭回调：completed=true 视为完整观看
                  if ((completed || rewardGranted) && rewardGranted) {
                    this.bumpWatchStats(slot);
                    finish({ rewarded: true, watched: true, fallback: false, slot });
                  } else {
                    // 用户放弃 / 未看完 → 兜底，不强制
                    fallbackOnFail('你已放弃观看，已按普通结果结算');
                  }
                },
              );
            } catch (_) {
              clearTimeout(loadTimer);
              fallbackOnFail('广告展示异常，已按普通结果结算');
            }
          },
          () => {
            clearTimeout(loadTimer);
            fallbackOnFail('广告加载失败，已按普通结果结算');
          },
        );
      } catch (_) {
        fallbackOnFail('广告调用异常，已按普通结果结算');
      }
    });
  }

  /** 兜底：执行 onFallback（若有）并记录，绝不卡死 */
  private fallback(slot: AdSlot, opts: AdShowOptions, reason: string): AdResult {
    let rewarded = false;
    if (opts.allowFallback !== false && opts.onFallback) {
      try { rewarded = opts.onFallback(); } catch (_) { rewarded = false; }
    }
    const result: AdResult = { rewarded, watched: false, fallback: true, reason, slot };
    this.recordAdEvent(slot, result);
    return result;
  }

  /** 累计观看统计 */
  private bumpWatchStats(slot: AdSlot): void {
    const s = this.save.adStats;
    s.watchCount[slot] = (s.watchCount[slot] ?? 0) + 1;
    s.totalWatched += 1;
    s.lastWatchedAt = Date.now();
  }

  /** 广告事件写日志 + 发事件（成功/兜底都记，便于风控分析） */
  private recordAdEvent(slot: AdSlot, result: AdResult): void {
    this.save.eventLog.push({
      date: { year: this.save.time.year, month: this.save.time.month },
      type: EventLogType.AD,
      title: `激励广告·${slot}`,
      detail: result.watched ? '完整观看，奖励已发放' : `未观看/兜底：${result.reason ?? ''}`,
    });
    gameEvents.emit(GameEvent.AD_WATCHED, { ...result, slot });
  }

  /** 读广告统计（UI/风控用） */
  getStats(): AdStats {
    return this.save.adStats;
  }
}
