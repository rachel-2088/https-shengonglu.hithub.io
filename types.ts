/**
 * 《深宫录》全局类型定义 types.ts
 * ------------------------------------------------------------------
 * 适用引擎：Cocos Creator 3.x / 微信小游戏 / TypeScript
 * 架构：纯单机、无后端、本地存档；仅激励广告联网
 * 说明：本文件只放"类型与枚举"，不写任何业务逻辑与数值。
 *       所有数值抽离到 config/ 目录的配置表中；所有存档落到 data/saveData.ts。
 * 版本：与 plugin 无关，随项目迭代在此文件顶部登记。
 * CHANGELOG:
 *   v1.0.0  初始全量类型（三路线 + 朝臣 + 婚恋 + 夫君 + 婚后 + 广告点位）
 */

// ==================================================================
// 一、基础标量 / 通用工具类型
// ==================================================================

/** 年月（游戏内时间，非真实时间） */
export interface GameDate {
  /** 第几年，从 1 开始 */
  year: number;
  /** 第几月，1~12 */
  month: number;
}

/** 数值随机区间（配置表通用结构，闭区间 [min, max]） */
export interface NumberRange {
  min: number;
  max: number;
}

/** 属性键值对（通用，key 为属性英文枚举值） */
export type AttributeMap = Partial<Record<AttributeKey, number>>;

/** 通用 KV 标记表，用于剧情 flag、支线解锁、一次性事件等 */
export type FlagMap = Record<string, boolean>;

/** 通用计数字典，如道具数量、朝臣送礼次数 */
export type CountMap = Record<string, number>;

// ==================================================================
// 二、角色基础：属性 / 家世 / 路线
// ==================================================================

/** 五大基础属性 */
export enum AttributeKey {
  APPEARANCE = 'appearance',       // 容貌
  TALENT = 'talent',               // 才情
  WIT = 'wit',                     // 心智
  SOCIAL = 'social',               // 人脉
  CONSTITUTION = 'constitution',   // 体质
}

/** 五大属性的中文展示名（UI 层用，不参与存档计算） */
export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  [AttributeKey.APPEARANCE]: '容貌',
  [AttributeKey.TALENT]: '才情',
  [AttributeKey.WIT]: '心智',
  [AttributeKey.SOCIAL]: '人脉',
  [AttributeKey.CONSTITUTION]: '体质',
};

/** 角色五大属性完整值 */
export interface BaseAttributes {
  appearance: number;
  talent: number;
  wit: number;
  social: number;
  constitution: number;
}

/** 家世出身（开局随机，决定初始属性区间与初始银两） */
export enum FamilyOrigin {
  COMMONER = 'commoner',         // 布衣寒门
  LOW_OFFICIAL = 'lowOfficial',  // 小吏之家
  SCHOLAR = 'scholar',           // 书香门第
  OFFICIAL = 'official',         // 官宦世家
  NOBLE = 'noble',               // 世家望族
}

/** 游戏三大路线 */
export enum GameRoute {
  /** 秀女→妃嫔线：后宫争宠、晋升、子嗣；礼制限制不可婚嫁、不可接触朝臣 */
  CONSORT = 'consort',
  /** 宫女线：六局当差，可被宠幸破格转妃嫔，或考选转女官 */
  MAID = 'maid',
  /** 女官线【独家】：六局事业晋升 + 朝臣婚恋 + 奉旨嫁大臣，唯一可自主婚配 */
  OFFICIAL = 'official',
}

/** 六局（宫女供职机构 / 女官供职机构，尚宫局为女官总部） */
export enum SixBureau {
  SHANG_GONG = 'shangGong',  // 尚宫局
  SHANG_YI = 'shangYi',      // 尚仪局
  SHANG_FU = 'shangFu',      // 尚服局
  SHANG_SHI = 'shangShi',    // 尚食局
  SHANG_QIN = 'shangQin',    // 尚寝局
  SHANG_GONG_WORK = 'shangGongWork', // 尚功局
  HUAN_YI = 'huanYi',        // 浣衣局（底层差事，宫女线专属）
}

// ==================================================================
// 三、三路线各自的阶位枚举
// ==================================================================

/** 妃嫔位分（秀女 → 皇后） */
export enum ConsortRank {
  XIU_NV = 'xiuNv',             // 秀女
  DA_YING = 'daYing',           // 答应
  CHANG_ZAI = 'changZai',       // 常在
  GUI_REN = 'guiRen',           // 贵人（解锁子嗣）
  PIN = 'pin',                  // 嫔
  FEI = 'fei',                  // 妃
  GUI_FEI = 'guiFei',           // 贵妃
  HUANG_GUI_FEI = 'huangGuiFei',// 皇贵妃
  HUANG_HOU = 'huangHou',       // 皇后
}

/** 宫女品级（粗使 → 掌事姑姑） */
export enum MaidRank {
  CU_SHI = 'cuShi',             // 粗使宫女
  PU_TONG = 'puTong',           // 普通宫女
  GUAN_SHI = 'guanShi',         // 管事宫女
  ZHANG_SHI = 'zhangShi',       // 掌事姑姑（二选一分支）
}

/** 女官职级（女史 → 尚宫） */
export enum OfficialRank {
  NV_SHI = 'nvShi',             // 女史
  ZHANG_SHI = 'zhangShi',       // 掌事
  DIAN_SHI = 'dianShi',         // 典事（解锁朝臣 / 婚恋系统）
  SI_ZUO = 'siZuo',             // 司佐
  SI_SHI = 'siShi',             // 司事
  SI_ZHENG = 'siZheng',         // 司正
  JU_CHENG = 'juCheng',         // 局丞
  JU_ZUO = 'juZuo',             // 局佐
  SHANG_SHU = 'shangShu',       // 尚属
  SHANG_GONG = 'shangGong',     // 尚宫
}

/** 掌事姑姑长期分支（宫女线二选一） */
export enum MaidBranch {
  UNDECIDED = 'undecided',          // 未抉择
  SEEK_FAVOR = 'seekFavor',         // 主动承宠 → 转妃嫔线
  EXAMINATION = 'examination',      // 参加考选 → 转女官线
}

// ==================================================================
// 四、皇宫大地图
// ==================================================================

/** 皇宫地点清单（含朝臣邂逅点位） */
export enum PalaceLocation {
  YU_HUA_YUAN = 'yuHuaYuan',        // 御花园：偶遇皇帝/嫔妃/低阶朝臣，宠幸剧情点
  YANG_XIN_DIAN = 'yangXinDian',    // 养心殿：求见皇帝、递交折子、偶遇近臣
  GONG_DIAN = 'gongDian',           // 各宫宫殿：拜访嫔妃 NPC
  LIU_JU_ZHI_FANG = 'liuJuZhiFang', // 六局值房：女官办公、宫女当差
  HUAN_YI_JU = 'huanYiJu',          // 浣衣局：底层差事
  CHU_XIU_GONG = 'chuXiuGong',      // 储秀宫：秀女居所
  LENG_GONG = 'lengGong',           // 冷宫：特殊剧情
  TAI_YI_YUAN = 'taiYiYuan',        // 太医院：调养体质、购药
  KU_FANG = 'kuFang',               // 库房：领月例俸禄
  GONG_MEN = 'gongMen',             // 宫门/宫道：【朝臣高频邂逅点】
  HAN_LIN_YUAN = 'hanLinYuan',      // 翰林院：【文官专属邂逅点】
  YAN_WU_CHANG = 'yanWuChang',      // 演武场：【武官专属邂逅点】
  SELF_ROOM = 'selfRoom',           // 自己居所：休息、整理物品、召见侍从、婚后休憩
}

