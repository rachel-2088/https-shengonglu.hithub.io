/**
 * 皇帝互动好感系统 —— 妃嫔线核心
 * 覆盖：帝宠六阶段（陌生→独宠）/ 六种互动分支 / 帝宠关联（偶遇/晋升/生育/嫔妃态度）/
 *       高帝宠专属剧情 / 惹怒皇帝（扣宠/降位/禁足DEBUFF）/ 宫女线仅保留轻幸进封入口。
 * ⚠️ 女官线完全不接触帝宠；宫女线只允许 maidEncounter() 返回触发判定，不直接改帝宠/转线。
 * ⚠️ 剧情文案含蓄（侍寝以夜侍/承宠表述），以微信官方最新规范为准。所有数值读 config。
 */
import {
  ConsortRank,
  EmperorFavorStage,
  EmperorInteraction,
  EmperorInteractionConfig,
  EventLogType,
  FamilyOrigin,
  GameRoute,
  GameSaveData,
} from '../types/types';
import {
  CONSORT_RANK_ORDER,
  EMPEROR_EXCLUSIVE_STORIES,
  EMPEROR_FAVOR_STAGES,
  EMPEROR_INTERACTIONS,
  EMPEROR_STAGE_ORDER,
  FAVOR_EFFECTS,
  MAID_IMPERIAL_ENCOUNTER,
  getConsortConfig,
  getEmperorInteractionConfig,
} from '../config/GameConfig';
import {
  addFavor,
  addPrestige,
  applyConsortEffect,
  setFavor,
  setHouseArrest,
  updateEmperor,
} from '../data/saveData';
import { gameEvents, GameEvent } from '../core/EventBus';

export interface EmperorInteractResult {
  ok: boolean;
  reason?: string;
  type: EmperorInteraction | null;
  choiceId: string | null;
  stage: EmperorFavorStage;
  favor: number;
  effectsApplied: boolean;
}

export interface ProvocationResult {
  ok: boolean;
  reason?: string;
  favorLost: number;
  demoted: boolean;
  newRank: ConsortRank | null;
  confined: boolean;
  prestigeLost: number;
}

export interface MaidEncounterResult {
  ok: boolean;
  reason?: string;
  /** 是否触发宠幸 */
  triggered: boolean;
  /** 轻幸 / 进封（宫女线入口，转线由 MaidTransitionSystem 执行） */
  kind: 'light' | 'promotion' | null;
  chance: number;
}

export class EmperorInteractionSystem {
  constructor(
    private save: GameSaveData,
    private persist: () => void = () => {},
    private rng: () => number = Math.random,
  ) {}

  /** 妃嫔线入口锁（宫女转妃嫔后 route=CONSORT） */
  private assertConsortRoute(): string | null {
    if (this.save.character.route === GameRoute.CONSORT) return null;
    if (this.save.character.route === GameRoute.MAID) return '宫女仅可在御花园等处偶遇皇帝，不可主动互动';
    return '女官线不接触帝宠与皇帝互动';
  }

  /** 由帝宠数值推导阶段（复用统一阈值表） */
  getStage(favor: number = this.save.character.favor): EmperorFavorStage {
    for (const t of EMPEROR_FAVOR_STAGES) {
      if (favor >= t.min) return t.stage;
    }
    return EmperorFavorStage.STRANGER;
  }

  /** 帝宠阶段 → 序号（用于互动解锁） */
  stageIndex(stage: EmperorFavorStage): number {
    const idx = EMPEROR_STAGE_ORDER.indexOf(stage);
    return idx < 0 ? 0 : idx;
  }

  /** 检查某互动是否可触发（阶段门槛） */
  canInteract(type: EmperorInteraction): { ok: boolean; reason?: string; config?: EmperorInteractionConfig } {
    const accessErr = this.assertConsortRoute();
    if (accessErr) return { ok: false, reason: accessErr };
    const cfg = getEmperorInteractionConfig(type);
    if (!cfg) return { ok: false, reason: '互动不存在' };
    const cur = this.stageIndex(this.getStage());
    if (cur < cfg.minStageIndex) {
      return { ok: false, reason: `帝宠未达${getStageLabel(EMPEROR_STAGE_ORDER[cfg.minStageIndex])}，无法触发「${cfg.name}」`, config: cfg };
    }
    return { ok: true, config: cfg };
  }

  /**
   * 执行一次皇帝互动（选择分支）。
   * @param choiceId 选项 ID；不传则取该互动第一个选项
   */
  interact(type: EmperorInteraction, choiceId?: string): EmperorInteractResult {
    const check = this.canInteract(type);
    if (!check.ok || !check.config) {
      return { ok: false, reason: check.reason, type: null, choiceId: null, stage: this.getStage(), favor: this.save.character.favor, effectsApplied: false };
    }
    const cfg = check.config;
    const choice = cfg.choices.find((c) => c.id === choiceId) ?? cfg.choices[0];
    applyConsortEffect(this.save, choice.effects);

    const { year, month } = this.save.time;
    updateEmperor(this.save, {
      stage: this.getStage(),
      lastInteractionDate: { year, month },
      lastSummonMonth: type === EmperorInteraction.SUMMON ? `${year}-${month}` : this.save.emperor.lastSummonMonth,
    });
    this.log(EventLogType.EVENT, `皇帝互动·${cfg.name}`, `选择「${choice.label}」`);
    gameEvents.emit(GameEvent.FAVOR_CHANGED, {
      favor: this.save.character.favor,
      stage: this.getStage(),
      reason: 'interaction',
      type,
      choiceId: choice.id,
    });
    this.persist();
    return { ok: true, type, choiceId: choice.id, stage: this.getStage(), favor: this.save.character.favor, effectsApplied: true };
  }

