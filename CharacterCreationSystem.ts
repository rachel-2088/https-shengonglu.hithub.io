/**
 * 开局角色创建系统 —— 开局流程 / 三路线选择 / 随机属性生成（第九轮）
 * ------------------------------------------------------------------
 * 覆盖：
 *   1. 开局流程判断：读存档 → 有存档提示【继续/新开】
 *   2. 三路线选择：秀女 / 宫女 / 女官（简介读配置）
 *   3. 自定义与随机：姓名校验、年龄 14~16、家世五档加权随机、五维按家世区间随机
 *   4. 重刷：免费重刷 1 次（不看广告）+ 激励广告重刷（回调失败不扣次数、不强制）
 *   5. 路线专属初始数据 + 初始侍从四维随机 + 初始 NPC 好感 + 空背包/空子嗣/无 DEBUFF
 *   6. 生成完成后写入手动存档（槽位）+ 自动存档
 * ⚠️ 所有随机区间 / 家世数值 / 体重阈值读配置，业务层零硬编码；随机数可注入便于测试。
 */
import {
  AdSlot,
  BaseAttributes,
  BureauConfig,
  CharacterBuildOptions,
  CharacterDraft,
  ConsortNpcStatus,
  ConsortRank,
  CreationResult,
  FamilyOrigin,
  GameRoute,
  GameSaveData,
  MaidRank,
  NameValidationResult,
  OfficialRank,
  RerollMode,
  RerollResult,
  RouteIntroConfig,
  ServantRole,
  ServantStatus,
  SixBureau,
  StartFlowDecision,
} from '../types/types';
import {
  BUREAU_CONFIGS,
  FAMILY_ATTR_ORDER,
  FAMILY_CONFIGS,
  FAMILY_WEIGHTS,
  INITIAL_NPC_AFFECTION,
  INITIAL_SERVANTS,
  NAME_CONFIG,
  REROLL_CONFIG,
  ROUTE_CONFIGS,
  SERVANT_TRAINING,
  START_AGE_RANGE,
  CONSORT_NPC_CONFIGS,
  MINISTER_CONFIGS,
  getFamilyConfig,
  getOfficialTitle,
  getServantTemplate,
} from '../config/GameConfig';
import {
  createConsortRuntime,
  createMinisterRuntime,
  createNewSave,
  createServant,
  hasSave,
  loadGame,
} from '../data/saveData';
import { SaveManager, AutoSaveReason } from './SaveManager';
import { gameEvents, GameEvent } from '../core/EventBus';

/** 广告观看回调：由上层注入真实的激励广告 SDK 调用；返回 Promise<boolean>（true=完整观看，false=放弃/失败）。 */
export type AdWatchHandler = (slot: AdSlot) => boolean | Promise<boolean>;

export interface CharacterCreationDeps {
  /** 随机数源，默认 Math.random；注入固定值便于边界测试 */
  rng?: () => number;
  /** 激励广告观看回调；未注入时广告重刷不可用（返回失败，不强制） */
  watchAd?: AdWatchHandler;
  /** 存档管理器（用于落盘到槽位 + 自动存档），缺省时内部新建 */
  saveManager?: SaveManager;
}

export class CharacterCreationSystem {
  private rng: () => number;
  private watchAd: AdWatchHandler | null;
  private saveManager: SaveManager;

  constructor(deps: CharacterCreationDeps = {}) {
    this.rng = deps.rng ?? Math.random;
    this.watchAd = deps.watchAd ?? null;
    this.saveManager = deps.saveManager ?? new SaveManager();
  }

  // ================================================================
  // 一、开局流程判断
  // ================================================================

  /** 进入游戏时调用：判断是否有存档，供 UI 展示【继续游戏 / 新开存档】 */
  decideStartFlow(): StartFlowDecision {
    if (!hasSave()) {
      return { hasSave: false, meta: null, hint: '暂无存档，请开始新游戏' };
    }
    const data = loadGame();
    if (!data) {
      // 存档存在但损坏：不提供"继续"，引导新开（由 UI 提示覆盖）
      return { hasSave: false, meta: null, hint: '检测到损坏存档，建议新开存档' };
    }
    return {
      hasSave: true,
      meta: { name: data.character.name, route: data.character.route, year: data.time.year, month: data.time.month },
      hint: '检测到存档，可选择继续游戏或新开存档',
    };
  }

  // ================================================================
  // 二、三路线选择（简介读配置）
  // ================================================================

  /** 三路线简介列表（UI 直接渲染） */
  listRoutes(): RouteIntroConfig[] {
    return ROUTE_CONFIGS;
  }

