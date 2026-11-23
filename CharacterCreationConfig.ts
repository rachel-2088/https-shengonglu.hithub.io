/**
 * 开局角色创建配置表 —— 年龄 / 姓名校验 / 三路线简介 / 六局 / 重刷规则 / 初始 NPC 好感。
 * ⚠️ 用户明确要求的数值（年龄 14~16、五档家世、初始银两）逐格照抄；
 *    用户未指定的数值（免费重刷次数、敏感词库、初始好感基准）标注为【设计假设】，全部配置化。
 *
 * CHANGELOG:
 *   v1.0.0  初始开局配置
 */
import {
  GameRoute,
  RouteIntroConfig,
  BureauConfig,
  NumberRange,
  SixBureau,
} from '../types/types';

/** 开局年龄随机区间（用户明确要求 14~16 岁） */
export const START_AGE_RANGE: NumberRange = { min: 14, max: 16 };

/** 姓名校验配置（【设计假设】长度上下限与词库可运营调整；敏感词库需按平台规范维护） */
export const NAME_CONFIG = {
  minLength: 2,           // 最少 2 字
  maxLength: 8,           // 最多 8 字（兼容复姓/满洲名含间隔号）
  /** 禁用字符（正则片段）：数字、英文字母与常见符号不允许，仅允许中日韩汉字与 · ```
   * 注：这里用白名单方式在代码里校验，此字段仅供 UI 提示展示，不参与判定。 */
  charHint: '仅允许汉字与间隔号·',
  /** 敏感词库（示例占位，实际需接入平台词库或用运营配置替换） */
  sensitiveWords: [
    '皇帝', '皇上', '皇后', '太子', '太后', // 避免角色名冒充皇室/高位，破坏世界观与审核
    '死', '杀', '妓', '淫', '妖',           // 不雅/违规字词
    'admin', '管理员', '系统',              // 伪装官方
  ],
  /** 默认名（玩家未输入时的兜底，【设计假设】） */
  defaultName: '无名氏',
} as const;

/** 三路线简介（用户指定标注：女官【可邂逅朝臣、自主婚配】，宫女【可被宠幸转妃嫔】） */
export const ROUTE_CONFIGS: RouteIntroConfig[] = [
  {
    route: GameRoute.CONSORT,
    name: '秀女开局',
    intro: '选秀入宫，从秀女起步，于深宫步步为营。',
    growthDirection: '后宫争宠线：帝宠 + 威望双轨晋升，从秀女一路晋至皇后。',
    features: [
      '与嫔妃博弈：交好、拉拢、反击、刺探把柄',
      '侍寝承宠积累帝宠，帝宠减免晋升威望门槛',
      '贵人及以上可诞育子嗣，教养成人封爵光耀门楣',
    ],
    tag: '争宠晋位 · 母凭子贵',
    unlockHint: '解锁妃嫔博弈、皇帝互动、子嗣生育系统',
  },
  {
    route: GameRoute.MAID,
    name: '宫女开局',
    intro: '入宫为奴，供职六局，于夹缝中谋求出路。',
    growthDirection: '六局当差线：勤谨值晋升，粗使宫女→掌事姑姑。',
    features: [
      '六局当差积攒勤谨，分支抉择定终身',
      '御花园偶遇皇帝，容貌与家世兼备者可破格进封',
      '掌事姑姑二选一：承宠入妃嫔 / 考选转女官，资产继承不断档',
    ],
    tag: '【可被宠幸转妃嫔】',
    unlockHint: '解锁宫女差事系统；转线后继承全部资产',
  },
  {
    route: GameRoute.OFFICIAL,
    name: '女官开局',
    intro: '以才入仕，供职六局，凭功勋声望立身于朝。',
    growthDirection: '女官事业线：功勋 + 声望晋升，女史→尚宫。',
    features: [
      '六局公务积累功勋声望，典事起参与朝堂',
      '四大点位邂逅文武朝臣，六阶段好感培养',
      '好感满值触发求娶/赐婚，奉旨自主婚配，夫君助力职场',
    ],
    tag: '【可邂逅朝臣、自主婚配】',
    unlockHint: '解锁女官公务 + 朝臣婚恋系统（职级到典事后开放）',
  },
];

/** 按路线取简介 */
export function getRouteConfig(route: GameRoute): RouteIntroConfig | undefined {
  return ROUTE_CONFIGS.find((c) => c.route === route);
}

/** 六局供职机构（宫女线/女官线开局选择；尚宫局为女官总部） */
export const BUREAU_CONFIGS: BureauConfig[] = [
  { bureau: SixBureau.SHANG_GONG, name: '尚宫局', desc: '总领六局事务，掌诏敕文书，女官晋升总部。' },
  { bureau: SixBureau.SHANG_YI, name: '尚仪局', desc: '掌礼仪起居、朝会赞导，最重规矩仪态。' },
  { bureau: SixBureau.SHANG_FU, name: '尚服局', desc: '掌服饰冠佩、宝物库藏，近身服御之职。' },
  { bureau: SixBureau.SHANG_SHI, name: '尚食局', desc: '掌御膳菜品、酒醴醯酱，可近圣驾。' },
  { bureau: SixBureau.SHANG_QIN, name: '尚寝局', desc: '掌寝殿陈设、园苑清扫，随侍起居。' },
  { bureau: SixBureau.SHANG_GONG_WORK, name: '尚功局', desc: '掌女红织造、工程营造，考核百工。' },
  { bureau: SixBureau.HUAN_YI, name: '浣衣局', desc: '浆洗衣物、粗重杂役，宫女线底层差事起点。' },
];

export function getBureauConfig(bureau: SixBureau): BureauConfig | undefined {
  return BUREAU_CONFIGS.find((c) => c.bureau === bureau);
}

/** 重刷规则（用户要求：不看广告直接重刷一次；不满意可看激励广告再次重刷；广告回调失败不扣次数、不强制） */
export const REROLL_CONFIG = {
  /** 免费重刷次数（不看广告，【设计假设】默认 1 次） */
  freeRerollCount: 1,
  /** 广告重刷单次成本（仅记录统计，无付费；【设计假设】） */
  adCost: 0,
  /** 广告点位：固定使用 REROLL_ATTRS（唯一合规入口） */
  adSlot: 'rerollAttrs' as const,
} as const;

/** 初始 NPC 好感基准（【设计假设】，未指定时按各 NPC 配置的 initialAffection；此处为兜底基准） */
export const INITIAL_NPC_AFFECTION = {
  /** 妃嫔线初始化嫔妃好感时的兜底值（NPC 配置有 initialAffection 时以配置为准） */
  consortFallback: 20,
  /** 女官线初始化朝臣好感时的兜底值（朝臣配置有 initialAffection 时以配置为准） */
  ministerFallback: 0,
} as const;