  /** 帝宠 → 皇帝偶遇概率（配置化） */
  getEncounterProbability(): number {
    const f = FAVOR_EFFECTS;
    return Math.min(1, f.encounterBase + this.save.character.favor * f.encounterPerPoint);
  }

  /** 帝宠 → 晋升威望门槛减免（对接晋升系统：实际门槛 = 配置门槛 - 此值） */
  getPrestigeRelief(): number {
    return this.save.character.favor * FAVOR_EFFECTS.prestigeThresholdReliefPerPoint;
  }

  /** 晋升系统接入：某位分在该帝宠下的实际威望门槛（V4修复：减免后保留 prestigeFloorRatio 下限，防低位阶归零） */
  getEffectivePrestigeRequirement(rank: ConsortRank): number {
    const cfg = getConsortConfig(rank);
    if (!cfg) return 0;
    const floor = cfg.prestigeRequired * FAVOR_EFFECTS.prestigeFloorRatio;
    return Math.max(floor, cfg.prestigeRequired - this.getPrestigeRelief());
  }

  /** 帝宠 → 生育概率（8% + 体质/250 + 帝宠/300，上限100%） */
  getPregnancyProbability(): number {
    const f = FAVOR_EFFECTS;
    const constitution = this.save.character.attributes.constitution ?? 0;
    return Math.min(1,
      f.pregnancyBase +
      this.save.character.favor * f.pregnancyPerPoint +
      constitution * f.pregnancyConstitutionPerPoint,
    );
  }

  /** 高帝宠解锁专属剧情入口 */
  getUnlockedExclusiveStories() {
    return EMPEROR_EXCLUSIVE_STORIES.filter((s) => this.save.character.favor >= s.minFavor);
  }

  /** 惹怒皇帝：扣帝宠 / 概率降位 / 禁足DEBUFF / 扣威望 */
  provokeEmperor(reason: string = '龙颜不悦'): ProvocationResult {
    const accessErr = this.assertConsortRoute();
    if (accessErr) return { ok: false, reason: accessErr, favorLost: 0, demoted: false, newRank: null, confined: false, prestigeLost: 0 };

    const anger = FAVOR_EFFECTS.anger;
    addFavor(this.save, -anger.favorLoss);
    addPrestige(this.save, -anger.prestigeLoss);

    // 降位判定
    let demoted = false;
    let newRank: ConsortRank | null = this.save.character.consortRank;
    if (this.rng() < anger.demoteChance) {
      const order = CONSORT_RANK_ORDER;
      const idx = order.indexOf(this.save.character.consortRank ?? ConsortRank.XIU_NV);
      if (idx > 0) {
        newRank = order[idx - 1];
        this.save.character.consortRank = newRank;
        demoted = true;
      }
    }

    // 禁足 DEBUFF
    setHouseArrest(this.save, true);
    updateEmperor(this.save, { stage: this.getStage(), angerCount: this.save.emperor.angerCount + 1 });

    this.log(EventLogType.EVENT, '惹怒皇帝', `${reason}，帝宠-${anger.favorLoss}${demoted ? `，降为${getConsortConfig(newRank!)?.name ?? ''}` : ''}，禁足${anger.confinementMonths}月`);
    gameEvents.emit(GameEvent.EMPEROR_PROVOKED, { reason, demoted, newRank, confined: true });
    this.persist();
    return { ok: true, favorLost: anger.favorLoss, demoted, newRank, confined: true, prestigeLost: anger.prestigeLoss };
  }

  /**
   * 宫女偶遇皇帝（宫女线唯一保留入口）。
   * ⚠️ 只返回触发判定与轻幸/进封类型，不改帝宠、不直接转线——
   *    由调用方依据返回的 kind 调用 MaidTransitionSystem.imperialFavorPromotion()。
   */
  maidEncounter(appearance: number, familyOrigin: FamilyOrigin): MaidEncounterResult {
    if (this.save.character.route !== GameRoute.MAID) {
      return { ok: false, reason: '仅宫女线可触发偶遇', triggered: false, kind: null, chance: 0 };
    }
    const cfg = MAID_IMPERIAL_ENCOUNTER;
    const chance = Math.min(1, cfg.baseFavorChance + appearance * cfg.appearancePerPoint);
    const triggered = this.rng() < chance;
    let kind: 'light' | 'promotion' | null = null;
    if (triggered) {
      const canPromote = appearance >= cfg.promotionAppearance &&
        (familyOrigin === FamilyOrigin.OFFICIAL || familyOrigin === FamilyOrigin.NOBLE);
      kind = canPromote ? 'promotion' : 'light';
    }
    gameEvents.emit(GameEvent.MAID_IMPERIAL_ENCOUNTER, { triggered, kind, chance });
    this.persist();
    return { ok: true, triggered, kind, chance };
  }

  private log(type: EventLogType, title: string, detail: string): void {
    const { year, month } = this.save.time;
    this.save.eventLog.push({ date: { year, month }, type, title, detail });
  }
}

/** 取帝宠阶段中文名（配置表命中） */
export function getStageLabel(stage: EmperorFavorStage): string {
  return EMPEROR_FAVOR_STAGES.find((t) => t.stage === stage)?.label ?? '陌生';
}

/** 供外部读取全部互动配置（UI 面板） */
export function listEmperorInteractions(): EmperorInteractionConfig[] {
  return [...EMPEROR_INTERACTIONS];
}
