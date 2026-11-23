/**
 * 女官婚恋系统 —— 女官线独家（完整升级版）
 * 覆盖：好感六阶段流转 / 四类互动增益 / 好感下降 / 喜好物品加成 /
 *       结婚硬性校验 / 求娶→赐婚流程 / 婚后夫君数据 / 职场助力数值化 / 婚后剧情入口。
 * ⚠️ 入口锁：妃嫔线、宫女线一律不可接触朝臣婚嫁（assertOfficialRoute）。
 * 所有数值读 config，业务层不硬编码。剧情文本由剧情系统消费事件后展示。
 */
import {
  AffectionChangeReason,
  AffectionStage,
  EventLogType,
  GameRoute,
  GameSaveData,
  HusbandInfo,
  MaritalEventType,
  MarriageStatus,
  MinisterInteraction,
  OfficialGrade,
} from '../types/types';
import {
  AFFECTION_DECAY,
  AFFECTION_STAGE_THRESHOLDS,
  CAREER_ASSIST_BY_GRADE,
  FAVORITE_GIFT_BONUS,
  GRADE_YEARLY_REPUTATION_BONUS,
  INTERACTION_AFFECTION_GAIN,
  MARITAL_EVENT_CONFIGS,
  MARRIAGE_CONDITIONS,
  MARRIAGE_LOVE_CONFIG,
  getMinisterConfig,
} from '../config/GameConfig';
import {
  addLoveValue,
  addMinisterAffection,
  recordMinisterInteraction,
  setHusband,
  updateMarriage,
} from '../data/saveData';
import { gameEvents, GameEvent } from '../core/EventBus';

export interface MarriageEligibility { ok: boolean; reasons: string[]; }

export interface InteractionResult {
  ok: boolean;
  reason?: string;
  newAffection: number;
  stage: AffectionStage;
  /** 实际好感变动（含喜好物品加成），可为负 */
  delta: number;
  proposalTriggered: boolean;
}

/** 婚后剧情触发结果 */
export interface MaritalEventResult {
  ok: boolean;
  reason?: string;
  type: MaritalEventType | null;
  name: string;
  loveDelta: number;
}

/** 年末婚后结算（含职场助力数值化） */
export interface AnnualSettlement {
  silverBonus: number;
  reputationBonus: number;
  monthlyMeritBonus: number;
  monthlyReputationBonus: number;
  penaltyExemptPerYear: number;
  promotionDifficultyReduction: number;
  loveFull: boolean;
}

export class MarriageSystem {
  constructor(private save: GameSaveData, private persist: () => void = () => {}) {}

  /** 入口锁：仅女官线可用婚嫁系统 */
  private assertOfficialRoute(): string | null {
    if (this.save.character.route !== GameRoute.OFFICIAL) {
      return '妃嫔线与宫女线礼制限制，不可接触朝臣婚嫁';
    }
    return null;
  }

  /** 由好感数值推导阶段（复用统一阈值表） */
  resolveStage(affection: number): AffectionStage {
    for (const t of AFFECTION_STAGE_THRESHOLDS) {
      if (affection >= t.min) return t.stage;
    }
    return AffectionStage.STRANGER;
  }

