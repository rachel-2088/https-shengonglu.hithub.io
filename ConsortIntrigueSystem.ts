/**
 * 嫔妃博弈系统 —— 妃嫔线核心玩法
 * 覆盖：嫔妃NPC池初始化 / 七种关系玩法 / 把柄刺探 / 六类宫斗随机事件 /
 *       低忠心侍从泄密反噬 / 机敏侍从化解 / 事件浮动数值 / 态度查询。
 * ⚠️ 入口锁：仅妃嫔线（含宫女转妃嫔后 route=CONSORT）完整开放；女官线不接触；宫女线仅保留皇帝偶遇入口（见 EmperorInteractionSystem）。
 * 所有数值读 config，业务层不硬编码。
 */
import {
  ConsortNpcConfig,
  ConsortNpcStatus,
  ConsortRelation,
  EventLogType,
  GameRoute,
  GameSaveData,
  IntrigueEventConfig,
  IntrigueEventType,
} from '../types/types';
import {
  CONSORT_ATTITUDE_THRESHOLDS,
  CONSORT_FAVORITE_ITEMS,
  CONSORT_NPC_CONFIGS,
  CONSORT_RELATION_CONFIGS,
  FAVOR_EFFECTS,
  INTRIGUE_EVENT_CONFIGS,
  INTRIGUE_EVENT_FLOAT,
  INTRIGUE_SUCCESS_RULE,
  SERVANT_LEAK_RULE,
  SPY_RULE,
  getConsortNpcConfig,
  getRelationConfig,
} from '../config/GameConfig';
import {
  addConsortAffection,
  applyConsortEffect,
  createConsortRuntime,
  updateConsort,
} from '../data/saveData';
import { gameEvents, GameEvent } from '../core/EventBus';

export interface ConsortView {
  config: ConsortNpcConfig;
  affection: number;
  status: ConsortNpcStatus;
  attitude: string;
  leverageKnown: boolean;
}

export interface RelationResult {
  ok: boolean;
  reason?: string;
  npcId: string;
  relation: ConsortRelation;
  affectionDelta: number;
  newAffection: number;
  spySuccess?: boolean;
}

export interface IntrigueResolution {
  ok: boolean;
  reason?: string;
  event: IntrigueEventConfig | null;
  success: boolean;
  successRate: number;
  /** 机敏侍从自动化解 */
  autoCountered: boolean;
  /** 低忠心侍从泄密反噬 */
  servantLeaked: boolean;
}

export class ConsortIntrigueSystem {
  constructor(
    private save: GameSaveData,
    private persist: () => void = () => {},
    private rng: () => number = Math.random,
  ) {}

  /** 入口锁：仅妃嫔线可用（宫女转妃嫔后 route 会变为 CONSORT） */
  private assertAccess(): string | null {
    const route = this.save.character.route;
    if (route === GameRoute.CONSORT) return null;
    if (route === GameRoute.MAID) return '宫女无资格参与嫔妃博弈，请先寻宠幸转线';
    return '女官线不接触后宫嫔妃博弈';
  }

  /** 懒初始化嫔妃运行时数据（首次调用按配置表生成 8 名固定 NPC） */
  ensureInitialized(): void {
    for (const cfg of CONSORT_NPC_CONFIGS) {
      if (!this.save.consorts[cfg.id]) {
        this.save.consorts[cfg.id] = createConsortRuntime(cfg.id, cfg.initialAffection, cfg.initialStatus);
      }
    }
  }

  /** 嫔妃列表（含态度，供 UI 展示） */
  listConsorts(): ConsortView[] {
    this.ensureInitialized();
    return CONSORT_NPC_CONFIGS.map((cfg) => {
      const rt = this.save.consorts[cfg.id];
      return {
        config: cfg,
        affection: rt.affection,
        status: rt.status,
        attitude: this.getAttitude(cfg.id),
        leverageKnown: rt.leverageKnown,
      };
    });
  }

  /** 查询嫔妃态度（好感区间 + 帝宠过高引发低位嫔妃嫉妒） */
  getAttitude(npcId: string): string {
    const cfg = getConsortNpcConfig(npcId);
    const rt = this.save.consorts[npcId];
    if (!cfg || !rt) return '未知';
    let label = '敌视';
    for (const t of CONSORT_ATTITUDE_THRESHOLDS) {
      if (rt.affection >= t.min) { label = t.label; break; }
    }
    // 帝宠过高：位分低于主角的嫔妃转为嫉妒
    if (this.save.character.favor >= FAVOR_EFFECTS.jealousyThreshold &&
        this.isNpcLowerRank(cfg) && label !== '敌视') {
      return `${label}（因你盛宠而嫉妒）`;
    }
    return label;
  }

