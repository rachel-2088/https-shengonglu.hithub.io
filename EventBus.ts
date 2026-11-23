/**
 * 轻量事件总线 —— 系统间解耦通信，避免相互 import 造成循环依赖。
 * 纯内存，不落存档。
 */
type Handler = (payload?: any) => void;

export class EventBus {
  private handlers: Map<string, Set<Handler>> = new Map();

  /** 订阅事件，返回取消订阅函数 */
  on(event: string, handler: Handler): () => void {
    let set = this.handlers.get(event);
    if (!set) { set = new Set(); this.handlers.set(event, set); }
    set.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: Handler): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, payload?: any): void {
    this.handlers.get(event)?.forEach((h) => h(payload));
  }

  clear(event?: string): void {
    if (event) this.handlers.delete(event);
    else this.handlers.clear();
  }
}

/** 全局事件名常量（集中管理，避免拼写错误） */
export const GameEvent = {
  ACTION_CONSUMED: 'actionConsumed',
  MONTH_CHANGED: 'monthChanged',
  YEAR_END: 'yearEnd',
  SALARY_GRANTED: 'salaryGranted',
  LOCATION_ENTERED: 'locationEntered',
  MINISTER_MET: 'ministerMet',
  AFFECTION_CHANGED: 'affectionChanged',
  MARRIAGE_CHANGED: 'marriageChanged',
  IDENTITY_TRANSITIONED: 'identityTransitioned',
  STORY_READY: 'storyReady', // 剧情入队完成，通知 UI 取剧本
  CONSORT_RELATION_CHANGED: 'consortRelationChanged', // 嫔妃关系玩法生效
  INTRIGUE_RESOLVED: 'intrigueResolved',             // 宫斗事件结算完成
  FAVOR_CHANGED: 'favorChanged',                     // 帝宠变动
  EMPEROR_PROVOKED: 'emperorProvoked',               // 惹怒皇帝（扣宠/降位/禁足）
  MAID_IMPERIAL_ENCOUNTER: 'maidImperialEncounter',  // 宫女偶遇皇帝（轻幸/进封入口）
  SERVANT_RECRUITED: 'servantRecruited',       // 增养侍从
  SERVANT_TRAINED: 'servantTrained',           // 赏赐/调教/历练
  SERVANT_ASSIST: 'servantAssist',             // 事件联动协助/反噬
  SERVANT_DESERTED: 'servantDeserted',         // 侍从背离离走
  CONCEIVED: 'conceived',                         // 受孕成功
  PREGNANCY_EVENT: 'pregnancyEvent',              // 怀胎期事件（安胎/暗算/安稳）
  MISCARRIAGE: 'miscarriage',                     // 滑胎
  CHILD_BORN: 'childBorn',                        // 诞育（分娩成功）
  CHILD_EDUCATED: 'childEducated',                // 教养/请教习
  CHILD_EVENT: 'childEvent',                      // 子嗣随机事件
  CHILD_DIED: 'childDied',                        // 子嗣夭折
  CHILD_ADULT: 'childAdult',                      // 子嗣成年（结局预埋）
  ITEM_PURCHASED: 'itemPurchased',               // 商店购买道具
  ITEM_USED: 'itemUsed',                         // 使用道具
  ITEM_GIFTED: 'itemGifted',                     // 赠送道具给NPC
  SHOP_REFRESHED: 'shopRefreshed',               // 商店每月刷新货品
  DUTY_REFRESHED: 'dutyRefreshed',               // 差事池每月刷新
  DUTY_ACCEPTED: 'dutyAccepted',                 // 接受差事
  DUTY_COMPLETED: 'dutyCompleted',               // 差事结算完成
  GAME_SAVED: 'gameSaved',                       // 存档写入（自动/手动）
  GAME_LOADED: 'gameLoaded',                     // 读档完成
  GAME_CREATED: 'gameCreated',                   // 新角色创建完成（开局落盘）
  ATTRS_REROLLED: 'attrsRerolled',               // 开局属性重刷完成
  AD_WATCHED: 'adWatched',                       // 激励广告：观看完成或走兜底
  EVENT_RESOLVED: 'eventResolved',               // 事件弹窗选项结算完成
  MONTH_TICKED: 'monthTicked',                   // 月结束编排完成
  UI_REFRESH: 'uiRefresh',                       // 主界面视图模型需刷新
  PROMOTION_READY: 'promotionReady',             // 晋升达成，触发专属剧情弹窗
  YEAR_END_SUMMARY: 'yearEndSummary',           // 年末总结结算完成
  KEY_STORY_READY: 'keyStoryReady',             // 关键剧情弹窗（转线/赐婚/生子/晋升）就绪
} as const;

/** 全局单例 */
export const gameEvents = new EventBus();
