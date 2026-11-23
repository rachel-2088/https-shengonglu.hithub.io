/**
 * 子嗣生育与培养系统 —— 妃嫔线贵人及以上专属
 * 覆盖：权限锁（仅妃嫔线且位分≥贵人）/ 受孕概率判定（复用帝宠体质公式）/
 *       怀胎十月每月随机事件（安胎风波·暗算·安稳）/ 体质过低滑胎 / 分娩诞育 /
 *       子嗣四维与健康成长阶段 / 教养方向·请教习 / 子嗣随机事件 /
 *       成年结局预埋（封爵·婚配·朝堂助力）/ 健康过低夭折 / 全量存档持久化。
 * ⚠️ 女官线、宫女线禁用全部入口；宫女转妃嫔后 route=CONSORT 且达贵人方解锁。
 * ⚠️ 剧情文案含蓄（承宠/龙胎/诞下/夭折），避免露骨描写，以微信官方最新规范为准。
 * 所有数值读 config，业务层不硬编码；生育概率公式复用 EmperorInteractionSystem.getPregnancyProbability()。
 */
import {
  ChildAdultOutlook,
  ChildData,
  ChildEventConfig,
  ChildGender,
  ChildHealth,
  ChildGrowthStage,
  ConsortRank,
  EducationFocus,
  EventLogType,
  GameRoute,
  GameSaveData,
  PregnancyEventConfig,
  PregnancyEventType,
} from '../types/types';
import {
  ADULT_OUTCOMES,
  BIRTH_ATTR_RANGE,
  CHILDBIRTH_CONFIG,
  CHILD_EVENTS,
  CHILD_EVENT_TRIGGER,
  CHILD_NAMES,
  EDUCATION_CONFIGS,
  FAVOR_EFFECTS,
  MORTALITY_RULE,
  PREGNANCY_EVENTS,
  TUTOR_CONFIG,
  getAdultOutlook,
  resolveGrowthStage,
  resolveHealthState,
} from '../config/GameConfig';
import {
  addChildAttr,
  addDebuff,
  addSilver,
  applyConsortEffect,
  clearPregnancy,
  createChild,
  removeDebuff,
  updateChild,
  updatePregnancy,
} from '../data/saveData';
import { gameEvents, GameEvent } from '../core/EventBus';
import { EmperorInteractionSystem } from './EmperorInteractionSystem';

export interface ConceiveResult {
  ok: boolean;
  reason?: string;
  /** 是否受孕成功 */
  conceived: boolean;
  /** 本次判定使用的概率 */
  probability: number;
}

export interface PregnancyTickResult {
  ok: boolean;
  reason?: string;
  /** 本月怀胎事件 */
  event: PregnancyEventConfig | null;
  /** 是否滑胎 */
  miscarried: boolean;
  /** 是否足月分娩 */
  delivered: boolean;
  child: ChildData | null;
  /** 当前胎儿健康 */
  fetalHealth: number;
}

export interface EducationResult {
  ok: boolean;
  reason?: string;
  childId: string;
  focus: EducationFocus;
  cost: number;
  deltas: { talent: number; physique: number; mind: number; appearance: number };
}

/** 随机源 */
type Rng = () => number;

export class ChildSystem {
  constructor(
    private save: GameSaveData,
    private persist: () => void = () => {},
    private rng: Rng = Math.random,
    /** 帝宠系统实例（用于复用生育概率公式；不传则本类自建公式） */
    private emperorSys?: EmperorInteractionSystem,
  ) {}

  // ================================================================
  // 一、权限与查询
  // ================================================================

  /** 入口锁：仅妃嫔线可用 */
  private assertAccess(): string | null {
    const route = this.save.character.route;
    if (route === GameRoute.CONSORT) return null;
    if (route === GameRoute.MAID) return '宫女无资格生育，请先寻宠幸转入妃嫔线';
    return '女官线不设子嗣系统';
  }

  /** 是否已解锁子嗣系统（妃嫔线 + 位分≥贵人） */
  isUnlocked(): boolean {
    if (this.save.character.route !== GameRoute.CONSORT) return false;
    const order = Object.values(ConsortRank);
    const cur = order.indexOf(this.save.character.consortRank as ConsortRank);
    const need = order.indexOf(CHILDBIRTH_CONFIG.unlockRank as ConsortRank);
    return cur >= need && need >= 0;
  }

