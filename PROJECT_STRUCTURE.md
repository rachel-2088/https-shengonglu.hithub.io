# 《深宫录》项目文件夹结构（Cocos Creator 3.x + 微信小游戏）

```
深宫录/
├── assets/                              # Cocos 资源根目录（主包内容）
│   ├── scenes/
│   │   └── Main.scene                   # 主场景：游戏总控入口（待建）
│   ├── prefabs/                         # 通用预制体（弹窗、NPC卡、属性条…）
│   ├── resources/                       # 动态加载资源（resources 会被打进主包）
│   │   ├── images/
│   │   ├── audio/
│   │   └── fonts/
│   ├── bundles/                         # ★微信小游戏分包（Asset Bundle）
│   │   ├── subpackage-story/            # 剧情/事件文本与脚本分包
│   │   ├── subpackage-official/         # 女官线朝臣婚恋分包（独家模块，独立加载）
│   │   └── subpackage-ui/               # 大量 UI 图片资源分包
│   └── scripts/
│       ├── core/                        # 核心框架
│       │   ├── GameManager.ts           # 游戏总控单例（读档/存档/场景切换）
│       │   ├── TimeSystem.ts            # 月历循环 / 5点行动点 / 年末总结
│       │   ├── EventBus.ts              # 事件总线（模块解耦）
│       │   └── StorageAdapter.ts        # 存储抽象（可选，saveData 已内置适配）
│       ├── config/                      # ★全部数值配置表（用户提供的数值逐表落地）
│       │   ├── GameConfig.ts            # 配置聚合入口
│       │   ├── TimeConfig.ts            # 时间/行动点/跨年奖励
│       │   ├── FamilyConfig.ts          # 家世初始区间
│       │   ├── ConsortConfig.ts         # 妃嫔晋升门槛+俸禄
│       │   ├── MaidConfig.ts            # 宫女品级+勤谨值+俸禄
│       │   ├── OfficialConfig.ts        # 女官职级+功勋+声望+俸禄
│       │   ├── ShopConfig.ts            # 商店物品
│       │   ├── MinisterConfig.ts        # 文武百官官职+婚后加成
│       │   ├── MarriageConfig.ts        # 婚恋条件/好感阶段/夫君加成
│       │   ├── ServantConfig.ts         # 侍从数值
│       │   ├── ChildConfig.ts           # 子嗣数值
│       │   └── LocationConfig.ts        # 大地图地点/邂逅点位
│       ├── types/
│       │   ├── types.ts                 # ★全量类型与枚举（本轮已交付）
│       │   └── index.ts                 # 类型统一导出
│       ├── data/
│       │   └── saveData.ts              # ★本地存档系统（本轮已交付）
│       ├── systems/                     # 业务系统（按路线/功能拆分）
│       │   ├── RouteSystem.ts           # 路线与晋升
│       │   ├── MapSystem.ts             # 皇宫大地图
│       │   ├── DutySystem.ts            # 差事
│       │   ├── ShopSystem.ts            # 商店/背包
│       │   ├── ConsortSystem.ts         # 妃嫔线：帝宠/博弈/子嗣
│       │   ├── MaidSystem.ts            # 宫女线：勤谨/宠幸转线
│       │   ├── OfficialSystem.ts        # 女官线：功勋/声望/官场
│       │   ├── MinisterSystem.ts        # 朝臣邂逅/好感/求娶/赐婚
│       │   ├── MarriageSystem.ts        # 婚后系统/夫君加成/恩爱剧情
│       │   ├── ServantSystem.ts         # 侍从培养
│       │   └── AdSystem.ts              # 激励广告（仅4点位）
│       ├── ui/                          # 界面控制器
│       └── utils/                       # 工具函数
├── build-templates/
│   └── wechatgame/                      # 微信小游戏构建模板（适配 game.json 等）
├── extensions/                          # Cocos 扩展插件
├── settings/                            # 编辑器设置
├── package.json                         # 项目清单（本轮已建）
└── tsconfig.json                        # TS 编译配置（本轮已建）
```

## 分包策略说明

| 分包                  | 内容                       | 加载时机              |
| ------------------- | ------------------------ | ----------------- |
| 主包                  | 核心框架、类型、存档、配置表、主场景、首屏 UI | 启动即加载             |
| subpackage-story    | 剧情文本、随机事件库               | 进入剧情/事件时预加载       |
| subpackage-official | 女官线朝臣婚恋全套（独家模块，体积大）      | 女官线解锁典事、进入官场系统时加载 |
| subpackage-ui       | 大量图片/字体资源                | 按需预下载             |

> ⚠️ 微信小游戏主包体积有上限，务必把大体积资源放分包；具体限额与分包规范以微信官方最新文档为准。