/** 地点类型（用于邂逅判定） */
export enum LocationType {
  DAILY = 'daily',               // 日常场景
  IMPERIAL = 'imperial',         // 皇帝相关
  CONSORT_SOCIAL = 'consortSocial', // 嫔妃社交
  DUTY = 'duty',                 // 当差/办公
  MINISTER_ENCOUNTER = 'ministerEncounter', // 朝臣邂逅
  REST = 'rest',                 // 休憩
  SPECIAL = 'special',           // 特殊剧情
}

/** 地点静态配置 */
export interface LocationConfig {
  id: PalaceLocation;
  name: string;
  type: LocationType;
  desc: string;
  /** 进入该地点可遇 NPC ID 列表 */
  npcIds: string[];
  /** 该地点可执行的差事 ID 列表 */
  dutyIds: string[];
  /** 该地点可触发的随机事件 ID 列表 */
  eventIds: string[];
  /** 是否为朝臣邂逅点 */
  isMinisterSpot: boolean;
  /** 邂逅的朝臣类别（null 表示文武皆可） */
  ministerTypeFilter: MinisterType | null;
}

// ==================================================================
// 五、朝臣体系（女官线专属）★★
// ==================================================================

/** 朝臣类别 */
export enum MinisterType {
  CIVIL = 'civil',       // 文官
  MILITARY = 'military', // 武官
}

/** 朝臣品级（九品最低 → 一品最高） */
export enum OfficialGrade {
  PIN_9 = 9,
  PIN_8 = 8,
  PIN_7 = 7,
  PIN_6 = 6,
  PIN_5 = 5,
  PIN_4 = 4,
  PIN_3 = 3,
  PIN_2 = 2,
  PIN_1 = 1,
}

/** 好感阶段（0~100 映射；相许触发求娶&赐婚） */
export enum AffectionStage {
  STRANGER = 'stranger',     // 0-20   陌生
  ACQUAINT = 'acquaint',     // 21-40  初识
  ADMIRE = 'admire',         // 41-60  欣赏
  FOND = 'fond',             // 61-80  倾心
  DEEP = 'deep',             // 81-95  情深
  PROMISE = 'promise',       // 96-100 相许
}

/** 与朝臣的互动方式 */
export enum MinisterInteraction {
  GIFT = 'gift',                       // 送礼
  POEM = 'poem',                       // 诗文唱和
  ASSIST = 'assist',                   // 偶遇相助
  COURT_INTERACTION = 'courtInteraction', // 朝堂互动
  GREET = 'greet',                     // 搭讪（兼容旧版）
  HEART_TALK = 'heartTalk',            // 交心（兼容旧版）
}

/** 朝臣邂逅点位（女官线四大点位） */
export enum EncounterSpot {
  GATE = 'gate',               // 宫门/宫道
  HAN_LIN = 'hanLin',          // 翰林院
  YAN_WU_CHANG = 'yanWuChang', // 演武场
  BANQUET = 'banquet',         // 宫宴
}

/** 邂逅场景 */
export enum EncounterScene {
  BANQUET = 'banquet',           // 宫宴
  SACRIFICE = 'sacrifice',       // 祭祀
  COURT_VIEW = 'courtView',      // 朝堂旁观
  GATE = 'gate',                 // 宫门偶遇
  HAN_LIN = 'hanLin',            // 翰林院
  IMPERIAL_STUDY = 'imperialStudy', // 御书房外
  YAN_WU_CHANG = 'yanWuChang',       // 演武场（武官专属）
}

/** 朝臣静态配置（姓名、官职、品级、加成由配置表填充，此处只定结构） */
export interface MinisterConfig {
  id: string;
  name: string;
  type: MinisterType;
  grade: OfficialGrade;
  /** 官职名称，如"六部侍郎""禁军校尉" */
  title: string;
  /** 人物标签描述，如"文官·才情高·官场助力强" */
  tags: string[];
  /** 婚后每年俸禄加成（银两） */
  annualSilverBonus: number;
  /** 职场/宫廷助力效果描述 */
  assistEffect: string;
  /** 邂逅偏好场景（兼容旧版） */
  encounterScenes: EncounterScene[];
  /** 外貌气质（如"清隽儒雅""英气逼人"） */
  appearanceTrait: string;
  /** 初始好感（0~100） */
  initialAffection: number;
  /** 喜好物品 ID 列表（送对了额外加好感） */
  favoriteItems: string[];
  /** 背景人设（身世/轶事，用于剧情展示） */
  backstory: string;
  /** 可邂逅点位（女官线四点位） */
  encounterSpots: EncounterSpot[];
}

/** 朝臣运行时数据（好感度会随存档变化） */
export interface MinisterRuntime {
  id: string;
  /** 当前好感 0~100 */
  affection: number;
  /** 当前好感阶段（由 affection 推导，存档冗余保存便于展示） */
  stage: AffectionStage;
  /** 是否已邂逅过 */
  met: boolean;
  /** 各互动方式累计次数 */
  interactionCount: CountMap;
  /** 是否已触发过求娶剧情 */
  proposalTriggered: boolean;
  /** 是否已触发过赐婚 */
  imperialMarriageTriggered: boolean;
}

// ==================================================================
// 六、婚恋 / 夫君 / 婚后系统（女官线独家）★★
// ==================================================================

/** 婚恋状态机 */
export enum MarriageStatus {
  SINGLE = 'single',                     // 未婚
  COURTING = 'courting',                 // 交往中（高好感未赐婚）
  PROPOSED = 'proposed',                 // 已被求娶，待赐婚
  IMPERIAL_DECREE_PENDING = 'decreePending', // 已赐婚，待完婚剧情
  MARRIED = 'married',                   // 已婚
}

/** 夫君信息（婚后持久保存） */
export interface HusbandInfo {
  /** 关联朝臣静态配置 ID */
  ministerId: string;
  /** 姓名（冗余存储，避免配置表变更导致存档显示异常） */
  name: string;
  type: MinisterType;
  grade: OfficialGrade;
  /** 官职名（成婚时快照） */
  title: string;
  /** 成婚时间（游戏内年月） */
  marryDate: GameDate;
  /** 婚后每年俸禄加成（成婚时快照，随夫君品级） */
  annualSilverBonus: number;
  /** 职场/宫廷助力效果（成婚时快照） */
  assistEffect: string;
}

/** 婚后专属剧情类型 */
export enum MaritalEventType {
  AFFECTIONATE = 'affectionate', // 恩爱
  QUARREL = 'quarrel',           // 争执
  SOLITUDE = 'solitude',         // 独处
  BIRTHDAY = 'birthday',         // 生辰
}

