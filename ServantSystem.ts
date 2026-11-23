/**
 * 侍从培养系统 —— 三路线通用
 * 覆盖：开局分配/阶位解锁侍从 / 赏赐·调教·打探·历练 / 忠心机制（背叛风险·背离）/
 *       能力联动（机敏化解陷害、能力提升差事、阅历提升情报质量）/ 事件协助反噬判定 /
 *       身份转换继承（数据本就在 save.servants，转换后重算效忠与位分）。
 * ⚠️ 与宫斗系统兼容：沿用 loyalty/cleverness 字段，ConsortIntrigueSystem 的泄密/化解判定不受影响。
 * 所有数值读 config，业务层不硬编码。
 */
import {
  ConsortRank,
  EventLogType,
  GameRoute,
  GameSaveData,
  MaidRank,
  OfficialRank,
  ServantAction,
  ServantAssistResult,
  ServantData,
  ServantSpyReport,
  ServantStatus,
} from '../types/types';
import {
  INITIAL_SERVANTS,
  REWARD_ITEM_BONUS,
  SERVANT_ABILITY_THRESHOLDS,
  SERVANT_ASSIST_EFFECTS,
  SERVANT_CAPACITY,
  SERVANT_LOYALTY_RULES,
  SERVANT_SPY_CONFIG,
  SERVANT_TEMPLATES,
  SERVANT_TRAINING,
  getServantTemplate,
} from '../config/GameConfig';
import {
  addServantAttr,
  createServant,
  normalizeServant,
  syncServantStatus,
  updateServant,
} from '../data/saveData';
import { gameEvents, GameEvent } from '../core/EventBus';

export interface TrainResult {
  ok: boolean;
  reason?: string;
  servantId: string;
  action: ServantAction;
  /** 四维实际变动（用于 UI 展示） */
  deltas: { loyalty: number; cleverness: number; ability: number; experience: number };
  status: ServantStatus;
}

/** 打探/历练/事件联动共用的随机源 */
type Rng = () => number;

export class ServantSystem {
  constructor(
    private save: GameSaveData,
    private persist: () => void = () => {},
    private rng: Rng = Math.random,
  ) {}

  /** 开局分配初始侍从（按路线；已有则不重复分配） */
  ensureInitialServants(): void {
    const route = this.save.character.route;
    const ids = INITIAL_SERVANTS[route] ?? [];
    for (const tplId of ids) {
      if (this.save.servants.some((sv) => sv.id === `init_${tplId}`)) continue;
      const tpl = getServantTemplate(tplId);
      if (!tpl) continue;
      const sv = createServant(
        `init_${tplId}`, tpl.name,
        this.jitterAttrs(tpl.base),
        { role: tpl.role, backstory: tpl.backstory, allegiance: this.save.character.name, servingRank: this.currentRankLabel() },
      );
      this.save.servants.push(sv);
    }
  }

  /** 当前侍从数量上限（按路线阶位） */
  getCapacity(): number {
    const ch = this.save.character;
    let cap = 0;
    if (ch.route === GameRoute.CONSORT) {
      const table = SERVANT_CAPACITY.consort;
      cap = table.find((x) => x.rank === ch.consortRank)?.cap ?? 1;
    } else if (ch.route === GameRoute.OFFICIAL) {
      cap = SERVANT_CAPACITY.official.find((x) => x.rank === ch.officialRank)?.cap ?? 1;
    } else if (ch.route === GameRoute.MAID) {
      cap = SERVANT_CAPACITY.maid.find((x) => x.rank === ch.maidRank)?.cap ?? 0;
    }
    return cap;
  }

  /** 是否还能增养侍从 */
  canRecruit(): boolean {
    return this.save.servants.length < this.getCapacity();
  }

  /** 增养一名侍从（随机模板，四维按区间抖动） */
  recruit(): ServantData | null {
    if (!this.canRecruit()) return null;
    const pool = SERVANT_TEMPLATES;
    if (pool.length === 0) return null;
    const tpl = pool[Math.floor(this.rng() * pool.length)];
    const sv = createServant(
      `sv_${Date.now()}_${Math.floor(this.rng() * 1000)}`, tpl.name,
      this.jitterAttrs(tpl.base),
      { role: tpl.role, backstory: tpl.backstory, allegiance: this.save.character.name, servingRank: this.currentRankLabel() },
    );
    this.save.servants.push(sv);
    this.log(EventLogType.EVENT, '增养侍从', `${tpl.name}（${this.roleLabel(tpl.role)}）入侍`);
    gameEvents.emit(GameEvent.SERVANT_RECRUITED, { servantId: sv.id, name: sv.name });
    this.persist();
    return sv;
  }

