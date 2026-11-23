/**
 * 朝臣邂逅刷新系统 —— 女官线专属（按职级解锁）
 * 三大职责：
 *   1. 每月随机刷新四大点位（宫门/宫道、翰林院、演武场、宫宴）可邂逅朝臣列表，缓存入存档
 *   2. 按女官职级解锁对应品级上限（职级越高，可遇高阶朝臣）
 *   3. 访问点位时从本月缓存中取候选，标记 met 并写入好感初始值
 * 妃嫔线、宫女线一律锁定（isUnlocked=false）。
 * 所有数值来自 config；随机源可注入便于测试。
 */
import {
  EncounterSpot,
  GameRoute,
  GameSaveData,
  MinisterConfig,
  OfficialGrade,
  OfficialRank,
} from '../types/types';
import {
  BANQUET_HIGH_GRADE_BOOST,
  ENCOUNTER_REFRESH_COUNT,
  ENCOUNTER_SPOT_CONFIGS,
  GRADE_ENCOUNTER_WEIGHT,
  MINISTER_CONFIGS,
  RANK_MINISTER_UNLOCK,
  getEncounterSpotConfig,
} from '../config/GameConfig';
import { createMinisterRuntime } from '../data/saveData';
import { gameEvents, GameEvent } from '../core/EventBus';

/** 单次邂逅结果 */
export interface EncounterResult {
  ok: boolean;
  reason?: string;
  spot: EncounterSpot;
  minister: MinisterConfig | null;
  candidates: MinisterConfig[];
}

/** 每月刷新结果 */
export interface RefreshResult {
  ok: boolean;
  reason?: string;
  refreshedAt: { year: number; month: number };
  /** 各点位刷新的朝臣数量 */
  spotCounts: Record<string, number>;
}

export class MinisterEncounterSystem {
  constructor(
    private save: GameSaveData,
    private persist: () => void = () => {},
    private random: () => number = Math.random
  ) {}

  /** 模块入口锁：仅女官线、职级达到典事（解锁表非 null）方可接触朝臣 */
  isUnlocked(): boolean {
    const c = this.save.character;
    if (c.route !== GameRoute.OFFICIAL || !c.officialRank) return false;
    return RANK_MINISTER_UNLOCK[c.officialRank] != null;
  }

  /** 当前职级可邂逅的最高品级（数字门槛：朝臣品级数字 >= 此值） */
  private gradeThreshold(): OfficialGrade | null {
    const rank = this.save.character.officialRank;
    return rank ? RANK_MINISTER_UNLOCK[rank] : null;
  }

  /**
   * 每月刷新四大点位的邂逅列表。
   * 同一年月重复调用会直接返回（避免重复刷新），跨月才重刷。
   */
  refreshMonthly(force: boolean = false): RefreshResult {
    if (!this.isUnlocked()) {
      return { ok: false, reason: '仅女官线·典事及以上可接触朝臣', refreshedAt: this.now(), spotCounts: {} };
    }
    const last = this.save.lastEncounterRefresh;
    if (!force && last && last.year === this.save.time.year && last.month === this.save.time.month) {
      return { ok: true, refreshedAt: this.now(), spotCounts: this.currentSpotCounts() };
    }

    const threshold = this.gradeThreshold()!;
    const cache: Record<string, string[]> = {};
    const spotCounts: Record<string, number> = {};

    for (const spotCfg of ENCOUNTER_SPOT_CONFIGS) {
      const pool = this.buildSpotPool(spotCfg.id, spotCfg.allowedType, threshold, spotCfg.favoredMinGrade);
      const picked = this.weightedPick(pool, Math.min(ENCOUNTER_REFRESH_COUNT, pool.length));
      cache[spotCfg.id] = picked.map((m) => m.id);
      spotCounts[spotCfg.id] = picked.length;
    }

    this.save.encounterCache = cache;
    this.save.lastEncounterRefresh = this.now();
    this.persist();
    return { ok: true, refreshedAt: this.now(), spotCounts };
  }