/** 婚后系统状态（存档核心节点之一） */
export interface MarriageState {
  status: MarriageStatus;
  /** 当前夫君，未婚为 null */
  husband: HusbandInfo | null;
  /** 恩爱值 0~100 */
  loveValue: number;
  /** 已婚状态下，每月是否已回家相聚（避免重复领取） */
  lastVisitDate: GameDate | null;
  /** 已触发过的婚后剧情 ID */
  triggeredMaritalEvents: string[];
  /** 夫君替女官摆平职场祸事的累计次数 */
  troublesResolved: number;
}

// ==================================================================
// 七、角色运行时状态（存档核心）
// ==================================================================

/** 角色核心状态 */
export interface CharacterState {
  /** 角色姓名（开局自定义） */
  name: string;
  /** 角色年龄（开局随机 14~16，跨年递增由 TimeSystem 接入） */
  age: number;
  /** 家世出身 */
  familyOrigin: FamilyOrigin;
  /** 所选路线 */
  route: GameRoute;
  /** 五大属性 */
  attributes: BaseAttributes;
  /** 当前银两 */
  silver: number;

  // —— 三路线共用的声望类数值（不同路线各用其中部分）——
  /** 皇帝好感 / 帝宠 0~100（妃嫔线晋升核心之一） */
  favor: number;
  /** 威望值（妃嫔线晋升核心） */
  prestige: number;
  /** 勤谨值（宫女线晋升核心） */
  diligence: number;
  /** 功勋值（女官线晋升核心） */
  merit: number;
  /** 声望值（女官线晋升核心、结婚条件之一） */
  reputation: number;

  // —— 路线阶位 ——
  /** 当前妃嫔位分（妃嫔线有效） */
  consortRank: ConsortRank | null;
  /** 当前宫女品级（宫女线有效） */
  maidRank: MaidRank | null;
  /** 当前女官职级（女官线、宫女转线后有效） */
  officialRank: OfficialRank | null;
  /** 所在六局（宫女线/女官线有效） */
  bureau: SixBureau | null;
  /** 女官同一阶随局不同的专属名号（如"尚宫局掌记"），由配置表推导 */
  officialTitle: string;
  /** 掌事姑姑分支选择（宫女线） */
  maidBranch: MaidBranch;

  /** 是否处于禁足状态（影响妃嫔晋升） */
  underHouseArrest: boolean;
  /** 当前生效的负面 DEBUFF（影响婚嫁硬性条件） */
  activeDebuffs: Debuff[];
}

/** 负面状态 */
export interface Debuff {
  id: string;
  name: string;
  desc: string;
  /** 剩余持续月数，-1 表示永久 */
  remainMonths: number;
}

/** 时间 / 月历 / 行动点状态 */
export interface TimeState {
  year: number;
  month: number;
  /** 本月剩余行动点（上限来自配置，默认 5） */
  actionPoints: number;
  /** 本月行动点上限 */
  actionPointMax: number;
}

/** 背包物品实例 */
export interface InventoryItem {
  /** 关联道具静态配置 ID */
  itemId: string;
  /** 数量 */
  count: number;
}

/** 侍从身份 */
export enum ServantRole {
  PALACE_MAID = 'palaceMaid',  // 宫女
  EUNUCH = 'eunuch',          // 太监
  STEWARD = 'steward',        // 掌事
}

/** 侍从当前状态 */
export enum ServantStatus {
  AVAILABLE = 'available',       // 可用
  ON_LEAVE = 'onLeave',          // 休假
  BETRAYAL_RISK = 'betrayalRisk', // 背叛风险（忠心过低自动进入）
}

/** 侍从培养动作 */
export enum ServantAction {
  REWARD = 'reward',       // 赏赐物品（加忠心）
  TRAIN = 'train',         // 调教（能力/阅历提升，忠心随机波动）
  SPY = 'spy',             // 打探消息（消耗行动点）
  EXERCISE = 'exercise',   // 历练（长期提升能力阅历）
}

/** 侍从数据 */
export interface ServantData {
  id: string;
  name: string;
  /** 忠心 0~100（<30 有概率泄密坏事） */
  loyalty: number;
  /** 机敏 0~100（≥70 可自动化解部分陷害） */
  cleverness: number;
  /** 能力 0~100 */
  ability: number;
  /** 阅历 0~100 */
  experience: number;
  // —— 以下为可选扩展字段，老存档/旧数据缺字段时由工厂与 migrateSave 兜底 ——
  /** 身份（宫女/太监/掌事） */
  role?: ServantRole;
  /** 所属主角位分/职级（字符串，三路线阶位名不同） */
  servingRank?: string;
  /** 当前状态 */
  status?: ServantStatus;
  /** 效忠对象（默认主角姓名） */
  allegiance?: string;
  /** 背景人设 */
  backstory?: string;
  /** 最近一次调教的游戏年月（避免同月重复，可选） */
  lastTrainDate?: GameDate;
  /** 最近一次打探的游戏年月 */
  lastSpyDate?: GameDate;
}

/** 侍从静态配置（开局/招募生成用） */
export interface ServantTemplate {
  id: string;
  name: string;
  role: ServantRole;
  backstory: string;
  /** 四维基准（开局随机在此基础上浮动） */
  base: { loyalty: number; cleverness: number; ability: number; experience: number };
}

/** 侍从打探报告 */
export interface ServantSpyReport {
  ok: boolean;
  reason?: string;
  servantId: string;
  /** 情报主题：朝臣 / 嫔妃 / 宫廷 */
  topic: 'minister' | 'consort' | 'court';
  /** 情报文本（配置模板填充） */
  text: string;
  /** 情报质量（受阅历/机敏影响，high 可得额外信息） */
  quality: 'low' | 'mid' | 'high';
  /** 消耗行动点 */
  actionCost: number;
}

/** 侍从事件联动结果（宫斗/差事/召见等场景调用） */
export interface ServantAssistResult {
  /** 是否触发判定 */
  triggered: boolean;
  /** 协助 or 反噬 */
  kind: 'assist' | 'backfire' | null;
  /** 触发的侍从 ID */
  servantId: string | null;
  /** 效果包（反馈到主角属性/好感/威望等） */
  effects: ConsortEffect;
  reason: string;
}

/** 子嗣数据（仅妃嫔贵人及以上） */
export interface ChildData {
  id: string;
  name: string;
  gender: ChildGender;
  /** 天资 0~100 */
  talent: number;
  /** 体魄 0~100 */
  physique: number;
  /** 心性 0~100 */
  mind: number;
  /** 容貌 0~100 */
  appearance: number;
  /** 出生年月 */
  birthDate: GameDate;
  // —— 以下为可选扩展字段，老存档缺字段时由 normalizeChild 兜底 ——
  /** 年龄（岁，跨年递增） */
  age?: number;
  /** 健康状态 */
  health?: ChildHealth;
  /** 生母 ID（主角 ID 或 NPC 嫔妃 ID；主角亲生为 'self'） */
  motherId?: string;
  /** 累计教养花费（银两） */
  educationCost?: number;
  /** 成长阶段 */
  growthStage?: ChildGrowthStage;
  /** 当前教养方向 */
  educationFocus?: EducationFocus | null;
  /** 是否存活（夭折后置 false） */
  isAlive?: boolean;
}