  getRoute(route: GameRoute): RouteIntroConfig | undefined {
    return ROUTE_CONFIGS.find((r) => r.route === route);
  }

  /** 六局列表（宫女线/女官线供职选择） */
  listBureaus(): BureauConfig[] {
    return BUREAU_CONFIGS;
  }

  // ================================================================
  // 三、姓名校验
  // ================================================================

  /** 姓名校验：长度 + 汉字白名单 + 敏感词（大小写不敏感） */
  validateName(rawName: string): NameValidationResult {
    const name = (rawName ?? '').trim();
    if (name.length < NAME_CONFIG.minLength) {
      return { ok: false, reason: `姓名至少 ${NAME_CONFIG.minLength} 个字` };
    }
    if (name.length > NAME_CONFIG.maxLength) {
      return { ok: false, reason: `姓名最多 ${NAME_CONFIG.maxLength} 个字` };
    }
    // 仅允许汉字与间隔号 ·
    if (!/^[\u4e00-\u9fa5·]+$/.test(name)) {
      return { ok: false, reason: NAME_CONFIG.charHint };
    }
    const lower = name.toLowerCase();
    const hit = NAME_CONFIG.sensitiveWords.find((w) => lower.includes(w.toLowerCase()));
    if (hit) {
      return { ok: false, reason: '姓名含不雅或受限字样，请更换' };
    }
    return { ok: true };
  }

  // ================================================================
  // 四、随机生成（年龄 / 家世 / 属性）
  // ================================================================

  /** [min, max] 闭区间随机整数（注入 rng 保证边界可测） */
  private randInt(min: number, max: number): number {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    if (hi <= lo) return lo;
    return lo + Math.floor(this.rng() * (hi - lo + 1));
  }

  /** 年龄随机 14~16（读配置） */
  rollAge(): number {
    return this.randInt(START_AGE_RANGE.min, START_AGE_RANGE.max);
  }

  /** 家世五档加权随机（读配置权重） */
  rollFamilyOrigin(): FamilyOrigin {
    const entries = FAMILY_CONFIGS.map((c) => ({
      id: c.id,
      w: FAMILY_WEIGHTS[c.id] ?? 0,
    }));
    const total = entries.reduce((s, e) => s + e.w, 0);
    if (total <= 0) return FAMILY_CONFIGS[0].id;
    let pick = this.rng() * total;
    for (const e of entries) {
      pick -= e.w;
      if (pick < 0) return e.id;
    }
    return entries[entries.length - 1].id;
  }

  /** 按家世区间随机生成五大属性（逐项在 [min,max] 内，天然落在 0~100） */
  rollAttributes(familyOrigin: FamilyOrigin): BaseAttributes {
    const cfg = getFamilyConfig(familyOrigin) ?? FAMILY_CONFIGS[0];
    const result: BaseAttributes = { appearance: 0, talent: 0, wit: 0, social: 0, constitution: 0 };
    for (const key of FAMILY_ATTR_ORDER) {
      const range = cfg.attrRanges[key] ?? { min: 0, max: 100 };
      result[key] = this.clampAttr(this.randInt(range.min, range.max));
    }
    return result;
  }

  private clampAttr(v: number): number {
    return Math.max(0, Math.min(100, Math.round(v)));
  }

  /** 生成一份完整草稿（姓名 + 年龄 + 家世 + 属性 + 银两），重刷计数清零 */
  generateDraft(rawName: string): CharacterDraft {
    const name = this.validateName(rawName).ok ? rawName.trim() : NAME_CONFIG.defaultName;
    const familyOrigin = this.rollFamilyOrigin();
    const cfg = getFamilyConfig(familyOrigin) ?? FAMILY_CONFIGS[0];
    return {
      name,
      age: this.rollAge(),
      familyOrigin,
      attributes: this.rollAttributes(familyOrigin),
      silver: cfg.initialSilver,
      freeRerollUsed: 0,
      adRerollUsed: 0,
    };
  }

  // ================================================================
  // 五、重刷（免费 / 广告）
  // ================================================================

  /** 内部：仅重刷随机部分（年龄/家世/属性/银两），姓名保留 */
  private rerollRandomPart(draft: CharacterDraft): CharacterDraft {
    const familyOrigin = this.rollFamilyOrigin();
    const cfg = getFamilyConfig(familyOrigin) ?? FAMILY_CONFIGS[0];
    return {
      ...draft,
      age: this.rollAge(),
      familyOrigin,
      attributes: this.rollAttributes(familyOrigin),
      silver: cfg.initialSilver,
    };
  }

