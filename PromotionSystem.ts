/**
 * 三路线统一晋升系统 —— 补齐全局待办。
 * 每月/关键节点校验各路线晋升条件，满足则晋升 + 发专属剧情弹窗 + 更新阶位 + 解锁系统。
 * ⚠️ 门槛数值全部复用现有 ConsortConfig/MaidConfig/OfficialConfig，本系统不硬编码。
 */
import {
  AttributeKey,
  ConsortRank,
  EventLogType,
  GameRoute,
  GameSaveData,
  MaidRank,
  OfficialRank,
  PromotionResult,
} from '../types/types';
import {
  CONSORT_RANK_CONFIGS,
  CONSORT_RANK_ORDER,
  getConsortConfig,
  getMaidRankConfig,
  getOfficialConfig,
  OFFICIAL_RANK_ORDER,
  PROMOTION_CHECK,
  PROMOTION_RULES,
  PROMOTION_UNLOCKS,
  getOfficialTitle,
} from '../config/GameConfig';
import { MAID_RANK_CONFIGS } from '../config/GameConfig';
import { gameEvents, GameEvent } from '../core/EventBus';
import { DutySystem } from './DutySystem';
import { EmperorInteractionSystem } from './EmperorInteractionSystem';

/** 晋升顺序表（按路线） */
const RANK_ORDER: Record<GameRoute, string[]> = {
  [GameRoute.CONSORT]: CONSORT_RANK_ORDER as string[],
  [GameRoute.MAID]: MAID_RANK_CONFIGS.map((c) => c.rank as string),
  [GameRoute.OFFICIAL]: OFFICIAL_RANK_ORDER as string[],
};

export class PromotionSystem {
  constructor(
    private save: GameSaveData,
    private duty: DutySystem,
    private emperor: EmperorInteractionSystem | null,
    private onChange: () => void = () => {},
  ) {}

  /** 当前阶位 */
  private currentRank(): string | null {
    const c = this.save.character;
    if (c.route === GameRoute.CONSORT) return c.consortRank;
    if (c.route === GameRoute.MAID) return c.maidRank;
    if (c.route === GameRoute.OFFICIAL) return c.officialRank;
    return null;
  }

  /** 下一阶位 */
  private nextRank(): string | null {
    const cur = this.currentRank();
    if (!cur) return null;
    const order = RANK_ORDER[this.save.character.route];
    const idx = order.indexOf(cur);
    return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
  }

  /**
   * 检查并执行晋升（一次最多连升 maxStepsPerCheck 级）。
   * 返回 PromotionResult；promoted=true 表示本次发生了晋升。
   */
  checkAndPromote(): PromotionResult {
    const route = this.save.character.route;
    const from = this.currentRank() ?? '';
    let steps = 0;

    while (steps < PROMOTION_CHECK.maxStepsPerCheck) {
      const next = this.nextRank();
      if (!next) break;
      if (!this.meetsRequirement(next, route)) break;
      this.applyPromotion(next, route);
      steps++;
    }

    if (steps === 0) {
      return { ok: true, promoted: false, reason: '暂未满足晋升条件', fromRank: from, toRank: from, unlocked: '', storyTriggered: false };
    }

    const to = this.currentRank() ?? '';
    const rule = PROMOTION_RULES[route];
    const unlocked = this.unlockDesc(to);
    const story = rule.storyOnPromote;

    this.save.eventLog.push({
      date: { year: this.save.time.year, month: this.save.time.month },
      type: EventLogType.PROMOTION,
      title: `晋升·${to}`,
      detail: `由 ${from} 晋升为 ${to}${unlocked ? '，解锁：' + unlocked : ''}`,
    });
    gameEvents.emit(GameEvent.PROMOTION_READY, { route, from, to, unlocked, story });
    this.onChange();

    return { ok: true, promoted: true, fromRank: from, toRank: to, unlocked, storyTriggered: story };
  }