/** 事件日志条目（用于年末总结、复盘、剧情回溯） */
export interface EventLogEntry {
  date: GameDate;
  type: EventLogType;
  title: string;
  detail: string;
}

/** 事件日志分类 */
export enum EventLogType {
  DUTY = 'duty',           // 差事
  PROMOTION = 'promotion', // 晋升
  ENCOUNTER = 'encounter', // 邂逅
  MARRIAGE = 'marriage',   // 婚恋
  FAMILY = 'family',       // 子嗣
  EVENT = 'event',         // 随机事件
  YEAR_END = 'yearEnd',    // 年末总结
  AD = 'ad',               // 广告触发
}

// ==================================================================
// 八、广告点位（仅 4 个，严禁强制）
// ==================================================================

/** 激励广告点位枚举（唯一 4 个联网入口） */
export enum AdSlot {
  /** 重刷开局属性 */
  REROLL_ATTRS = 'rerollAttrs',
  /** 挽回事件损失 */
  RECOVER_LOSS = 'recoverLoss',
  /** 任务双倍奖励 */
  DOUBLE_REWARD = 'doubleReward',
  /** 解锁隐藏支线 */
  UNLOCK_HIDDEN = 'unlockHidden',
}

/** 广告观看统计（用于存档记录，便于风控与体验分析） */
export interface AdStats {
  /** 各点位观看次数 */
  watchCount: CountMap;
  /** 累计观看次数 */
  totalWatched: number;
  /** 上次观看时间戳（毫秒），用于频控 */
  lastWatchedAt: number;
}

// ==================================================================
// 八·五、剧情剧本与事件消费（女官婚恋剧情文本层）★★
// ==================================================================

/** 剧情类型（婚恋流程 6 类剧本） */
export enum StoryType {
  PROPOSAL = 'proposal',                       // 求娶剧情（好感满值触发）
  IMPERIAL_DECREE = 'imperialDecree',           // 皇帝赐婚剧情（写入夫君时触发）
  MARITAL_AFFECTIONATE = 'maritalAffectionate', // 婚后·恩爱
  MARITAL_QUARREL = 'maritalQuarrel',           // 婚后·争执
  MARITAL_SOLITUDE = 'maritalSolitude',         // 婚后·独处
  MARITAL_BIRTHDAY = 'maritalBirthday',         // 婚后·生辰
}

/** 剧本对话节点 */
export interface StoryStep {
  /** 说话人：npc=朝臣 / self=女官 / narrator=旁白 */
  speaker: 'npc' | 'self' | 'narrator';
  /** 文本，可含 {name}/{title}/{trait}/{selfName} 等变量占位符 */
  text: string;
  /** 情绪/表情标签（UI 用） */
  emotion?: string;
}

/** 剧情选项（求娶剧情的应允/婉拒） */
export interface StoryChoice {
  id: string;
  label: string;
  /** 选择结果：应允 / 婉拒 / 中性 */
  outcome: 'accept' | 'reject' | 'neutral';
}

/** 剧本模板（config 静态定义） */
export interface StoryTemplate {
  id: StoryType;
  title: string;
  steps: StoryStep[];
  choices?: StoryChoice[];
}

/** 剧情实例（运行时 + 存档，带变量填充与播放进度） */
export interface StoryScript {
  /** 实例唯一 ID */
  instanceId: string;
  type: StoryType;
  title: string;
  steps: StoryStep[];
  choices?: StoryChoice[];
  /** 关联朝臣 ID */
  ministerId: string | null;
  /** 触发的游戏年月 */
  triggerDate: GameDate;
  /** 当前播放到第几步（0 起） */
  currentStep: number;
  /** 是否已播放完成 */
  finished: boolean;
}

// ==================================================================
// 八·六、嫔妃博弈与帝宠体系（妃嫔线核心玩法）★★
// ==================================================================

/** 嫔妃派系 */
export enum ConsortFaction {
  EMPRESS = 'empress',     // 皇后党
  GUI_FEI = 'guiFei',      // 贵妃党
  NEUTRAL = 'neutral',     // 中立自保
  IMPERIAL = 'imperial',   // 帝党（依附皇帝）
}

/** 嫔妃当前状态 */
export enum ConsortNpcStatus {
  FAVORED = 'favored',        // 受宠
  DISFAVORED = 'disfavored',  // 失宠
  CONFINED = 'confined',      // 禁足
}

/** 对嫔妃的关系玩法 */
export enum ConsortRelation {
  BEFRIEND = 'befriend',   // 交好
  ALLAY = 'allay',         // 拉拢
  DISTANCE = 'distance',   // 疏远
  BALANCE = 'balance',     // 制衡
  COUNTER = 'counter',     // 反击
  GIFT = 'gift',           // 送礼
  SPY = 'spy',             // 刺探消息
}

/** 宫斗随机事件类型 */
export enum IntrigueEventType {
  FRAME = 'frame',                       // 陷害
  COUNTER = 'counter',                   // 反制
  RUMOR = 'rumor',                       // 流言
  RESCUE = 'rescue',                     // 解围
  ALIGN = 'align',                       // 站队
  BANQUET_JEALOUSY = 'banquetJealousy',  // 宴会上争风吃醋
}

/** 皇帝好感/帝宠阶段（陌生→独宠） */
export enum EmperorFavorStage {
  STRANGER = 'stranger',   // 陌生 0~10
  PLAIN = 'plain',         // 平淡 11~30
  FAVORED = 'favored',     // 青睐 31~50
  PREFERRED = 'preferred', // 偏爱 51~70
  GLORY = 'glory',         // 盛宠 71~90
  EXCLUSIVE = 'exclusive', // 独宠 91~100
}

/** 皇帝互动方式（侍寝采用含蓄命名，剧情文案需避免露骨描写） */
export enum EmperorInteraction {
  SUMMON = 'summon',                 // 随机召见
  NIGHT_ATTENDANCE = 'nightAttendance', // 侍寝（夜侍，文案含蓄处理）
  GARDEN_STROLL = 'gardenStroll',    // 游园
  MIDNIGHT_TALK = 'midnightTalk',    // 深夜谈心
  OFFER_GIFT = 'offerGift',          // 献礼
  BANQUET_PERFORMANCE = 'banquetPerformance', // 宴会表现
}

/** 通用效果包（宫斗/互动统一增减结构，数值均可正可负） */
export interface ConsortEffect {
  /** 五维属性增减（人脉=SOCIAL、心智=WIT 走此字段） */
  attributes?: AttributeMap;
  /** 帝宠增减（改 character.favor） */
  favor?: number;
  /** 威望增减（改 character.prestige） */
  prestige?: number;
  /** 银两增减 */
  silver?: number;
  /** 附加负面状态（成功/失败分支可挂 DEBUFF） */
  debuff?: { id: string; name: string; desc: string; remainMonths: number };
  /** 清除禁足状态 */
  clearHouseArrest?: boolean;
}

/** 嫔妃 NPC 静态配置 */
export interface ConsortNpcConfig {
  id: string;
  name: string;
  /** 位分（用于展示与礼制判断） */
  rank: ConsortRank;
  /** 性格（如"跋扈""温婉""城府深沉"） */
  personality: string;
  /** 派系 */
  faction: ConsortFaction;
  /** 对主角初始好感 0~100 */
  initialAffection: number;
  /** 初始状态 */
  initialStatus: ConsortNpcStatus;
  /** 所持把柄描述（主角刺探成功后可用于制衡） */
  leverage: string;
  /** 背景设定 */
  backstory: string;
}