  /** 免费重刷（不看广告）：次数用尽返回失败且不改动草稿 */
  rerollFree(draft: CharacterDraft): RerollResult {
    if (draft.freeRerollUsed >= REROLL_CONFIG.freeRerollCount) {
      return { ok: false, reason: '免费重刷次数已用尽，可观看激励广告再次重刷', mode: RerollMode.FREE };
    }
    const next: CharacterDraft = {
      ...this.rerollRandomPart(draft),
      freeRerollUsed: draft.freeRerollUsed + 1,
    };
    gameEvents.emit(GameEvent.ATTRS_REROLLED, { mode: RerollMode.FREE, draft: next });
    return { ok: true, mode: RerollMode.FREE, draft: next };
  }

  /**
   * 广告重刷：仅在广告回调明确返回 true（完整观看）时才重刷并计数；
   * 未注入回调 / 返回 false / 抛异常 → 一律失败，且不扣次数、不强制改动草稿。
   */
  async rerollByAd(draft: CharacterDraft, slot: AdSlot = AdSlot.REROLL_ATTRS): Promise<RerollResult> {
    if (!this.watchAd) {
      return { ok: false, reason: '激励广告暂不可用，未消耗次数', mode: RerollMode.AD, draft };
    }
    let watched = false;
    try {
      watched = await this.watchAd(slot);
    } catch (_) {
      watched = false;
    }
    if (watched !== true) {
      // 回调失败/放弃：不扣次数、不强制重刷，原样返回草稿供 UI 恢复
      return { ok: false, reason: '未完成观看，未消耗次数', mode: RerollMode.AD, draft };
    }
    const next: CharacterDraft = {
      ...this.rerollRandomPart(draft),
      adRerollUsed: draft.adRerollUsed + 1,
    };
    gameEvents.emit(GameEvent.ATTRS_REROLLED, { mode: RerollMode.AD, draft: next });
    return { ok: true, mode: RerollMode.AD, draft: next };
  }

  // ================================================================
  // 六、生成初始数据（路线权限隔离 + 侍从 + NPC 好感）
  // ================================================================

  /**
   * 由草稿 + 路线生成完整存档（尚未落盘）。
   * 三路线初始数据严格隔离：
   *   秀女=秀女位分 / 帝宠0 / 威望0 / 解锁妃嫔系统
   *   宫女=粗使宫女 / 勤谨0 / 必须选六局 / 解锁宫女差事
   *   女官=女史 / 功勋0 / 声望0 / 必须选六局 / 解锁女官公务+朝臣婚恋（典事后开放）
   */
  buildCharacter(opts: CharacterBuildOptions): CreationResult {
    const { draft, route, bureau } = opts;

    // 宫女线 / 女官线必须选择六局之一
    if (route === GameRoute.MAID || route === GameRoute.OFFICIAL) {
      if (!bureau || !BUREAU_CONFIGS.some((b) => b.bureau === bureau)) {
        return { ok: false, reason: '宫女线/女官线必须选择供职六局之一' };
      }
    }
    const validBureau: SixBureau | null =
      route === GameRoute.CONSORT ? null : (bureau ?? null);

    const save = createNewSave({
      name: draft.name,
      age: draft.age,
      route,
      familyOrigin: draft.familyOrigin,
      attributes: { ...draft.attributes },
      silver: draft.silver,
      bureau: validBureau,
    });

    // 路线阶位（createNewSave 已按路线设初始阶位，这里显式校验隔离，防止脏数据串线）
    this.enforceRouteIsolation(save, route);

    // 女官专属名号（女史 + 六局后缀）
    if (route === GameRoute.OFFICIAL && validBureau) {
      save.character.officialTitle = getOfficialTitle(OfficialRank.NV_SHI, validBureau);
    }

    // 初始侍从（按路线分配模板 + 四维随机）
    this.seedInitialServants(save, route);

    // 初始 NPC 好感（妃嫔线初始化嫔妃池；女官线初始化朝臣池；宫女线不预置好感）
    this.seedInitialNpcAffinity(save, route);

    return { ok: true, save };
  }

  /** 显式清空他路线阶位字段，保证路线权限隔离（宫女线开局不携带其他路线阶位） */
  private enforceRouteIsolation(save: GameSaveData, route: GameRoute): void {
    const c = save.character;
    if (route === GameRoute.CONSORT) {
      c.consortRank = ConsortRank.XIU_NV;
      c.maidRank = null;
      c.officialRank = null;
      c.bureau = null;
    } else if (route === GameRoute.MAID) {
      c.consortRank = null;
      c.maidRank = MaidRank.CU_SHI;
      c.officialRank = null;
    } else if (route === GameRoute.OFFICIAL) {
      c.consortRank = null;
      c.maidRank = null;
      c.officialRank = OfficialRank.NV_SHI;
    }
    // 各路线声望类数值归零（防草稿/迁移脏数据带入）
    c.favor = 0;
    c.prestige = 0;
    c.diligence = 0;
    c.merit = 0;
    c.reputation = 0;
    c.underHouseArrest = false;
    c.activeDebuffs = [];
  }