  private isNpcLowerRank(cfg: ConsortNpcConfig): boolean {
    // 用配置表中的 rank 名称顺序粗略比较：皇后/皇贵妃/贵妃/妃/嫔/贵人/常在/答应/秀女
    const order = ['xiuNv', 'daYing', 'changZai', 'guiRen', 'pin', 'fei', 'guiFei', 'huangGuiFei', 'huangHou'];
    const selfIdx = order.indexOf(this.save.character.consortRank ?? 'xiuNv');
    const npcIdx = order.indexOf(cfg.rank);
    return selfIdx > npcIdx;
  }

  /**
   * 对嫔妃执行关系玩法（交好/拉拢/疏远/制衡/反击/送礼/刺探）。
   * 送礼时送对喜好物品走 favoriteBonus；刺探按心智概率掌握把柄。
   */
  interact(npcId: string, relation: ConsortRelation, itemId?: string): RelationResult {
    const accessErr = this.assertAccess();
    if (accessErr) return this.blocked(accessErr, npcId, relation);

    this.ensureInitialized();
    const cfg = getConsortNpcConfig(npcId);
    const rt = this.save.consorts[npcId];
    const conf = getRelationConfig(relation);
    if (!cfg || !rt || !conf) return this.blocked('嫔妃或玩法不存在', npcId, relation);

    // 好感增量（配置表）+ 送礼喜好加成
    let delta = conf.affectionDelta;
    if (relation === ConsortRelation.GIFT && itemId) {
      const favorites = CONSORT_FAVORITE_ITEMS[npcId] ?? [];
      if (favorites.includes(itemId)) delta += conf.favoriteBonus ?? 0;
    }
    addConsortAffection(this.save, npcId, delta);
    applyConsortEffect(this.save, conf.effects);

    // 记录次数
    updateConsort(this.save, npcId, {
      relation,
      interactionCount: { ...rt.interactionCount, [relation]: (rt.interactionCount[relation] ?? 0) + 1 },
    });

    // 刺探：按心智判定是否掌握把柄
    let spySuccess: boolean | undefined;
    if (relation === ConsortRelation.SPY && !rt.leverageKnown) {
      const chance = Math.min(
        SPY_RULE.maxChance,
        SPY_RULE.baseChance + this.save.character.attributes.wit * SPY_RULE.witPerPoint,
      );
      spySuccess = this.rng() < chance;
      if (spySuccess) updateConsort(this.save, npcId, { leverageKnown: true });
    }

    const newAffection = this.save.consorts[npcId].affection;
    this.log(EventLogType.EVENT, `对${cfg.name}·${conf.name}`, `好感${delta >= 0 ? '+' : ''}${delta}，当前${newAffection}`);
    gameEvents.emit(GameEvent.CONSORT_RELATION_CHANGED, {
      npcId, relation, affectionDelta: delta, newAffection, spySuccess,
    });
    this.persist();
    return { ok: true, npcId, relation, affectionDelta: delta, newAffection, spySuccess };
  }

  /** 刺探消息快捷入口（等价于 SPY 关系玩法） */
  spy(npcId: string): RelationResult {
    return this.interact(npcId, ConsortRelation.SPY);
  }