/** 嫔妃运行时数据（好感/状态/把柄随存档变化） */
export interface ConsortRuntime {
  id: string;
  /** 当前好感 0~100 */
  affection: number;
  /** 当前状态 */
  status: ConsortNpcStatus;
  /** 当前关系倾向（最近一次关系玩法） */
  relation: ConsortRelation | null;
  /** 是否已刺探到把柄 */
  leverageKnown: boolean;
  /** 各关系玩法累计次数 */
  interactionCount: CountMap;
}

/** 皇帝状态（存档节点，帝宠数值本身复用 character.favor） */
export interface EmperorState {
  /** 当前帝宠阶段（由 favor 推导，冗余保存便于展示） */
  stage: EmperorFavorStage;
  /** 最近一次互动的游戏年月 */
  lastInteractionDate: GameDate | null;
  /** 本月是否已召见（避免同月重复） */
  lastSummonMonth: string | null;
  /** 惹怒皇帝累计次数 */
  angerCount: number;
  /** 已解锁的专属剧情 ID */
  unlockedStories: string[];
}

/** 宫斗事件（随机抽取）配置 */
export interface IntrigueEventConfig {
  type: IntrigueEventType;
  name: string;
  desc: string;
  /** 抽取权重 */
  weight: number;
  /** 成功门槛：心智/人脉/威望的最低要求 */
  threshold: { wit?: number; social?: number; prestige?: number; favor?: number };
  /** 成功判定基础概率（0~1，门槛达标后按此概率，另受属性加成） */
  baseSuccessRate: number;
  /** 成功效果 */
  success: ConsortEffect;
  /** 失败效果 */
  fail: ConsortEffect;
}

/** 皇帝互动选项（每个互动 2~3 个分支） */
export interface EmperorChoice {
  id: string;
  label: string;
  /** 选项效果 */
  effects: ConsortEffect;
}

/** 皇帝互动配置 */
export interface EmperorInteractionConfig {
  type: EmperorInteraction;
  name: string;
  desc: string;
  /** 可选分支 */
  choices: EmperorChoice[];
  /** 触发所需最低帝宠阶段序号（0=STRANGER 起） */
  minStageIndex: number;
}

// ==================================================================
// 八·七、子嗣生育与培养体系（妃嫔线专属，贵人及以上）★★
// ==================================================================

/** 子嗣性别 */
export enum ChildGender {
  MALE = 'male',    // 皇子
  FEMALE = 'female',// 公主
}

/** 子嗣成长阶段 */
export enum ChildGrowthStage {
  SWADDLE = 'swaddle', // 襁褓（0~2岁）
  TODDLER = 'toddler', // 幼童（3~6岁）
  YOUTH = 'youth',     // 少年（7~15岁）
  ADULT = 'adult',     // 成年（16岁+，结局预埋）
}

/** 子嗣健康状态 */
export enum ChildHealth {
  HEALTHY = 'healthy',   // 健康
  WEAK = 'weak',         // 虚弱
  CRITICAL = 'critical', // 病危
  DECEASED = 'deceased', // 夭折
}

/** 怀胎期随机事件类型 */
export enum PregnancyEventType {
  CALM_TROUBLE = 'calmTrouble', // 安胎风波
  MALICIOUS = 'malicious',      // 被人暗算
  PEACEFUL = 'peaceful',        // 安稳养胎
}

/** 教养方向 */
export enum EducationFocus {
  LITERARY = 'literary', // 文才（重天资）
  MARTIAL = 'martial',   // 武艺（重体魄）
  VIRTUE = 'virtue',     // 德行（重心性）
  ARTS = 'arts',         // 才艺（重容貌）
}

/** 子嗣随机事件类型 */
export enum ChildEventType {
  ILLNESS = 'illness',   // 生病
  DILIGENT = 'diligent', // 勤学
  MISCHIEF = 'mischief', // 闯祸
  SOCIAL = 'social',     // 与其他皇子公主来往
}

/** 怀孕状态（存档节点） */
export interface PregnancyState {
  /** 是否怀孕中 */
  active: boolean;
  /** 受孕年月 */
  startDate: GameDate | null;
  /** 已怀胎月数 */
  monthsElapsed: number;
  /** 本次怀胎周期（月，受孕时从配置写入） */
  durationMonths: number;
  /** 胎儿健康 0~100（受暗算/安胎风波影响，过低滑胎） */
  fetalHealth: number;
  /** 怀胎期已发生事件记录（防同类型反复触发） */
  eventHistory: string[];
}

/** 子嗣结局预判（成年分支预埋，属性影响封爵/婚配/朝堂助力） */
export interface ChildAdultOutlook {
  childId: string;
  /** 四维总分 */
  score: number;
  /** 封爵预判 */
  title: string;
  /** 婚配预判 */
  marriage: string;
  /** 朝堂助力预判 */
  courtAid: string;
  /** 每年可给主角的威望加成 */
  prestigeBonus: number;
}

// ==================================================================
// 八·八、差事任务与存档槽位体系 ★★
// ==================================================================

/** 差事类别（三路线各自独立） */
export enum DutyCategory {
  MAID_DILIGENCE = 'maidDiligence',   // 宫女勤谨差事
  OFFICIAL_DUTY = 'officialDuty',     // 女官公务差事
  CONSORT_DUTY = 'consortDuty',       // 妃嫔宫廷差事
}

/** 差事奖励（完成发放） */
export interface DutyReward {
  silver?: number;
  /** 五维属性增减 */
  attributes?: AttributeMap;
  /** 勤谨值（宫女线） */
  diligence?: number;
  /** 功勋值（女官线） */
  merit?: number;
  /** 威望值（妃嫔线） */
  prestige?: number;
  /** 声望值（女官/通用） */
  reputation?: number;
  /** 帝宠（妃嫔线） */
  favor?: number;
}

/** 差事配置（静态） */
export interface DutyConfigData {
  id: string;
  name: string;
  desc: string;
  category: DutyCategory;
  /** 最低阶位要求（字符串，按路线不同；null=无门槛） */
  minRank: string | null;
  /** 消耗行动点 */
  actionCost: number;
  /** 完成难度（0~1，越高越易失败） */
  difficulty: number;
  /** 是否需要某道具 */
  requiredItem?: string;
  /** 成功奖励 */
  reward: DutyReward;
  /** 失败惩罚（数值均负） */
  penalty: DutyReward;
  /** 是否为晋升专属差事 */
  isPromotion?: boolean;
  /** 晋升专属：完成后晋至的阶位 */
  promotionTarget?: string;
}

/** 差事运行状态（运行时，存 flags 或独立字段） */
export interface DutyRuntime {
  /** 本月可接差事 ID 列表（每月刷新） */
  availableIds: string[];
  /** 当前进行中的差事 ID（一次一件） */
  activeId: string | null;
  /** 本月已完成差事 ID 列表 */
  completedIds: string[];
  /** 上次刷新的年月 */
  lastRefreshDate: GameDate | null;
}