  /** 赏赐物品：加忠心（送对物品走配置加成），并同步状态 */
  reward(servantId: string, itemId?: string): TrainResult {
    const sv = this.find(servantId);
    if (!sv) return this.fail(servantId, ServantAction.REWARD, '侍从不存在');
    const cfg = SERVANT_TRAINING;
    let gain = this.roll(cfg.rewardLoyaltyGain.min, cfg.rewardLoyaltyGain.max);
    if (itemId && REWARD_ITEM_BONUS[itemId] != null) gain = REWARD_ITEM_BONUS[itemId];
    const after = addServantAttr(this.save, servantId, 'loyalty', gain);
    const status = syncServantStatus(this.save, servantId, cfg.betrayalThreshold);
    this.log(EventLogType.EVENT, '赏赐侍从', `${sv.name} 忠心+${gain}（当前${after}）`);
    gameEvents.emit(GameEvent.SERVANT_TRAINED, { servantId, action: ServantAction.REWARD, gain });
    this.persist();
    return { ok: true, servantId, action: ServantAction.REWARD, deltas: { loyalty: gain, cleverness: 0, ability: 0, experience: 0 }, status };
  }

  /** 调教：提升能力/阅历，忠心随机小幅波动 */
  train(servantId: string): TrainResult {
    const sv = this.find(servantId);
    if (!sv) return this.fail(servantId, ServantAction.TRAIN, '侍从不存在');
    const cfg = SERVANT_TRAINING;
    const ab = this.roll(cfg.trainAbilityGain.min, cfg.trainAbilityGain.max);
    const ex = this.roll(cfg.trainExperienceGain.min, cfg.trainExperienceGain.max);
    const lo = this.roll(cfg.trainLoyaltyJitter.min, cfg.trainLoyaltyJitter.max);
    addServantAttr(this.save, servantId, 'ability', ab);
    addServantAttr(this.save, servantId, 'experience', ex);
    addServantAttr(this.save, servantId, 'loyalty', lo);
    const status = syncServantStatus(this.save, servantId, cfg.betrayalThreshold);
    updateServant(this.save, servantId, { lastTrainDate: { ...this.save.time } });
    this.log(EventLogType.EVENT, '调教侍从', `${sv.name} 能力+${ab} 阅历+${ex} 忠心${lo >= 0 ? '+' : ''}${lo}`);
    gameEvents.emit(GameEvent.SERVANT_TRAINED, { servantId, action: ServantAction.TRAIN, ability: ab, experience: ex, loyalty: lo });
    this.persist();
    return { ok: true, servantId, action: ServantAction.TRAIN, deltas: { loyalty: lo, cleverness: 0, ability: ab, experience: ex }, status };
  }

  /** 历练：长期提升能力/阅历（每日不耗行动点，由调用方控制节奏） */
  exercise(servantId: string): TrainResult {
    const sv = this.find(servantId);
    if (!sv) return this.fail(servantId, ServantAction.EXERCISE, '侍从不存在');
    const cfg = SERVANT_TRAINING;
    const ab = this.roll(cfg.exerciseAbilityGain.min, cfg.exerciseAbilityGain.max);
    const ex = this.roll(cfg.exerciseExperienceGain.min, cfg.exerciseExperienceGain.max);
    addServantAttr(this.save, servantId, 'ability', ab);
    addServantAttr(this.save, servantId, 'experience', ex);
    const status = syncServantStatus(this.save, servantId, cfg.betrayalThreshold);
    this.log(EventLogType.DUTY, '侍从历练', `${sv.name} 能力+${ab} 阅历+${ex}`);
    gameEvents.emit(GameEvent.SERVANT_TRAINED, { servantId, action: ServantAction.EXERCISE, ability: ab, experience: ex });
    this.persist();
    return { ok: true, servantId, action: ServantAction.EXERCISE, deltas: { loyalty: 0, cleverness: 0, ability: ab, experience: ex }, status };
  }