  /**
   * 触发一次宫斗随机事件（按权重抽取）。
   * 成功判定 = 基础概率 ± 门槛达标度；机敏侍从可自动化解；低忠心侍从可能泄密反噬。
   */
  triggerRandomEvent(forceType?: IntrigueEventType): IntrigueResolution {
    const accessErr = this.assertAccess();
    if (accessErr) return { ok: false, reason: accessErr, event: null, success: false, successRate: 0, autoCountered: false, servantLeaked: false };

    this.ensureInitialized();
    const event = forceType
      ? INTRIGUE_EVENT_CONFIGS.find((e) => e.type === forceType) ?? null
      : this.pickWeightedEvent();
    if (!event) return { ok: false, reason: '事件池为空', event: null, success: false, successRate: 0, autoCountered: false, servantLeaked: false };

    // 门槛达标度 → 成功率
    const rate = this.successRate(event);
    const ch = this.save.character;

    // 机敏侍从自动化解（陷害/流言类优先判定）
    const cleverServant = this.save.servants.find((s) => s.cleverness >= SERVANT_LEAK_RULE.clevernessAutoCounter);
    let autoCountered = false;
    if (cleverServant && this.rng() < SERVANT_LEAK_RULE.autoCounterChance) autoCountered = true;

    const success = autoCountered || this.rng() < rate;
    applyConsortEffect(this.save, success ? event.success : event.fail);

    // 低忠心侍从泄密反噬（陷害/反制类）
    let servantLeaked = false;
    if ((event.type === IntrigueEventType.FRAME || event.type === IntrigueEventType.COUNTER) &&
        this.save.servants.some((s) => s.loyalty < SERVANT_LEAK_RULE.lowLoyaltyThreshold) &&
        this.rng() < SERVANT_LEAK_RULE.leakBaseChance) {
      servantLeaked = true;
      applyConsortEffect(this.save, { prestige: SERVANT_LEAK_RULE.leakPenalty.prestige, favor: SERVANT_LEAK_RULE.leakPenalty.favor });
    }

    // 事件浮动：在成功/失败基础效果上，按配置区间再叠加一次属性/威望波动
    const float = success ? INTRIGUE_EVENT_FLOAT.good : INTRIGUE_EVENT_FLOAT.bad;
    const roll = (min: number, max: number) => Math.round(min + this.rng() * (max - min));
    const sign = success ? 1 : -1;
    const attrKey = success ? 'wit' : 'social';
    applyConsortEffect(this.save, { attributes: { [attrKey]: sign * roll(float.attr.min, float.attr.max) }, prestige: sign * roll(float.prestige.min, float.prestige.max) });

    this.log(EventLogType.EVENT, event.name, `${success ? '化解/成功' : '受挫/失败'}${autoCountered ? '（侍从化解）' : ''}${servantLeaked ? '（侍从泄密）' : ''}`);
    gameEvents.emit(GameEvent.INTRIGUE_RESOLVED, { event: event.type, success, successRate: rate, autoCountered, servantLeaked });
    this.persist();
    return { ok: true, event, success, successRate: rate, autoCountered, servantLeaked };
  }

  /** 按权重抽取事件 */
  private pickWeightedEvent(): IntrigueEventConfig | null {
    const total = INTRIGUE_EVENT_CONFIGS.reduce((sum, e) => sum + e.weight, 0);
    let roll = this.rng() * total;
    for (const e of INTRIGUE_EVENT_CONFIGS) {
      roll -= e.weight;
      if (roll <= 0) return e;
    }
    return INTRIGUE_EVENT_CONFIGS[INTRIGUE_EVENT_CONFIGS.length - 1] ?? null;
  }

  /** 门槛达标度 → 成功率（算法常数全部来自配置） */
  private successRate(event: IntrigueEventConfig): number {
    const ch = this.save.character;
    let rate = event.baseSuccessRate;
    const th = event.threshold;
    const pairs: [number | undefined, number | undefined][] = [
      [ch.attributes.wit, th.wit],
      [ch.attributes.social, th.social],
      [ch.prestige, th.prestige],
      [ch.favor, th.favor],
    ];
    for (const [val, req] of pairs) {
      if (req == null || val == null) continue;
      if (val < req) rate -= INTRIGUE_SUCCESS_RULE.missPenaltyPerThreshold;
      else rate += Math.min(INTRIGUE_SUCCESS_RULE.exceedBonusCap, (val - req) * INTRIGUE_SUCCESS_RULE.exceedBonusPerPoint);
    }
    return Math.max(INTRIGUE_SUCCESS_RULE.minRate, Math.min(INTRIGUE_SUCCESS_RULE.maxRate, rate));
  }

  /** 使用已掌握的把柄制衡某嫔妃（反击加成，配置化） */
  useLeverage(npcId: string): RelationResult {
    const rt = this.save.consorts[npcId];
    if (!rt?.leverageKnown) return this.blocked('尚未掌握该嫔妃的把柄', npcId, ConsortRelation.COUNTER);
    return this.interact(npcId, ConsortRelation.COUNTER);
  }

  private blocked(reason: string, npcId: string, relation: ConsortRelation): RelationResult {
    return { ok: false, reason, npcId, relation, affectionDelta: 0, newAffection: 0 };
  }

  private log(type: EventLogType, title: string, detail: string): void {
    const { year, month } = this.save.time;
    this.save.eventLog.push({ date: { year, month }, type, title, detail });
  }
}