  /** 判断是否满足某阶位晋升条件（读各路线配置） */
  private meetsRequirement(targetRank: string, route: GameRoute): boolean {
    const c = this.save.character;
    if (route === GameRoute.CONSORT) {
      const cfg = getConsortConfig(targetRank as ConsortRank);
      if (!cfg) return false;
      // 威望门槛（帝宠减免由 EmperorInteractionSystem 提供，若有则用减免后门槛）
      const reqPrestige = this.emperor
        ? this.emperor.getEffectivePrestigeRequirement(targetRank as ConsortRank)
        : cfg.prestigeRequired;
      if (c.prestige < reqPrestige) return false;
      // 帝宠门槛
      if (c.favor < cfg.favorRequired) return false;
      // 属性门槛
      for (const [k, v] of Object.entries(cfg.attrRequired ?? {})) {
        if ((c.attributes[k as AttributeKey] ?? 0) < (v as number)) return false;
      }
      return true;
    }
    if (route === GameRoute.MAID) {
      const cfg = getMaidRankConfig(targetRank as MaidRank);
      if (!cfg) return false;
      return c.diligence >= cfg.diligenceRequired;
    }
    if (route === GameRoute.OFFICIAL) {
      const cfg = getOfficialConfig(targetRank as OfficialRank);
      if (!cfg) return false;
      if (c.merit < cfg.meritRequired || c.reputation < cfg.reputationRequired) return false;
      // 晋升专属差事（配置要求时；若该职级未配差事则跳过校验，防配置遗漏卡死）
      if (PROMOTION_RULES[route].requireDuty
          && this.duty.hasPromotionDuty(targetRank)
          && !this.duty.isPromotionDone(targetRank)) return false;
      return true;
    }
    return false;
  }

  /** 应用晋升（更新阶位字段 + 女官专属名号） */
  private applyPromotion(rank: string, route: GameRoute): void {
    const c = this.save.character;
    if (route === GameRoute.CONSORT) c.consortRank = rank as ConsortRank;
    else if (route === GameRoute.MAID) c.maidRank = rank as MaidRank;
    else if (route === GameRoute.OFFICIAL) {
      c.officialRank = rank as OfficialRank;
      c.officialTitle = getOfficialTitle(rank as OfficialRank, c.bureau ?? null);
    }
  }

  /** 晋升后解锁内容说明（读配置映射，按阶位关键词兜底） */
  private unlockDesc(rank: string): string {
    const keyMap: Record<string, string> = {
      [ConsortRank.GUI_REN]: 'guiRen', [ConsortRank.PIN]: 'pin', [ConsortRank.FEI]: 'fei',
      [ConsortRank.HUANG_GUI_FEI]: 'huangGuiFei', [ConsortRank.HUANG_HOU]: 'huangHou',
      [MaidRank.PU_TONG]: 'puTong', [MaidRank.GUAN_SHI]: 'guanShi', [MaidRank.ZHANG_SHI]: 'zhangShi',
      [OfficialRank.DIAN_SHI]: 'dianShi', [OfficialRank.SI_ZUO]: 'siLi', [OfficialRank.SHANG_GONG]: 'shangGong',
    };
    const key = keyMap[rank];
    return key ? (PROMOTION_UNLOCKS[key] ?? '') : '';
  }

  /** 女官典事是否已解锁朝臣婚恋系统（供 UI 显隐判定） */
  isMinisterSystemUnlocked(): boolean {
    if (this.save.character.route !== GameRoute.OFFICIAL) return false;
    const order = OFFICIAL_RANK_ORDER;
    const idx = order.indexOf(this.save.character.officialRank ?? OfficialRank.NV_SHI);
    const dianIdx = order.indexOf(OfficialRank.DIAN_SHI);
    return idx >= dianIdx && dianIdx >= 0;
  }

  /** 当前阶位是否解锁子嗣（妃嫔贵人以上） */
  isChildSystemUnlocked(): boolean {
    if (this.save.character.route !== GameRoute.CONSORT) return false;
    const order = CONSORT_RANK_ORDER;
    const idx = order.indexOf(this.save.character.consortRank ?? ConsortRank.XIU_NV);
    const guiIdx = order.indexOf(ConsortRank.GUI_REN);
    return idx >= guiIdx && guiIdx >= 0;
  }
}