  /** 按路线分配默认侍从，四维 = 模板基准 ± 配置浮动区间，钳制 0~100 */
  private seedInitialServants(save: GameSaveData, route: GameRoute): void {
    const tplIds = INITIAL_SERVANTS[route] ?? [];
    const jitter = SERVANT_TRAINING.initialAttrJitter;
    save.servants = tplIds.map((tplId, idx) => {
      const tpl = getServantTemplate(tplId);
      if (!tpl) {
        // 配置缺失兜底：不生成侍从而非崩溃，避免卡死开局
        return createServant(`init_${idx}`, '无名侍从', { loyalty: 50, cleverness: 30, ability: 30, experience: 20 });
      }
      return createServant(
        `init_${tplId}_${idx}`,
        tpl.name,
        {
          loyalty: tpl.base.loyalty + this.randInt(jitter.min, jitter.max),
          cleverness: tpl.base.cleverness + this.randInt(jitter.min, jitter.max),
          ability: tpl.base.ability + this.randInt(jitter.min, jitter.max),
          experience: tpl.base.experience + this.randInt(jitter.min, jitter.max),
        },
        {
          role: tpl.role ?? ServantRole.PALACE_MAID,
          servingRank: this.primaryRankName(route),
          status: ServantStatus.AVAILABLE,
          allegiance: save.character.name,
          backstory: tpl.backstory,
        },
      );
    });
  }

  private primaryRankName(route: GameRoute): string {
    if (route === GameRoute.CONSORT) return '秀女';
    if (route === GameRoute.MAID) return '粗使宫女';
    return '女史';
  }

  /** 妃嫔线初始化嫔妃池好感（读 NPC 配置）；女官线初始化朝臣池好感；宫女线留空 */
  private seedInitialNpcAffinity(save: GameSaveData, route: GameRoute): void {
    if (route === GameRoute.CONSORT) {
      save.consorts = {};
      for (const npc of CONSORT_NPC_CONFIGS) {
        save.consorts[npc.id] = createConsortRuntime(
          npc.id,
          npc.initialAffection ?? INITIAL_NPC_AFFECTION.consortFallback,
          npc.initialStatus ?? ConsortNpcStatus.DISFAVORED,
        );
      }
    } else if (route === GameRoute.OFFICIAL) {
      save.ministers = {};
      for (const m of MINISTER_CONFIGS) {
        save.ministers[m.id] = createMinisterRuntime(
          m.id,
          m.initialAffection ?? INITIAL_NPC_AFFECTION.ministerFallback,
        );
      }
    }
    // 宫女线不预置嫔妃/朝臣好感，转线后由各系统懒初始化
  }

  // ================================================================
  // 七、落盘（手动存档 + 自动存档）
  // ================================================================

  /**
   * 生成并落盘：buildCharacter → 写入指定手动槽位 → 自动存档 → 设为当前存档。
   * 返回完整存档引用供 UI 进入主界面。
   */
  createAndPersist(opts: CharacterBuildOptions, slot: number = 1): CreationResult {
    const built = this.buildCharacter(opts);
    if (!built.ok || !built.save) return built;

    const save = built.save;
    this.saveManager.setCurrent(save);

    // 新开存档覆盖旧档：校验目标槽位是否已有存档，UI 已二次确认后才允许覆盖（此处记录被覆盖状态）
    const overwriteInfo = this.saveManager.listSlots().find((s) => s.slot === slot && !s.empty);

    const manual = this.saveManager.saveToSlot(slot);
    if (!manual.ok) {
      return { ok: false, reason: `手动存档失败：${manual.reason ?? ''}` };
    }
    const auto = this.saveManager.autoSave(AutoSaveReason.MANUAL);
    if (!auto.ok) {
      return { ok: false, reason: `自动存档失败：${auto.reason ?? ''}` };
    }

    gameEvents.emit(GameEvent.GAME_CREATED, {
      slot,
      route: save.character.route,
      name: save.character.name,
      overwritten: !!overwriteInfo,
    });
    return { ok: true, save };
  }

  /** 供 UI 在"新开存档"前检查是否覆盖旧档 */
  willOverwrite(slot: number): boolean {
    return this.saveManager.listSlots().some((s) => s.slot === slot && !s.empty);
  }
}