  /**
   * 四类互动提升好感。
   * 送礼时若物品在朝臣喜好列表，额外加 FAVORITE_GIFT_BONUS；送错则触发下降。
   * @param itemId 送礼物品 ID（送礼类互动必填）
   */
  interact(ministerId: string, kind: MinisterInteraction, itemId?: string): InteractionResult {
    const routeErr = this.assertOfficialRoute();
    if (routeErr) return this.blocked(routeErr);

    const cfg = getMinisterConfig(ministerId);
    const rt = this.save.ministers[ministerId];
    if (!cfg || !rt || !rt.met) return this.blocked('尚未邂逅该朝臣');

    // 基础增量（配置表）
    let delta = INTERACTION_AFFECTION_GAIN[kind] ?? 0;
    let reason: AffectionChangeReason = 'interaction';

    // 送礼：喜好判定
    if (kind === MinisterInteraction.GIFT && itemId) {
      if (cfg.favoriteItems.includes(itemId)) {
        delta += FAVORITE_GIFT_BONUS;
        reason = 'favoriteGift';
      } else {
        delta -= AFFECTION_DECAY.wrongGift;
        reason = 'penalty';
      }
    }

    addMinisterAffection(this.save, ministerId, delta);
    recordMinisterInteraction(this.save, ministerId, kind);
    this.markInteractedThisMonth(ministerId); // 记录本月已互动，避免月末被自然衰减

    const after = this.save.ministers[ministerId];
    const newStage = this.resolveStage(after.affection);
    after.stage = newStage;

    // 好感满值 & 尚未求娶 → 触发求娶剧情
    let proposal = false;
    if (after.affection >= MARRIAGE_CONDITIONS.requiredAffection && !after.proposalTriggered) {
      after.proposalTriggered = true;
      proposal = true;
      if (this.save.marriage.status === MarriageStatus.SINGLE) {
        updateMarriage(this.save, { status: MarriageStatus.PROPOSED });
      }
      this.log(EventLogType.MARRIAGE, '求娶剧情触发', `${cfg.name} 对你情深相许`);
    }

    this.persist();
    // 携带 proposalTriggered 供剧情消费层识别（求娶剧本入队）
    gameEvents.emit(GameEvent.AFFECTION_CHANGED, { ministerId, delta, reason, affection: after.affection, stage: newStage, proposalTriggered: proposal });
    return { ok: true, newAffection: after.affection, stage: newStage, delta, proposalTriggered: proposal };
  }

  /**
   * 好感下降：统一入口，供各类负向事件调用。
   * @param kind 下降类型：自然衰减 / 朝堂失利 / 剧情丑闻
   */
  applyDecay(ministerId: string, kind: 'noContact' | 'courtMisfire' | 'storyScandal'): InteractionResult {
    const routeErr = this.assertOfficialRoute();
    if (routeErr) return this.blocked(routeErr);
    const rt = this.save.ministers[ministerId];
    if (!rt) return this.blocked('尚无该朝臣的相处记录');

    const penalty = kind === 'noContact'
      ? AFFECTION_DECAY.noContactMonthly
      : kind === 'courtMisfire'
        ? AFFECTION_DECAY.courtMisfire
        : AFFECTION_DECAY.storyScandal;

    addMinisterAffection(this.save, ministerId, -penalty);
    const after = this.save.ministers[ministerId];
    const newStage = this.resolveStage(after.affection);
    after.stage = newStage;
    this.persist();
    gameEvents.emit(GameEvent.AFFECTION_CHANGED, { ministerId, delta: -penalty, reason: 'decay', affection: after.affection, stage: newStage });
    return { ok: true, newAffection: after.affection, stage: newStage, delta: -penalty, proposalTriggered: false };
  }

  /** 每月对"上个月未互动"的已邂逅朝臣施加自然衰减（在跨月后调用） */
  applyMonthlyDecay(): string[] {
    const routeErr = this.assertOfficialRoute();
    if (routeErr) return [];
    const prev = this.lastMonth();
    const decayed: string[] = [];
    for (const [id, rt] of Object.entries(this.save.ministers)) {
      if (!rt.met) continue;
      const interacted = this.save.flags[this.interactKey(id, prev.year, prev.month)] === true;
      if (!interacted && rt.affection > 0) {
        addMinisterAffection(this.save, id, -AFFECTION_DECAY.noContactMonthly);
        rt.stage = this.resolveStage(this.save.ministers[id].affection);
        decayed.push(id);
      }
    }
    if (decayed.length > 0) this.persist();
    return decayed;
  }

  /** 标记本月与某朝臣互动过（存入 flags，避免污染数值型 interactionCount） */
  private markInteractedThisMonth(ministerId: string): void {
    this.save.flags[this.interactKey(ministerId, this.save.time.year, this.save.time.month)] = true;
  }