  /** 解锁校验（含原因） */
  private checkUnlock(): string | null {
    const accessErr = this.assertAccess();
    if (accessErr) return accessErr;
    if (!this.isUnlocked()) return '需晋至贵人及以上方可生育子嗣';
    return null;
  }

  /** 当前生育概率（复用帝宠系统公式，未注入时自建同口径公式） */
  getConceptionProbability(): number {
    if (this.emperorSys) return this.emperorSys.getPregnancyProbability();
    const f = FAVOR_EFFECTS;
    const constitution = this.save.character.attributes.constitution ?? 0;
    return Math.min(1, f.pregnancyBase + this.save.character.favor * f.pregnancyPerPoint + constitution * f.pregnancyConstitutionPerPoint);
  }

  /** 在册子嗣（含夭折记录） */
  listChildren(): ChildData[] {
    return this.save.children;
  }

  /** 存活子嗣 */
  listAliveChildren(): ChildData[] {
    return this.save.children.filter((c) => c.isAlive !== false && c.health !== ChildHealth.DECEASED);
  }

  // ================================================================
  // 二、受孕与怀胎
  // ================================================================

  /**
   * 受孕判定（侍寝后调用；本方法只做概率判定与状态写入，不直接扣行动点）。
   * 怀孕中 / 未解锁 / 非妃嫔线会被拦截。
   */
  tryConceive(): ConceiveResult {
    const err = this.checkUnlock();
    if (err) return { ok: false, reason: err, conceived: false, probability: 0 };
    if (this.save.pregnancy.active) return { ok: false, reason: '已有身孕，不可重复受孕', conceived: false, probability: 0 };

    const probability = this.getConceptionProbability();
    if (this.rng() >= probability) {
      return { ok: true, conceived: false, probability };
    }

    // 受孕成功：写入怀孕状态 + 挂"龙胎不稳"DEBUFF
    updatePregnancy(this.save, {
      active: true,
      startDate: { ...this.save.time },
      monthsElapsed: 0,
      durationMonths: CHILDBIRTH_CONFIG.pregnancyMonths,
      fetalHealth: CHILDBIRTH_CONFIG.initialFetalHealth,
      eventHistory: [],
    });
    const db = CHILDBIRTH_CONFIG.pregnancyDebuff;
    addDebuff(this.save, { id: db.id, name: db.name, desc: db.desc, remainMonths: CHILDBIRTH_CONFIG.pregnancyMonths });
    this.log(EventLogType.FAMILY, '龙胎有喜', `承宠之后有孕，需静心养胎十月（概率 ${(probability * 100).toFixed(1)}%）`);
    this.persist();
    gameEvents.emit(GameEvent.CONCEIVED, { probability });
    return { ok: true, conceived: true, probability };
  }

  /**
   * 怀胎月推进（每月跨月后调用一次）。
   * 抽取本月怀胎事件 → 结算胎儿健康与滑胎 → 足月则分娩。
   */
  tickPregnancy(): PregnancyTickResult {
    const err = this.checkUnlock();
    if (err) return { ok: false, reason: err, event: null, miscarried: false, delivered: false, child: null, fetalHealth: 0 };
    if (!this.save.pregnancy.active) {
      return { ok: false, reason: '当前未怀孕', event: null, miscarried: false, delivered: false, child: null, fetalHealth: 0 };
    }

    const preg = this.save.pregnancy;
    const event = this.pickPregnancyEvent();
    let fetalHealth = Math.max(0, Math.min(100, preg.fetalHealth + event.fetalHealthDelta));
    updatePregnancy(this.save, {
      monthsElapsed: preg.monthsElapsed + 1,
      fetalHealth,
      eventHistory: [...preg.eventHistory, event.type],
    });
    if (event.effects) applyConsortEffect(this.save, event.effects);
    this.log(EventLogType.FAMILY, `怀胎·${event.name}`, event.desc);
    gameEvents.emit(GameEvent.PREGNANCY_EVENT, { type: event.type, name: event.name, fetalHealth });

    // 滑胎判定：事件额外概率 + 体质过低额外概率
    const constitution = this.save.character.attributes.constitution ?? 0;
    const lowConstBonus = constitution < CHILDBIRTH_CONFIG.lowConstitutionThreshold ? CHILDBIRTH_CONFIG.miscarriageBaseChance : 0;
    const miscarriageChance = event.miscarriageChance + lowConstBonus;
    if (this.rng() < miscarriageChance || fetalHealth <= 0) {
      clearPregnancy(this.save);
      removeDebuff(this.save, CHILDBIRTH_CONFIG.pregnancyDebuff.id);
      this.log(EventLogType.FAMILY, '龙胎滑落', '胎儿未能保全，你痛失骨肉，需时日调养。');
      this.persist();
      gameEvents.emit(GameEvent.MISCARRIAGE, {});
      return { ok: true, event, miscarried: true, delivered: false, child: null, fetalHealth };
    }

    // 足月分娩
    if (this.save.pregnancy.monthsElapsed >= this.save.pregnancy.durationMonths) {
      const child = this.deliver();
      clearPregnancy(this.save);
      removeDebuff(this.save, CHILDBIRTH_CONFIG.pregnancyDebuff.id);
      return { ok: true, event, miscarried: false, delivered: true, child, fetalHealth };
    }

    this.persist();
    return { ok: true, event, miscarried: false, delivered: false, child: null, fetalHealth };
  }