/** 差事结算结果 */
export interface DutyResult {
  ok: boolean;
  reason?: string;
  dutyId: string;
  success: boolean;
  reward: DutyReward;
  penalty: DutyReward;
  /** 晋升专属完成情况 */
  promotionReady: boolean;
}

/** 存档槽位元信息（用于手动存档 UI 展示，不含完整存档体） */
export interface SaveSlotMeta {
  slot: number;
  /** 是否为空槽 */
  empty: boolean;
  /** 角色名 */
  name: string;
  route: GameRoute;
  /** 游戏内年月 */
  year: number;
  month: number;
  /** 保存时间戳（毫秒） */
  savedAt: number;
  /** 存档格式版本 */
  version: number;
}

/** 存档校验结果 */
export interface SaveValidation {
  valid: boolean;
  /** 错误/警告信息（可多条） */
  messages: string[];
  /** 路线一致性（存档声明路线与数据字段是否匹配） */
  routeConsistent: boolean;
}

// ==================================================================
// 九、存档主结构（saveData.ts 落盘对象）★★
// ==================================================================

/**
 * 完整存档结构。
 * 所有需要持久化的状态都挂在这里，禁止散落在全局变量。
 */
export interface GameSaveData {
  /** 存档格式版本，用于迁移 */
  version: number;
  /** 首次创建时间戳（毫秒） */
  createdAt: number;
  /** 最后更新时间戳（毫秒） */
  updatedAt: number;

  /** 时间系统 */
  time: TimeState;
  /** 角色核心 */
  character: CharacterState;
  /** 背包 */
  inventory: InventoryItem[];
  /** NPC 好感（key=NPC ID） */
  npcAffinity: CountMap;

  /** 朝臣运行时数据池（key=朝臣 ID）—— 女官线婚恋核心 */
  ministers: Record<string, MinisterRuntime>;
  /** 本月各点位可邂逅朝臣 ID 缓存（每月随机刷新） */
  encounterCache: Record<string, string[]>;
  /** 上次刷新邂逅列表的年月 */
  lastEncounterRefresh: GameDate | null;
  /** 待播放 / 播放中的剧情队列（事件消费层写入，UI 取用） */
  storyQueue: StoryScript[];
  /** 嫔妃 NPC 运行时数据池（key=嫔妃 ID）—— 妃嫔线博弈核心 */
  consorts: Record<string, ConsortRuntime>;
  /** 皇帝状态（帝宠数值复用 character.favor）—— 妃嫔线核心 */
  emperor: EmperorState;
  /** 婚恋 / 夫君 / 婚后状态 —— 存档关键新增节点 */
  marriage: MarriageState;

  /** 侍从列表 */
  servants: ServantData[];
  /** 子嗣列表（仅妃嫔） */
  children: ChildData[];
  /** 怀孕状态（妃嫔线贵人以上）—— 怀胎时长/胎儿健康/事件记录 */
  pregnancy: PregnancyState;
  /** 差事任务状态（本月差事池/进行中/已完成） */
  dutyState: DutyRuntime;

  /** 剧情 / 支线 / 一次性事件标记 */
  flags: FlagMap;
  /** 广告观看统计 */
  adStats: AdStats;
  /** 事件日志（可做上限裁剪） */
  eventLog: EventLogEntry[];
}

// ==================================================================
// 十、配置表类型（数值全部抽离，config/ 目录消费这些接口）★★
// ==================================================================

/** 家世配置 */
export interface FamilyConfig {
  id: FamilyOrigin;
  name: string;
  attrRanges: Record<AttributeKey, NumberRange>;
  initialSilver: number;
}

/** 妃嫔晋升 / 俸禄配置 */
export interface ConsortRankConfig {
  rank: ConsortRank;
  name: string;
  /** 威望要求 */
  prestigeRequired: number;
  /** 帝宠要求 */
  favorRequired: number;
  /** 基础属性门槛 */
  attrRequired: AttributeMap;
  /** 每月俸禄（银两） */
  monthlySalary: number;
  /** 解锁内容描述 */
  unlockDesc: string;
}

/** 宫女品级配置 */
export interface MaidRankConfig {
  rank: MaidRank;
  name: string;
  /** 勤谨值要求 */
  diligenceRequired: number;
  /** 每月俸禄 */
  monthlySalary: number;
  /** 解锁分支描述 */
  unlockDesc: string;
}

/** 女官职级配置 */
export interface OfficialRankConfig {
  rank: OfficialRank;
  name: string;
  /** 功勋值要求 */
  meritRequired: number;
  /** 声望要求 */
  reputationRequired: number;
  /** 每月俸禄 */
  monthlySalary: number;
}

/** 同一女官职级随六局不同的专属名号 */
export interface OfficialTitleConfig {
  bureau: SixBureau;
  /** 如"掌记""掌膳""掌设""掌衣""掌籍""掌计" */
  suffix: string;
}

/** 道具类型 */
export enum ItemType {
  TONIC = 'tonic',       // 补品
  SILK = 'silk',         // 绸缎
  INCENSE = 'incense',   // 香料
  JEWELRY = 'jewelry',   // 首饰
  PAINTING = 'painting', // 字画
  DUTY = 'duty',         // 差事需求品
}

/** 商店道具配置（全字段，数值读配置） */
export interface ShopItemConfig {
  id: string;
  name: string;
  price: number;
  /** 用途类别：补属性 / 送礼 / 差事需求 */
  usage: 'attribute' | 'gift' | 'duty';
  /** 道具类型（补品/绸缎/香料/首饰/字画/差事品） */
  type: ItemType;
  /** 使用/送礼效果描述 */
  effectDesc: string;
  /** 是否可赠送 NPC */
  giftable: boolean;
  /** 是否可使用（补品类） */
  usable: boolean;
  /** 送礼提升好感的基准值 */
  affectionBonus?: number;
  /** 使用时增加的属性（补品类） */
  attrBonus?: AttributeMap;
  /** 差事需求时对应差事 ID（可选） */
  requiredByDuty?: string;
}

/** 女官结婚硬性条件配置 */
export interface MarriageConditionConfig {
  /** 自身职级下限（含） */
  minOfficialRank: OfficialRank;
  /** 目标朝臣好感满值 */
  requiredAffection: number;
  /** 自身声望下限 */
  minReputation: number;
  /** 是否必须无负面 DEBUFF */
  requireNoDebuff: boolean;
}

/** 时间与行动配置 */
export interface TimeConfig {
  /** 每月行动点上限 */
  actionPointMax: number;
  /** 一年月数 */
  monthsPerYear: number;
  /** 跨年奖励银两 */
  annualSilverBonus: number;
  /** 跨年随机属性加成区间 */
  annualAttrBonusRange: NumberRange;
  /** 居所休息消耗行动点 */
  restActionCost: number;
  /** 居所休息体质加成 */
  restConstitutionGain: number;
}

/** 邂逅点位配置（女官线四点位） */
export interface EncounterSpotConfig {
  id: EncounterSpot;
  name: string;
  desc: string;
  /** 允许的朝臣类别（null=文武皆可） */
  allowedType: MinisterType | null;
  /** 品级偏好下限（朝臣品级数字 >= 此值才优先出现，数字越大品级越低） */
  favoredMinGrade: number;
}

