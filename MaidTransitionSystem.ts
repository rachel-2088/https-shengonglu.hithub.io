/**
 * 宫女身份转换数据迁移系统 —— 宫女线转线机制
 * 1) 宠幸进封：宫女 → 妃嫔线（答应/常在），属性/背包/银两/NPC好感全部继承
 * 2) 掌事姑姑考选：宫女 → 女官线（女史），勤谨值按比例折算功勋
 * 迁移原则：资产全继承、身份字段精准重置、朝臣/婚恋数据按新身份初始化。
 */
import {
  ConsortRank,
  EventLogType,
  FamilyOrigin,
  GameRoute,
  GameSaveData,
  MarriageStatus,
  MaidBranch,
  OfficialRank,
  SixBureau,
} from '../types/types';
import {
  FAVOR_PROMOTION_RULE,
  MAID_TRANSITION_RULE,
  getOfficialTitle,
} from '../config/GameConfig';
import { createDefaultMarriage } from '../data/saveData';
import { gameEvents, GameEvent } from '../core/EventBus';

export interface TransitionResult {
  ok: boolean;
  reason?: string;
  fromRoute: GameRoute;
  toRoute: GameRoute;
  /** 进封后的妃嫔位分 / 女官职级 */
  newRank: string;
}

export class MaidTransitionSystem {
  constructor(private save: GameSaveData, private persist: () => void = () => {}) {}

  /** 前置校验：仅宫女线可转 */
  private canTransit(): boolean {
    return this.save.character.route === GameRoute.MAID;
  }

  /**
   * 宠幸进封 → 转入妃嫔线。
   * 进封规则：默认【答应】；容貌≥55 且家世为官宦/世家望族 → 直接【常在】。
   */
  imperialFavorPromotion(): TransitionResult {
    if (!this.canTransit()) {
      return this.fail('仅宫女线可触发宠幸进封');
    }
    const c = this.save.character;
    const isExceptional =
      c.attributes.appearance >= FAVOR_PROMOTION_RULE.exceptionalAppearance &&
      (FAVOR_PROMOTION_RULE.exceptionalFamilies as readonly FamilyOrigin[]).includes(c.familyOrigin);
    const newRank: ConsortRank = isExceptional
      ? FAVOR_PROMOTION_RULE.exceptionalRank
      : FAVOR_PROMOTION_RULE.defaultRank;

    // === 数据迁移：资产全继承 ===
    // attributes / inventory / silver / npcAffinity / ministers 保持不变（天然继承）
    c.favor = Math.min(100, c.favor + MAID_TRANSITION_RULE.favorGainOnImperialFavor);
    c.route = GameRoute.CONSORT;
    c.consortRank = newRank;
    c.maidRank = null;              // 脱离宫女体系
    c.officialRank = null;
    c.maidBranch = MaidBranch.UNDECIDED;
    c.bureau = null;                // 入妃嫔线后不再供职六局

    this.logTransition(`承宠进封，转入妃嫔线·${newRank}`);
    this.persistAndNotify(newRank);
    return { ok: true, fromRoute: GameRoute.MAID, toRoute: GameRoute.CONSORT, newRank };
  }

  /**
   * 掌事姑姑考选 → 转入女官线。
   * 初始职级【女史】，勤谨值按比率折算为功勋，保留原供职六局。
   */
  examinationToOfficial(): TransitionResult {
    if (!this.canTransit()) {
      return this.fail('仅宫女线可参加考选');
    }
    const c = this.save.character;
    const bureau: SixBureau = c.bureau ?? SixBureau.SHANG_GONG;

    // === 数据迁移 ===
    const meritFromDiligence = Math.round(
      c.diligence * MAID_TRANSITION_RULE.diligenceToMeritRatio
    );
    c.merit += meritFromDiligence;
    c.route = GameRoute.OFFICIAL;
    c.officialRank = MAID_TRANSITION_RULE.targetOfficialRank;
    c.officialTitle = getOfficialTitle(c.officialRank, bureau);
    c.bureau = bureau;              // 保留原六局，便于专属名号推导
    c.maidRank = null;
    c.consortRank = null;
    c.maidBranch = MaidBranch.EXAMINATION;
    // 女官线不依附皇帝：帝宠数据清零
    c.favor = 0;

    // 婚恋数据初始化为未婚（女官线才开放朝臣婚恋）
    this.save.marriage = createDefaultMarriage();

    this.logTransition(`考选及第，转入女官线·${c.officialTitle}（勤谨折算功勋+${meritFromDiligence}）`);
    this.persistAndNotify(c.officialRank);
    return { ok: true, fromRoute: GameRoute.MAID, toRoute: GameRoute.OFFICIAL, newRank: c.officialTitle };
  }

  /** 记录分支选择（掌事姑姑二选一） */
  setMaidBranch(branch: MaidBranch): boolean {
    if (!this.canTransit()) return false;
    this.save.character.maidBranch = branch;
    this.persist();
    return true;
  }

  private fail(reason: string): TransitionResult {
    return { ok: false, reason, fromRoute: this.save.character.route, toRoute: this.save.character.route, newRank: '' };
  }

  private logTransition(detail: string): void {
    this.save.eventLog.push({
      date: this.save.time,
      type: EventLogType.PROMOTION,
      title: '身份转换',
      detail,
    });
  }

  private persistAndNotify(newRank: string): void {
    this.persist();
    gameEvents.emit(GameEvent.IDENTITY_TRANSITIONED, {
      toRoute: this.save.character.route,
      newRank,
    });
  }
}