  private interactKey(id: string, year: number, month: number): string {
    return `intr:${id}:${year}-${month}`;
  }

  private lastMonth(): { year: number; month: number } {
    let year = this.save.time.year;
    let month = this.save.time.month - 1;
    if (month < 1) { month = 12; year -= 1; }
    return { year, month };
  }

  /** 检查结婚四项硬性条件 */
  checkEligibility(ministerId: string): MarriageEligibility {
    const routeErr = this.assertOfficialRoute();
    if (routeErr) return { ok: false, reasons: [routeErr] };
    const reasons: string[] = [];
    const c = this.save.character;
    const rt = this.save.ministers[ministerId];

    if (!c.officialRank || this.rankIndex(c.officialRank) < this.rankIndex(MARRIAGE_CONDITIONS.minOfficialRank)) {
      reasons.push('职级未达【典事】');
    }
    if (!rt || rt.affection < MARRIAGE_CONDITIONS.requiredAffection) {
      reasons.push('朝臣好感未满值');
    }
    if (c.reputation < MARRIAGE_CONDITIONS.minReputation) {
      reasons.push(`声望不足（需≥${MARRIAGE_CONDITIONS.minReputation}）`);
    }
    if (MARRIAGE_CONDITIONS.requireNoDebuff && c.activeDebuffs.length > 0) {
      reasons.push('存在宫廷负面DEBUFF');
    }
    return { ok: reasons.length === 0, reasons };
  }

  /** 触发【皇帝赐婚】：条件满足写入夫君数据、切已婚状态 */
  imperialDecreeMarriage(ministerId: string): MarriageEligibility & { husband: HusbandInfo | null } {
    const elig = this.checkEligibility(ministerId);
    if (!elig.ok) return { ...elig, husband: null };

    const cfg = getMinisterConfig(ministerId)!;
    const husband: HusbandInfo = {
      ministerId: cfg.id,
      name: cfg.name,
      type: cfg.type,
      grade: cfg.grade,
      title: cfg.title,
      marryDate: { year: this.save.time.year, month: this.save.time.month },
      annualSilverBonus: cfg.annualSilverBonus,
      assistEffect: cfg.assistEffect,
    };
    setHusband(this.save, husband);
    const rt = this.save.ministers[ministerId];
    if (rt) rt.imperialMarriageTriggered = true;
    this.save.marriage.loveValue = MARRIAGE_LOVE_CONFIG.initialLove;

    this.log(EventLogType.MARRIAGE, '宫宴赐婚', `奉旨嫁与 ${cfg.title} ${cfg.name}`);
    this.persist();
    gameEvents.emit(GameEvent.MARRIAGE_CHANGED, { status: MarriageStatus.MARRIED, husband });
    return { ok: true, reasons: [], husband };
  }

  /** 婚后：回家与夫君相聚（行动点由调用方扣除），每月限一次 */
  visitHusband(): { ok: boolean; reason?: string } {
    const routeErr = this.assertOfficialRoute();
    if (routeErr) return { ok: false, reason: routeErr };
    if (this.save.marriage.status !== MarriageStatus.MARRIED || !this.save.marriage.husband) {
      return { ok: false, reason: '尚未婚配' };
    }
    const last = this.save.marriage.lastVisitDate;
    if (last && last.year === this.save.time.year && last.month === this.save.time.month) {
      return { ok: false, reason: '本月已回家相聚' };
    }
    addLoveValue(this.save, MARRIAGE_LOVE_CONFIG.visitGain);
    this.save.marriage.lastVisitDate = { year: this.save.time.year, month: this.save.time.month };
    this.persist();
    return { ok: true };
  }