  /** 按权重抽取怀胎事件 */
  private pickPregnancyEvent(): PregnancyEventConfig {
    const total = PREGNANCY_EVENTS.reduce((sum, e) => sum + e.weight, 0);
    let roll = this.rng() * total;
    for (const e of PREGNANCY_EVENTS) {
      roll -= e.weight;
      if (roll < 0) return e;
    }
    return PREGNANCY_EVENTS[PREGNANCY_EVENTS.length - 1];
  }

  /** 分娩：生成子嗣数据（性别/姓名/四维随机） */
  private deliver(): ChildData {
    const gender: ChildGender = this.rng() < 0.5 ? ChildGender.MALE : ChildGender.FEMALE;
    const namePool = gender === ChildGender.MALE ? CHILD_NAMES.male : CHILD_NAMES.female;
    const name = namePool[Math.floor(this.rng() * namePool.length)];
    const attr = () => Math.round(BIRTH_ATTR_RANGE.min + this.rng() * (BIRTH_ATTR_RANGE.max - BIRTH_ATTR_RANGE.min));
    const child = createChild(
      `child_${this.save.time.year}_${this.save.time.month}_${this.save.children.length}`,
      name, gender,
      { talent: attr(), physique: attr(), mind: attr(), appearance: attr() },
      { ...this.save.time },
    );
    this.save.children.push(child);
    const title = gender === ChildGender.MALE ? '皇子' : '公主';
    this.log(EventLogType.FAMILY, '诞育龙嗣', `${title}${name}平安降生。`);
    this.persist();
    gameEvents.emit(GameEvent.CHILD_BORN, { child });
    return child;
  }

  // ================================================================
  // 三、养育玩法
  // ================================================================

  /** 教养：每月消耗银两，按方向提升子嗣四维 */
  educateChild(childId: string, focus: EducationFocus): EducationResult {
    const err = this.checkUnlock();
    if (err) return { ok: false, reason: err, childId, focus, cost: 0, deltas: this.zeroDeltas() };
    const child = this.save.children.find((c) => c.id === childId);
    if (!child || child.isAlive === false) return { ok: false, reason: '子嗣不存在或已夭折', childId, focus, cost: 0, deltas: this.zeroDeltas() };

    const cfg = EDUCATION_CONFIGS.find((e) => e.focus === focus);
    if (!cfg) return { ok: false, reason: '无效的教养方向', childId, focus, cost: 0, deltas: this.zeroDeltas() };
    const stage = child.growthStage ?? ChildGrowthStage.SWADDLE;
    const stageIdx = Object.values(ChildGrowthStage).indexOf(stage);
    if (stageIdx < cfg.minStageIndex) {
      return { ok: false, reason: `该方向需成长至${resolveGrowthStage(this.growthMinAge(cfg.minStageIndex)).label}方可修习`, childId, focus, cost: 0, deltas: this.zeroDeltas() };
    }
    if (this.save.character.silver < cfg.cost) {
      return { ok: false, reason: '银两不足', childId, focus, cost: cfg.cost, deltas: this.zeroDeltas() };
    }

    addSilver(this.save, -cfg.cost);
    const deltas = { talent: 0, physique: 0, mind: 0, appearance: 0 };
    for (const key of ['talent', 'physique', 'mind', 'appearance'] as const) {
      const gain = cfg.attrGain[key] ?? 0;
      if (gain > 0) deltas[key] = addChildAttr(this.save, childId, key, gain);
    }
    updateChild(this.save, childId, {
      educationCost: (child.educationCost ?? 0) + cfg.cost,
      educationFocus: focus,
    });
    this.log(EventLogType.FAMILY, '教养子嗣', `为${child.name}延请${cfg.name}之教，耗银 ${cfg.cost} 两。`);
    this.persist();
    gameEvents.emit(GameEvent.CHILD_EDUCATED, { childId, focus, cost: cfg.cost, deltas });
    return { ok: true, childId, focus, cost: cfg.cost, deltas };
  }