/** 好感变动原因（供事件与日志分类） */
export type AffectionChangeReason = 'interaction' | 'favoriteGift' | 'decay' | 'penalty' | 'marriage';

/** 婚后职场助力数值化配置（按夫君品级） */
export interface CareerAssistConfig {
  /** 每月额外功勋 */
  monthlyMeritBonus: number;
  /** 每月额外声望 */
  monthlyReputationBonus: number;
  /** 每年可免除责罚次数 */
  penaltyExemptPerYear: number;
  /** 晋升难度降低比例（0~1，如 0.5 表示减半） */
  promotionDifficultyReduction: number;
}

/** 婚后剧情配置 */
export interface MaritalEventConfig {
  type: MaritalEventType;
  name: string;
  /** 恩爱值变动（可正可负） */
  loveDelta: number;
  /** 触发权重（随机抽取） */
  weight: number;
}

/** 事件浮动配置 */
export interface EventFloatConfig {
  good: { attr: NumberRange; prestige: NumberRange };
  bad: { attr: NumberRange; prestige: NumberRange; debuffChance: number };
}

/** 侍从培养数值配置（四维区间/赏赐/调教/历练/背叛阈值） */
export interface ServantTrainingConfig {
  /** 开局四维随机浮动区间（正负） */
  initialAttrJitter: NumberRange;
  /** 赏赐加忠心区间 */
  rewardLoyaltyGain: NumberRange;
  /** 调教：能力/阅历增益区间 */
  trainAbilityGain: NumberRange;
  trainExperienceGain: NumberRange;
  /** 调教：忠心随机波动区间（可负） */
  trainLoyaltyJitter: NumberRange;
  /** 历练：能力/阅历增益区间 */
  exerciseAbilityGain: NumberRange;
  exerciseExperienceGain: NumberRange;
  /** 背叛风险阈值（忠心低于此值） */
  betrayalThreshold: number;
  /** 背叛风险状态下，每次事件触发泄密/坏事的额外概率 */
  betrayalRiskChance: number;
  /** 背离事件触发阈值（忠心低于此值且满足条件则离走） */
  desertThreshold: number;
}

/** 子嗣生育基础配置 */
export interface ChildbirthConfig {
  /** 解锁子嗣的最低位分（贵人） */
  unlockRank: ConsortRank;
  /** 怀胎周期（月） */
  pregnancyMonths: number;
  /** 受孕时胎儿健康基准 */
  initialFetalHealth: number;
  /** 体质过低阈值（低于此值增加滑胎风险） */
  lowConstitutionThreshold: number;
  /** 滑胎基础概率 */
  miscarriageBaseChance: number;
  /** 怀孕附加 DEBUFF（含蓄表述为"龙胎不稳"，文案避免露骨） */
  pregnancyDebuff: { id: string; name: string; desc: string };
}

/** 怀胎期随机事件配置 */
export interface PregnancyEventConfig {
  type: PregnancyEventType;
  name: string;
  desc: string;
  weight: number;
  /** 胎儿健康变动 */
  fetalHealthDelta: number;
  /** 该事件带来的额外滑胎概率 */
  miscarriageChance: number;
  /** 主角效果包（可选，如体质损耗） */
  effects?: ConsortEffect;
}

/** 成长阶段年龄门槛配置 */
export interface GrowthStageConfig {
  stage: ChildGrowthStage;
  minAge: number;
  label: string;
}

/** 教养方向配置 */
export interface EducationConfig {
  focus: EducationFocus;
  name: string;
  desc: string;
  /** 每次教养花费银两 */
  cost: number;
  /** 属性增益（天资/体魄/心性/容貌） */
  attrGain: { talent?: number; physique?: number; mind?: number; appearance?: number };
  /** 最低成长阶段序号（0=襁褓起） */
  minStageIndex: number;
}

/** 子嗣随机事件配置 */
export interface ChildEventConfig {
  type: ChildEventType;
  name: string;
  desc: string;
  weight: number;
  /** 触发最低年龄 */
  minAge: number;
  /** 健康变动 */
  healthDelta: number;
  /** 属性增益（可选） */
  attrGain?: { talent?: number; physique?: number; mind?: number; appearance?: number };
  /** 银两变动（闯祸赔付为负） */
  silverDelta?: number;
}

/** 成年结局分支配置 */
export interface AdultOutcomeConfig {
  /** 四维总分门槛（按此降序命中第一条） */
  minScore: number;
  /** 封爵预判 */
  title: string;
  /** 婚配预判 */
  marriage: string;
  /** 朝堂助力预判 */
  courtAid: string;
  /** 每年给主角的威望加成 */
  prestigeBonus: number;
}

/** 关系玩法效果配置（对嫔妃的七种操作） */
export interface ConsortRelationConfig {
  type: ConsortRelation;
  name: string;
  desc: string;
  /** 好感增减 */
  affectionDelta: number;
  /** 附加效果 */
  effects: ConsortEffect;
  /** 送礼时送对喜好物品的额外好感（仅 GIFT 用） */
  favoriteBonus?: number;
}

/** 帝宠阶段阈值配置 */
export interface EmperorFavorStageConfig {
  min: number;
  stage: EmperorFavorStage;
  label: string;
}

/** 帝宠关联参数（影响偶遇/晋升/生育/嫔妃态度） */
export interface FavorEffectConfig {
  /** 帝宠每点提升的偶遇概率（加到基础概率上，0~1） */
  encounterPerPoint: number;
  /** 基础偶遇概率 */
  encounterBase: number;
  /** 每点帝宠可降低的威望晋升门槛（高帝宠更易晋升） */
  prestigeThresholdReliefPerPoint: number;
  /** 减免后保留的最低威望门槛比例（0~1，防低位阶帝宠减免后归零） */
  prestigeFloorRatio: number;
  /** 生育基础概率（叠加体质/帝宠系数前） */
  pregnancyBase: number;
  /** 每点帝宠对生育概率的加成（帝宠/300） */
  pregnancyPerPoint: number;
  /** 每点体质对生育概率的加成（体质/100） */
  pregnancyConstitutionPerPoint: number;
  /** 嫔妃态度受帝宠影响的阈值：帝宠高于此值，低位嫔妃转为嫉妒 */
  jealousyThreshold: number;
  /** 高帝宠解锁专属剧情的门槛 */
  exclusiveStoryThreshold: number;
  /** 惹怒皇帝：扣帝宠 / 降位概率 / 禁足月数 / 扣威望 */
  anger: { favorLoss: number; demoteChance: number; confinementMonths: number; prestigeLoss: number };
}


// ==================================================================
// 十一、开局角色创建 / 三路线选择 / 随机属性生成（第九轮）★★
// ==================================================================

/** 路线简介配置（开局路线选择界面展示，数值全部配置化） */
export interface RouteIntroConfig {
  route: GameRoute;
  /** 路线名，如"秀女开局" */
  name: string;
  /** 一句话简介 */
  intro: string;
  /** 成长方向 */
  growthDirection: string;
  /** 特色玩法说明（多条） */
  features: string[];
  /** 醒目标注（女官【可邂逅朝臣、自主婚配】/宫女【可被宠幸转妃嫔】） */
  tag: string;
  /** 初始解锁的系统说明 */
  unlockHint: string;
}