  /** 婚后专属剧情入口：按权重随机触发恩爱/争执/独处/生辰，更新恩爱值 */
  triggerMaritalEvent(forceType?: MaritalEventType): MaritalEventResult {
    const routeErr = this.assertOfficialRoute();
    if (routeErr) return { ok: false, reason: routeErr, type: null, name: '', loveDelta: 0 };
    if (this.save.marriage.status !== MarriageStatus.MARRIED) {
      return { ok: false, reason: '尚未婚配', type: null, name: '', loveDelta: 0 };
    }
    let chosen = forceType
      ? MARITAL_EVENT_CONFIGS.find((e) => e.type === forceType)
      : this.pickEventByWeight();
    if (!chosen) return { ok: false, reason: '无可用剧情', type: null, name: '', loveDelta: 0 };

    addLoveValue(this.save, chosen.loveDelta);
    if (!this.save.marriage.triggeredMaritalEvents.includes(chosen.type)) {
      this.save.marriage.triggeredMaritalEvents.push(chosen.type);
    }
    this.log(EventLogType.MARRIAGE, `婚后剧情·${chosen.name}`, `恩爱值${chosen.loveDelta >= 0 ? '+' : ''}${chosen.loveDelta}`);
    this.persist();
    gameEvents.emit(GameEvent.MARRIAGE_CHANGED, { event: chosen.type, loveDelta: chosen.loveDelta });
    return { ok: true, type: chosen.type, name: chosen.name, loveDelta: chosen.loveDelta };
  }

  private pickEventByWeight() {
    const total = MARITAL_EVENT_CONFIGS.reduce((s, e) => s + e.weight, 0);
    let roll = Math.random() * total;
    for (const e of MARITAL_EVENT_CONFIGS) {
      roll -= e.weight;
      if (roll <= 0) return e;
    }
    return MARITAL_EVENT_CONFIGS[0];
  }

  /** 年末婚后结算：俸禄加成 + 声望 + 职场助力数值（全部读配置表） */
  getAnnualSettlement(): AnnualSettlement {
    const empty: AnnualSettlement = {
      silverBonus: 0, reputationBonus: 0, monthlyMeritBonus: 0,
      monthlyReputationBonus: 0, penaltyExemptPerYear: 0, promotionDifficultyReduction: 0, loveFull: false,
    };
    const husband = this.save.marriage.husband;
    if (!husband || this.save.marriage.status !== MarriageStatus.MARRIED) return empty;

    const grade = husband.grade as OfficialGrade;
    const assist = CAREER_ASSIST_BY_GRADE[grade] ?? empty;
    const loveFull = this.save.marriage.loveValue >= MARRIAGE_LOVE_CONFIG.fullBonusThreshold;
    return {
      silverBonus: husband.annualSilverBonus,
      reputationBonus: GRADE_YEARLY_REPUTATION_BONUS[grade] ?? 0,
      monthlyMeritBonus: assist.monthlyMeritBonus,
      monthlyReputationBonus: assist.monthlyReputationBonus,
      penaltyExemptPerYear: assist.penaltyExemptPerYear,
      promotionDifficultyReduction: assist.promotionDifficultyReduction,
      loveFull,
    };
  }

  // ——— 兼容旧接口：保留 getAnnualBonus 供年末系统既有调用 ———
  getAnnualBonus(): { silver: number; reputation: number; loveFull: boolean } {
    const s = this.getAnnualSettlement();
    return { silver: s.silverBonus, reputation: s.reputationBonus, loveFull: s.loveFull };
  }

  private rankIndex(rank: string): number {
    const order = ['nvShi', 'zhangShi', 'dianShi', 'siZuo', 'siShi', 'siZheng', 'juCheng', 'juZuo', 'shangShu', 'shangGong'];
    return order.indexOf(rank);
  }

  private blocked(reason: string): InteractionResult {
    return { ok: false, reason, newAffection: 0, stage: AffectionStage.STRANGER, delta: 0, proposalTriggered: false };
  }

  private log(type: EventLogType, title: string, detail: string): void {
    this.save.eventLog.push({
      date: { year: this.save.time.year, month: this.save.time.month },
      type, title, detail,
    });
  }
}