  /**
   * 派出去打探消息：消耗 1 行动点，机敏/阅历影响成功率与情报质量。
   * ⚠️ 行动点由本系统直接扣减（区别于婚恋模块的"调用方扣"约定），并发 ACTION_CONSUMED 事件。
   */
  sendSpy(servantId: string): ServantSpyReport {
    const sv = this.find(servantId);
    if (!sv) return { ok: false, reason: '侍从不存在', servantId, topic: 'court', text: '', quality: 'low', actionCost: 0 };
    if (sv.status === ServantStatus.ON_LEAVE) return { ok: false, reason: '侍从休假中', servantId, topic: 'court', text: '', quality: 'low', actionCost: 0 };
    if (this.save.time.actionPoints < SERVANT_SPY_CONFIG.actionCost) {
      return { ok: false, reason: '行动点不足', servantId, topic: 'court', text: '', quality: 'low', actionCost: 0 };
    }

    // 扣行动点
    this.save.time.actionPoints -= SERVANT_SPY_CONFIG.actionCost;
    gameEvents.emit(GameEvent.ACTION_CONSUMED, { amount: SERVANT_SPY_CONFIG.actionCost });

    const cfg = SERVANT_SPY_CONFIG;
    const realRate = Math.min(cfg.maxSuccessRate,
      cfg.baseSuccessRate + sv.cleverness * cfg.clevernessPerPoint + sv.experience * cfg.experiencePerPoint);

    if (this.rng() >= realRate) {
      this.log(EventLogType.EVENT, '打探失手', `${sv.name} 空手而归`);
      this.persist();
      return { ok: true, servantId, topic: 'court', text: `${sv.name} 打探未得有价值消息。`, quality: 'low', actionCost: cfg.actionCost };
    }

    const topic = cfg.topics[Math.floor(this.rng() * cfg.topics.length)];
    const text = topic.texts[Math.floor(this.rng() * topic.texts.length)];
    const quality = sv.experience >= cfg.qualityThresholds.high ? 'high'
      : sv.experience >= cfg.qualityThresholds.mid ? 'mid' : 'low';
    updateServant(this.save, servantId, { lastSpyDate: { ...this.save.time } });
    this.log(EventLogType.EVENT, '打探消息', `${sv.name} 回报：${text}`);
    this.persist();
    return { ok: true, servantId, topic: topic.key, text, quality, actionCost: cfg.actionCost };
  }

  /**
   * 事件联动：宫斗陷害/朝臣刺探/宫廷差事/皇帝召见等场景调用。
   * - 机敏≥70 的侍从有概率自动化解（assist）
   * - 背叛风险（忠心<阈值）的侍从有概率泄密/坏事（backfire）
   * 返回效果包，由调用方应用到主角属性/好感/威望等（本系统不改这些数值，保持解耦）。
   */
  resolveAssist(context: 'intrigue' | 'spy' | 'duty' | 'summon' = 'intrigue'): ServantAssistResult {
    const available = this.save.servants.filter((sv) => sv.status !== ServantStatus.ON_LEAVE);
    if (available.length === 0) return { triggered: false, kind: null, servantId: null, effects: {}, reason: '无可用侍从' };
    const cfg = SERVANT_TRAINING;
    const threshold = SERVANT_ABILITY_THRESHOLDS.clevernessAutoCounter;

    // 反噬优先：背叛风险侍从泄密
    const risky = available.find((sv) => sv.loyalty < cfg.betrayalThreshold);
    if (risky && this.rng() < cfg.betrayalRiskChance) {
      const eff = this.backfireEffects(context);
      this.log(EventLogType.EVENT, '侍从反噬', `${risky.name} 忠心不足，暗中坏事`);
      gameEvents.emit(GameEvent.SERVANT_ASSIST, { kind: 'backfire', servantId: risky.id, context });
      this.persist();
      return { triggered: true, kind: 'backfire', servantId: risky.id, effects: eff, reason: `${risky.name} 忠心过低，泄密坏事` };
    }

    // 协助：机敏达标侍从化解
    const clever = available.find((sv) => sv.cleverness >= threshold);
    if (clever && this.rng() < SERVANT_ABILITY_THRESHOLDS.clevernessCounterChance) {
      const eff = this.assistEffects(context, clever);
      this.log(EventLogType.EVENT, '侍从协助', `${clever.name} 机敏过人，助你化解一事`);
      gameEvents.emit(GameEvent.SERVANT_ASSIST, { kind: 'assist', servantId: clever.id, context });
      this.persist();
      return { triggered: true, kind: 'assist', servantId: clever.id, effects: eff, reason: `${clever.name} 机敏化解` };
    }
    return { triggered: false, kind: null, servantId: null, effects: {}, reason: '侍从未触发协助或反噬' };
  }