/** 六局供职机构配置（开局宫女/女官选择供职局） */
export interface BureauConfig {
  bureau: SixBureau;
  name: string;
  desc: string;
}

/** 姓名校验结果 */
export interface NameValidationResult {
  ok: boolean;
  reason?: string;
}

/** 属性重刷来源 */
export enum RerollMode {
  /** 免费重刷（不看广告） */
  FREE = 'free',
  /** 激励广告重刷 */
  AD = 'ad',
}

/** 角色生成草稿（自定义角色阶段的中转数据，仅内存，不入存档） */
export interface CharacterDraft {
  name: string;
  age: number;
  familyOrigin: FamilyOrigin;
  attributes: BaseAttributes;
  silver: number;
  /** 已用免费重刷次数 */
  freeRerollUsed: number;
  /** 已用广告重刷次数 */
  adRerollUsed: number;
}

/** 重刷结果 */
export interface RerollResult {
  ok: boolean;
  reason?: string;
  mode: RerollMode;
  /** 重刷后的草稿（成功才有） */
  draft?: CharacterDraft;
}

/** 角色创建参数（草稿 + 路线选择 → 生成完整存档） */
export interface CharacterBuildOptions {
  draft: CharacterDraft;
  route: GameRoute;
  /** 宫女线/女官线必填供职局；秀女线为 null */
  bureau: SixBureau | null;
}

/** 角色创建最终产物 */
export interface CreationResult {
  ok: boolean;
  reason?: string;
  save?: GameSaveData;
}

/** 开局流程判断结果 */
export interface StartFlowDecision {
  /** 是否存在可继续的存档 */
  hasSave: boolean;
  /** 存档元信息（存在时），供"继续游戏"展示 */
  meta: { name: string; route: GameRoute; year: number; month: number } | null;
  /** 建议提示文案 */
  hint: string;
}


// ==================================================================
// 十二、整合模块：UI 主界面 / 事件弹窗 / 广告 SDK / 晋升（第十轮）★★
// ==================================================================

/** 整合层年末总结（结构与 TimeSystem.YearEndReport 一致，独立定义避免反向依赖 core） */
export interface YearEndSummary {
  year: number;
  silverBonus: number;
  attrBonuses: { key: AttributeKey; value: number }[];
}

/** 主界面顶部状态栏视图模型（UI 只读渲染） */
export interface TopBarViewModel {
  year: number;
  month: number;
  actionPoints: number;
  actionPointMax: number;
  silver: number;
  /** 当前位分/职级中文名 */
  rankName: string;
  /** 路线中文名 */
  routeName: string;
  /** 路线标识（用于换肤/配色） */
  routeTag: string;
}

/** 底部导航项（根据路线动态显隐） */
export interface NavItem {
  key: string;
  label: string;
  visible: boolean;
  /** 置灰原因（visible=false 时有值） */
  reason?: string;
}

/** 地图点位视图模型 */
export interface MapPointViewModel {
  id: string;
  name: string;
  desc: string;
  enabled: boolean;
  reason?: string;
}

/** 主界面完整视图模型（读档后可由 save 完整重建） */
export interface MainUIViewModel {
  topBar: TopBarViewModel;
  navItems: NavItem[];
  mapPoints: MapPointViewModel[];
}

/** 事件弹窗选项（选项结算数值/好感/DEBUFF，读配置） */
export interface EventChoiceConfig {
  id: string;
  label: string;
  /** 选项结算效果（复用统一效果包） */
  effect: ConsortEffect;
  /** 好感结算（NPC ID → 增量），独立于 ConsortEffect 以兼容朝臣/嫔妃 */
  affinity?: { targetId: string; delta: number }[];
  /** 选项结果反馈文本 */
  resultText: string;
  /** 该选项是否需观看激励广告才可选（隐藏支线解锁） */
  requiresAd?: AdSlot;
}

/** 地点事件配置（随机事件池条目） */
export interface LocationEventConfig {
  id: string;
  /** 适用地点（空=全地点） */
  locations: string[];
  /** 适用路线（空=三路线通用；否则仅列出的路线刷出） */
  routes: GameRoute[];
  title: string;
  /** 事件正文，可含变量占位符 */
  text: string;
  /** 触发权重 */
  weight: number;
  choices: EventChoiceConfig[];
}

/** 事件弹窗流程状态 */
export interface EventFlowState {
  stage: 'idle' | 'location' | 'event' | 'result';
  locationId: string | null;
  event: LocationEventConfig | null;
  chosen: EventChoiceConfig | null;
  resultText: string;
  /** 本流程是否已扣行动点（防重复扣） */
  apCharged: boolean;
}

/** 事件流程结果（供 UI 渲染 + 自动存档判定） */
export interface EventFlowResult {
  ok: boolean;
  reason?: string;
  state: EventFlowState;
  /** 是否需要自动存档 */
  shouldSave: boolean;
}

/** 广告执行结果（统一四点位返回结构） */
export interface AdResult {
  /** 是否发放了奖励（成功观看 或 有兜底） */
  rewarded: boolean;
  /** 是否完整观看了广告 */
  watched: boolean;
  /** 是否走了兜底（广告未加载/失败/放弃） */
  fallback: boolean;
  reason?: string;
  slot: AdSlot;
}

/** 广告位配置（ID 预留，不写死微信广告位ID） */
export interface AdSlotConfig {
  slot: AdSlot;
  /** 微信后台广告位ID，留空占位，创建后填入（禁止在代码写死正式ID） */
  adUnitId: string;
  /** 该点位奖励说明（给玩家看，明确自愿） */
  rewardDesc: string;
  /** 兜底说明（广告不可用时玩家仍得普通结果） */
  fallbackDesc: string;
}

/** 晋升判定结果 */
export interface PromotionResult {
  ok: boolean;
  /** 是否发生晋升 */
  promoted: boolean;
  reason?: string;
  fromRank: string;
  toRank: string;
  /** 晋升解锁内容说明 */
  unlocked: string;
  /** 是否触发专属剧情弹窗 */
  storyTriggered: boolean;
}

/** 月度编排结果（月结束一次性串联所有刷新） */
export interface MonthTickResult {
  ok: boolean;
  date: GameDate;
  salary: number;
  yearEnd: YearEndSummary | null;
  /** 是否触发晋升 */
  promotion: PromotionResult | null;
  /** 是否触发转线（宫女到期抉择） */
  transitionReady: boolean;
}

/** 总控单次操作结果 */
export interface GameActionResult {
  ok: boolean;
  reason?: string;
  /** 视图模型是否需刷新 */
  refreshUI: boolean;
  /** 自动存档原因 */
  autoSaveReason?: AutoSaveReasonLike;
}

/** 自动存档原因（整合层轻量枚举，与 SaveManager.AutoSaveReason 对齐的字符串联合） */
export type AutoSaveReasonLike =
  | 'monthEnd' | 'storyChoice' | 'identityChange' | 'marriage' | 'childBirth'
  | 'promotion' | 'manual' | 'event' | 'newGame';