  /** 请教习：额外四维加成 + 主角威望（帝宠联动） */
  hireTutor(childId: string): EducationResult {
    const err = this.checkUnlock();
    if (err) return { ok: false, reason: err, childId, focus: EducationFocus.LITERARY, cost: 0, deltas: this.zeroDeltas() };
    const child = this.save.children.find((c) => c.id === childId);
    if (!child || child.isAlive === false) return { ok: false, reason: '子嗣不存在或已夭折', childId, focus: EducationFocus.LITERARY, cost: 0, deltas: this.zeroDeltas() };
    if (this.save.character.silver < TUTOR_CONFIG.cost) {
      return { ok: false, reason: '银两不足', childId, focus: EducationFocus.LITERARY, cost: TUTOR_CONFIG.cost, deltas: this.zeroDeltas() };
    }
    addSilver(this.save, -TUTOR_CONFIG.cost);
    const deltas = { talent: 0, physique: 0, mind: 0, appearance: 0 };
    for (const key of ['talent', 'physique', 'mind', 'appearance'] as const) {
      deltas[key] = addChildAttr(this.save, childId, key, TUTOR_CONFIG.attrBonus);
    }
    updateChild(this.save, childId, { educationCost: (child.educationCost ?? 0) + TUTOR_CONFIG.cost });
    addSilver(this.save, 0); // 占位保持接口一致
    this.log(EventLogType.FAMILY, '请教习', `为${child.name}延请名师点拨，四维精进。`);
    this.persist();
    gameEvents.emit(GameEvent.CHILD_EDUCATED, { childId, tutor: true, cost: TUTOR_CONFIG.cost, deltas });
    return { ok: true, childId, focus: child.educationFocus ?? EducationFocus.LITERARY, cost: TUTOR_CONFIG.cost, deltas };
  }

  /**
   * 每月子嗣事件判定（教养后调用一次）：
   * 生病/勤学/闯祸/往来；并做健康状态刷新与夭折判定。
   */
  tickChildEvent(childId: string): ChildEventConfig | null {
    const err = this.checkUnlock();
    if (err) return null;
    const child = this.save.children.find((c) => c.id === childId);
    if (!child || child.isAlive === false) return null;

    let health = this.currentHealth(child);
    // 健康状态刷新
    const state = resolveHealthState(health);
    if (state !== child.health) updateChild(this.save, childId, { health: state });

    // 夭折判定（健康过低）
    if (health < MORTALITY_RULE.criticalHealthThreshold && this.rng() < MORTALITY_RULE.deathChancePerMonth) {
      updateChild(this.save, childId, { isAlive: false, health: ChildHealth.DECEASED });
      this.log(EventLogType.FAMILY, '子嗣夭折', `${child.name}病重不治，撒手人寰。`);
      this.persist();
      gameEvents.emit(GameEvent.CHILD_DIED, { childId, name: child.name });
      return null;
    }

    // 事件触发概率（病弱额外加成）
    const weakBonus = health < CHILD_EVENT_TRIGGER.weakHealthThreshold ? CHILD_EVENT_TRIGGER.weakHealthBonus : 0;
    if (this.rng() >= CHILD_EVENT_TRIGGER.baseChance + weakBonus) return null;

    const candidates = CHILD_EVENTS.filter((e) => (child.age ?? 0) >= e.minAge);
    if (candidates.length === 0) return null;
    const total = candidates.reduce((sum, e) => sum + e.weight, 0);
    let roll = this.rng() * total;
    let picked = candidates[candidates.length - 1];
    for (const e of candidates) {
      roll -= e.weight;
      if (roll < 0) { picked = e; break; }
    }

    health = Math.max(0, Math.min(100, health + picked.healthDelta));
    const patch: Partial<ChildData> = { health: resolveHealthState(health) };
    if (picked.attrGain) {
      for (const key of ['talent', 'physique', 'mind', 'appearance'] as const) {
        const gain = picked.attrGain[key] ?? 0;
        if (gain > 0) addChildAttr(this.save, childId, key, gain);
      }
    }
    updateChild(this.save, childId, patch);
    if (picked.silverDelta) addSilver(this.save, picked.silverDelta);
    const text = picked.desc.replace('{childName}', child.name);
    this.log(EventLogType.FAMILY, `子嗣·${picked.name}`, text);
    this.persist();
    gameEvents.emit(GameEvent.CHILD_EVENT, { childId, type: picked.type, name: picked.name, text });
    return picked;
  }