  /** 忠诚尽责判定：差事成功后可调用，小幅回升忠心 */
  rewardDuty(servantId: string): void {
    addServantAttr(this.save, servantId, 'loyalty', SERVANT_LOYALTY_RULES.dutyLoyaltyGain);
    syncServantStatus(this.save, servantId, SERVANT_TRAINING.betrayalThreshold);
    this.persist();
  }

  /**
   * 身份转换（宫女转妃嫔/女官）后调用：侍从数据本身保留，
   * 仅重算"效忠对象/所属位分"并归一化字段，确保继承不断档。
   */
  onIdentityTransition(): void {
    const rankLabel = this.currentRankLabel();
    this.save.servants = this.save.servants.map((sv) => normalizeServant({
      ...sv,
      allegiance: this.save.character.name,
      servingRank: rankLabel,
    }));
    this.persist();
  }

  /** 背离事件：忠心极低时可能被嫔妃收买离走（返回离走的侍从，未触发返回 null） */
  checkDesertion(): ServantData | null {
    const idx = this.save.servants.findIndex((sv) => sv.loyalty < SERVANT_TRAINING.desertThreshold);
    if (idx < 0) return null;
    const sv = this.save.servants[idx];
    if (this.rng() < SERVANT_LOYALTY_RULES.desertChance) {
      this.save.servants.splice(idx, 1);
      this.log(EventLogType.EVENT, '侍从背离', `${sv.name} 因忠心尽失，被他人收买离去`);
      gameEvents.emit(GameEvent.SERVANT_DESERTED, { servantId: sv.id, name: sv.name });
      this.persist();
      return sv;
    }
    return null;
  }

  // —— 内部工具 ——
  private find(id: string): ServantData | undefined {
    return this.save.servants.find((sv) => sv.id === id);
  }

  private jitterAttrs(base: { loyalty: number; cleverness: number; ability: number; experience: number }) {
    const j = SERVANT_TRAINING.initialAttrJitter;
    const jit = (v: number) => Math.max(0, Math.min(100, v + this.roll(j.min, j.max)));
    return { loyalty: jit(base.loyalty), cleverness: jit(base.cleverness), ability: jit(base.ability), experience: jit(base.experience) };
  }

  private currentRankLabel(): string {
    const ch = this.save.character;
    if (ch.route === GameRoute.CONSORT) return ch.consortRank ?? ConsortRank.XIU_NV;
    if (ch.route === GameRoute.OFFICIAL) return ch.officialRank ?? OfficialRank.NV_SHI;
    return ch.maidRank ?? MaidRank.CU_SHI;
  }

  private roleLabel(role?: string): string {
    return role === 'eunuch' ? '太监' : role === 'steward' ? '掌事' : '宫女';
  }

  private assistEffects(context: string, _sv: ServantData) {
    return this.buildEffect(SERVANT_ASSIST_EFFECTS[context]?.assist ?? {});
  }

  private backfireEffects(context: string) {
    return this.buildEffect(SERVANT_ASSIST_EFFECTS[context]?.backfire ?? {});
  }

  /** 把 {prestige,wit,social,...} 映射为 ConsortEffect（属性名走 attributes） */
  private buildEffect(map: Record<string, number>): import('../types/types').ConsortEffect {
    const ATTR_KEYS = ['wit', 'social', 'ability', 'experience', 'loyalty', 'cleverness'];
    const effect: import('../types/types').ConsortEffect = {};
    const attrs: Record<string, number> = {};
    for (const [k, v] of Object.entries(map)) {
      if (k === 'prestige') effect.prestige = v;
      else if (k === 'favor') effect.favor = v;
      else if (k === 'silver') effect.silver = v;
      else if (ATTR_KEYS.includes(k)) attrs[k] = v;
    }
    if (Object.keys(attrs).length > 0) effect.attributes = attrs;
    return effect;
  }

  private roll(min: number, max: number): number {
    return Math.round(min + this.rng() * (max - min));
  }

  private fail(servantId: string, action: ServantAction, reason: string): TrainResult {
    return { ok: false, reason, servantId, action, deltas: { loyalty: 0, cleverness: 0, ability: 0, experience: 0 }, status: ServantStatus.AVAILABLE };
  }

  private log(type: EventLogType, title: string, detail: string): void {
    const { year, month } = this.save.time;
    this.save.eventLog.push({ date: { year, month }, type, title, detail });
  }
}