  /** 访问某点位，从本月缓存取邂逅对象（先按品级门槛再过滤一次，防存档缓存过期） */
  encounterAt(spot: EncounterSpot): EncounterResult {
    if (!this.isUnlocked()) {
      return this.fail(spot, '仅女官线·典事及以上可接触朝臣');
    }
    const spotCfg = getEncounterSpotConfig(spot);
    if (!spotCfg) return this.fail(spot, '无效的邂逅点位');

    // 若无缓存或缓存过期（跨月），自动刷新一次
    const last = this.save.lastEncounterRefresh;
    if (!last || last.year !== this.save.time.year || last.month !== this.save.time.month) {
      this.refreshMonthly();
    }

    const threshold = this.gradeThreshold()!;
    const ids = this.save.encounterCache[spot] ?? [];
    const candidates = ids
      .map((id) => MINISTER_CONFIGS.find((m) => m.id === id))
      .filter((m): m is MinisterConfig => !!m && m.grade >= threshold)
      .filter((m) => !spotCfg.allowedType || m.type === spotCfg.allowedType);

    if (candidates.length === 0) return this.fail(spot, '本月此处暂无可邂逅的朝臣');

    // 加权抽取一位作为本次邂逅对象
    const chosen = this.weightedPick(candidates, 1, spot)[0];

    // 写入运行时数据：首次邂逅用配置的初始好感
    const rt = this.save.ministers[chosen.id] ?? createMinisterRuntime(chosen.id, chosen.initialAffection);
    rt.met = true;
    this.save.ministers[chosen.id] = rt;

    this.persist();
    gameEvents.emit(GameEvent.MINISTER_MET, { id: chosen.id, name: chosen.name, spot });
    return { ok: true, spot, minister: chosen, candidates };
  }

  /** 取某点位本月缓存的朝臣配置（UI 展示"本月此处的朝臣"） */
  getCachedMinisters(spot: EncounterSpot): MinisterConfig[] {
    const ids = this.save.encounterCache[spot] ?? [];
    return ids.map((id) => MINISTER_CONFIGS.find((m) => m.id === id)).filter((m): m is MinisterConfig => !!m);
  }

  /** 构建某点位的候选池：类别过滤 + 品级门槛 + 点位偏好 */
  private buildSpotPool(
    spot: EncounterSpot,
    allowedType: MinisterConfig['type'] | null,
    threshold: OfficialGrade,
    favoredMinGrade: number
  ): MinisterConfig[] {
    // 先按"类别 + 职级品级门槛"过滤（硬性条件）
    const base = MINISTER_CONFIGS.filter((m) => {
      if (allowedType && m.type !== allowedType) return false;
      if (m.grade < threshold) return false; // 品级过高（数字更小）未解锁
      return true;
    });
    // 再应用点位品级偏好；偏好过滤后为空则回退到完整 base
    const preferred = base.filter((m) => m.grade >= favoredMinGrade || spot === EncounterSpot.BANQUET);
    return preferred.length > 0 ? preferred : base;
  }

  /** 品级加权抽取不重复候选；宫宴点位对高阶朝臣（数字小）额外加权 */
  private weightedPick(pool: MinisterConfig[], count: number, spot?: EncounterSpot): MinisterConfig[] {
    const remaining = [...pool];
    const picked: MinisterConfig[] = [];
    while (picked.length < count && remaining.length > 0) {
      const weights = remaining.map((m) => {
        let w = GRADE_ENCOUNTER_WEIGHT[m.grade];
        if (spot === EncounterSpot.BANQUET && m.grade <= OfficialGrade.PIN_4) {
          w *= BANQUET_HIGH_GRADE_BOOST; // 宫宴抬高高阶朝臣出现率
        }
        return w;
      });
      const total = weights.reduce((a, b) => a + b, 0);
      let roll = this.random() * total;
      let idx = 0;
      for (let i = 0; i < remaining.length; i++) {
        roll -= weights[i];
        if (roll <= 0) { idx = i; break; }
      }
      picked.push(remaining[idx]);
      remaining.splice(idx, 1);
    }
    return picked;
  }

  private currentSpotCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const cfg of ENCOUNTER_SPOT_CONFIGS) {
      counts[cfg.id] = (this.save.encounterCache[cfg.id] ?? []).length;
    }
    return counts;
  }

  private now(): { year: number; month: number } {
    return { year: this.save.time.year, month: this.save.time.month };
  }

  private fail(spot: EncounterSpot, reason: string): EncounterResult {
    return { ok: false, reason, spot, minister: null, candidates: [] };
  }
}