  // ================================================================
  // 四、成长与成年结局
  // ================================================================

  /** 跨年成长：所有存活子嗣年龄+1，刷新成长阶段；成年时发事件 */
  advanceYear(): ChildData[] {
    const err = this.checkUnlock();
    if (err) return [];
    const grown: ChildData[] = [];
    for (const c of this.save.children) {
      if (c.isAlive === false || c.health === ChildHealth.DECEASED) continue;
      const newAge = (c.age ?? 0) + 1;
      const newStage = resolveGrowthStage(newAge).stage;
      updateChild(this.save, c.id, { age: newAge, growthStage: newStage });
      grown.push(this.save.children.find((x) => x.id === c.id)!);
      if (newStage === ChildGrowthStage.ADULT && c.growthStage !== ChildGrowthStage.ADULT) {
        this.log(EventLogType.FAMILY, '子嗣成年', `${c.name}已成年，前程待定。`);
        gameEvents.emit(GameEvent.CHILD_ADULT, { childId: c.id, name: c.name });
      }
    }
    this.persist();
    return grown;
  }

  /** 子嗣成年结局预判（属性影响封爵/婚配/朝堂助力） */
  getAdultOutlook(childId: string): ChildAdultOutlook | null {
    const c = this.save.children.find((x) => x.id === childId);
    if (!c) return null;
    const score = c.talent + c.physique + c.mind + c.appearance;
    const outcome = getAdultOutlook(score);
    return {
      childId,
      score,
      title: outcome.title,
      marriage: outcome.marriage,
      courtAid: outcome.courtAid,
      prestigeBonus: outcome.prestigeBonus,
    };
  }

  // ================================================================
  // 五、工具
  // ================================================================

  /** 子嗣当前健康值（从健康状态推断一个代表值，供事件判定用） */
  private currentHealth(child: ChildData): number {
    const map: Record<ChildHealth, number> = {
      [ChildHealth.HEALTHY]: 85,
      [ChildHealth.WEAK]: 55,
      [ChildHealth.CRITICAL]: 20,
      [ChildHealth.DECEASED]: 0,
    };
    return map[child.health ?? ChildHealth.HEALTHY];
  }

  /** 成长阶段序号 → 对应最低年龄（用于错误提示文案） */
  private growthMinAge(stageIdx: number): number {
    const stages = Object.values(ChildGrowthStage);
    const stage = stages[Math.min(stageIdx, stages.length - 1)];
    const cfg = resolveGrowthStage(stage === ChildGrowthStage.SWADDLE ? 0 : stage === ChildGrowthStage.TODDLER ? 3 : stage === ChildGrowthStage.YOUTH ? 7 : 16);
    return cfg.minAge;
  }

  private zeroDeltas() {
    return { talent: 0, physique: 0, mind: 0, appearance: 0 };
  }

  private log(type: EventLogType, title: string, detail: string): void {
    this.save.eventLog.unshift({ date: { ...this.save.time }, type, title, detail });
    if (this.save.eventLog.length > 100) this.save.eventLog.length = 100;
  }
}
