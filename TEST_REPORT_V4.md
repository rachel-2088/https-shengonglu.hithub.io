# 《深宫录》V4 三路线闭环全流程测试报告

> 测试日期：2026-11-23 ｜ 测试对象：纯逻辑层 45 个 TS 源文件 ｜ 方式：影子目录 + tsc strict + Node 运行时
> 测试脚本：`tscheck11/v4closure.ts`（闭环）+ `tscheck11/probe.ts`（深度探查）+ 历史回归 smoke2~10

---

## 一、总体结论

| 指标 | 结果 |
|---|---|
| 全量严格类型检查 | ✅ 0 错误 |
| V4 三路线闭环用例 | ✅ 93 / 93 通过 |
| 深度探查项 | 6 项，发现 **1 个致命卡死 BUG + 3 个数值失衡 + 1 个设计瑕疵** |
| 历史全量回归 | ✅ 897 项通过（历史）+ 93（本轮）= **990 项 0 失败** |
| 三路线闭环 | 秀女→妃嫔、宫女→宠幸转答应/考选转女官、女官→赐婚成婚 **全部跑通** |

**一句话结论**：主流程健全、存档回滚完整、权限隔离有效；但**女官晋升存在致命卡死**（中后段 7 个职级永远升不上去），**怀孕概率公式失衡**（体质权重过高导致大面积 100%），需在上线前修复。

---

## 二、三路线闭环测试结果（93 项全通过）

### 路线一：秀女 → 妃嫔线 ✅
- 开局位分/权限/时间正确；妃嫔线隐藏朝臣婚恋面板，婚恋系统调用被礼制拦截
- 帝宠减免威望门槛生效 → 晋升常在 → 晋贵人解锁子嗣系统
- 受孕 → 挂"龙胎不稳"DEBUFF → 怀胎十月 → 足月诞育 → DEBUFF 清除，全链路通过

### 路线二：宫女线 ✅
- 开局粗使宫女+六局，无妃嫔/女官职级；隐藏子嗣与婚恋面板，生育/赐婚均被拦截
- 勤谨晋升普通宫女通过
- **宠幸转答应分支**：低容貌寒门→轻幸→进封答应；高容貌世家→进封常在，资产继承正确
- **考选转女官分支**：勤谨100→功勋50、帝宠清零、婚恋初始化未婚

### 路线三：女官线 ✅
- 女史未解锁朝臣，典事解锁；隐藏子嗣/帝宠面板
- 宫门邂逅朝臣 → 诗文刷好感至满 → 触发求娶标记 → 阶段映射正确
- 结婚四项硬校验（职级/好感/声望/DEBUFF）逐项生效 → 赐婚写入夫君 → 婚后年银两加成读配置 → 回家相聚每月限一次

### 横向校验 ✅
- 行动点归零跨月重置、俸禄发放、12月年末结算（年份+1、银两奖励）全部正确
- 存档回滚：夫君/子嗣/侍从/朝臣好感/永久DEBUFF/银两 **全部完整恢复**
- 侍从忠心：赏赐提升、低忠心反噬、极低忠心背离正确
- 广告兜底：success/close/fail/未配置ID 四态均不卡死
- 开局随机边界、姓名校验、覆盖旧档检测通过

---

## 三、BUG 清单（按严重程度）

### 🔴 BUG-1【致命·必现】女官中后段 7 个职级永远无法晋升

| 项 | 内容 |
|---|---|
| 现象 | 功勋/声望拉满（各1000）时，女史→掌事晋升 `promoted=false`，永久卡在女史 |
| 根因 | `PromotionSystem.meetsRequirement()` 对女官线执行 `PROMOTION_RULES[OFFICIAL].requireDuty=true`，要求 `duty.isPromotionDone(目标职级)`。但 `DutyConfig.DUTY_CONFIGS` 中 `isPromotion` 专属差事**只配置了 2 级**：`OfficialRank.DIAN_SHI`、`OfficialRank.SI_SHI` |
| 影响 | 女官 9 个晋升目标中，**ZHANG_SHI / SI_ZUO / SI_ZHENG / JU_CHENG / JU_ZUO / SHANG_SHU / SHANG_GONG 共 7 级**没有任何对应差事 → 玩家升到掌事后彻底卡死，女官事业线后半程不可玩 |
| 证据 | 探查2：`功勋1000+声望1000，女史→下一级 promoted=false toRank=nvShi` |

**修复方案（二选一）**：
1. **补配置（推荐，保持"专属差事"设计）**：在 `config/DutyConfig.ts` 为缺失的 7 个职级各补一条 `isPromotion:true, promotionTarget:<职级>` 的考课差事，`minRank` 设为前一级。示例：
   ```ts
   { id: 'duty_promote_zhang_shi', name: '晋阶考课·掌事', ...,
     category: DutyCategory.OFFICIAL_DUTY, minRank: OfficialRank.NV_SHI,
     isPromotion: true, promotionTarget: OfficialRank.ZHANG_SHI, ... },
   // 其余 SI_ZUO/SI_ZHENG/JU_CHENG/JU_ZUO/SHANG_SHU/SHANG_GONG 同理
   ```
2. **放宽规则（改动更小）**：仅对已配置差事的职级要求差事，无差事职级只验功勋+声望。在 `PromotionSystem.meetsRequirement()` 女官分支改为：
   ```ts
   if (PROMOTION_RULES[route].requireDuty && this.duty.hasPromotionDuty(targetRank)
       && !this.duty.isPromotionDone(targetRank)) return false;
   ```
   （需在 DutySystem 增加 `hasPromotionDuty(rank)` 判断配置是否存在）

> 另注：现有两条差事 ID 含空格（`duty_promote_dian shi`、`duty_promote_si shi`），建议一并改为下划线 `duty_promote_dian_shi`，避免 ID 匹配隐患。

---

## 四、数值不平衡点

### 🟠 NUM-1【高】怀孕概率公式失衡，体质权重过高
- **现状**：`概率 = 12% + 帝宠/300 + 体质/100`，上限钳制 100%。体质满分100时，即使帝宠0，基础已达 112% → **恒为100%**。
- **实测数据**：

  | 体质 | 帝宠0 | 帝宠55 | 帝宠100 |
  |---|---|---|---|
  | 30 | 42% | 60% | 75% |
  | 50 | 62% | 80% | 95% |
  | 70 | 82% | **100%(溢出)** | **100%(溢出)** |
  | 90 | **100%(溢出)** | **100%(溢出)** | **100%(溢出)** |

- **问题**：体质对生育的边际贡献（每点+1%）是帝宠（每点+0.33%）的 3 倍；开局家世体质普遍 25~50，随机到高体质+中等帝宠即触顶，生育变成"必定怀孕"，怀孕/滑胎的策略性与稀缺感消失。
- **建议**：降低体质系数至 `1/250`（每点+0.4%），并把基础降到 8%。修正后体质70+帝宠55 ≈ 8%+18%+28% = 54%，体质90+帝宠100 ≈ 8%+33%+36% = 77%，保留成长空间。配置位置：`config/EmperorConfig.ts` 的 `FAVOR_EFFECTS`。

### 🟡 NUM-2【中】帝宠威望减免使低位阶门槛归零
- 满宠减免 50 威望，而答应（15）、常在（35）配置门槛低于 50 → 实际门槛=0。低位晋升**只看帝宠、完全跳过威望**，妃嫔线前期"争宠即可晋级"，威望维度形同虚设。
- **建议**：减免后设下限为配置门槛的 30%（`Math.max(cfg.prestigeRequired * 0.3, cfg.prestigeRequired - relief)`），或减免系数从 0.5 降到 0.25。位置：`EmperorConfig.FAVOR_EFFECTS.prestigeThresholdReliefPerPoint` / `EmperorInteractionSystem.getEffectivePrestigeRequirement()`。

### 🟡 NUM-3【中】结婚好感门槛与"相许"阶段倒挂
- 结婚要求好感=100（满值），但"相许"阶段阈值是96。玩家在96~99 已是"相许"却仍不能结婚，UI 若按阶段提示"可求娶"会造成困惑。
- **建议**：将 `MARRIAGE_CONDITIONS.requiredAffection` 与相许阈值统一为 96，或 UI 明确提示"需满值100"。位置：`config/MarriageConfig.ts`。

---

## 五、设计瑕疵 / 潜在卡点

### ⚪ DESIGN-1【中】宫女宠幸转线无品级门槛
- `MaidTransitionSystem.canTransit()` 仅检查 `route===MAID`，**粗使宫女（最低品级）可直接宠幸进封答应**，跳过"普通→管事→掌事"的成长。探查3 实测 `粗使宫女直接进封 ok=true`。
- 若产品意图是"任何宫女都可能被宠幸"则属正常；若强调成长，建议加门槛 `maidRank >= ZHANG_SHI`（与 `isTransitionReady()` 的触发条件保持一致），否则 `unlockDesc` 里"掌事姑姑二选一"的设定被架空。

### ⚪ STORY-1【提示】关键剧情弹窗依赖事件订阅
- 晋升、转线、赐婚、生子均通过 `GameEvent.PROMOTION_READY / KEY_STORY_READY / MARRIAGE_CHANGED / CHILD_BORN` 通知 UI。若 UI 层未订阅这些事件，**剧情会被跳过但不影响数值结算**（不会卡死流程，只是无展示）。接入 UI 时需确保订阅齐全。

### ⚪ SAVE-1【提示】自动存档镜像双写
- `autoSave()` 同时写 `AUTOSAVE_KEY` 与主 `SAVE_KEY`；`saveToSlot()` 只写槽位。读档注意分清 `loadAuto()`（自动档）与 `loadFromSlot(n)`（手动档），二者当前引用体系不同——闭环测试已验证各自数据完整，接入 UI 时不要混用。

---

## 六、修复优先级建议

| 优先级 | 编号 | 动作 | 工作量 |
|---|---|---|---|
| P0（上线前必改） | BUG-1 | 补齐 7 条女官晋升专属差事配置 | 小（纯配置） |
| P1（强烈建议） | NUM-1 | 下调怀孕概率体质系数 | 小（改2个常量） |
| P2 | NUM-2 / NUM-3 | 减免下限 + 好感门槛对齐 | 小 |
| P3 | DESIGN-1 | 确认宠幸转线是否加品级门槛 | 需产品决策 |

---

## 七、测试资产与复现方式

- 闭环测试：`tscheck11/v4closure.ts` → `PASS=93 FAIL=0`
- 深度探查：`tscheck11/probe.ts`（输出本报告第三、四章数据）
- 历史回归：smoke2~10 + regress 全通过
- 复现命令（影子目录内）：
  ```bash
  tsc --strict --target ES2019 --module CommonJS --moduleResolution Node --skipLibCheck \
      --esModuleInterop --lib ES2019,DOM cc.d.ts v4closure.ts $(find config core data systems types ui utils -name '*.ts') --outDir dist
  node dist/v4closure.js
  ```

> ⚠️ 合规提示：本轮为逻辑层测试，未涉及微信广告位ID（仍留空占位）、未接真机。提审前仍需完成分包配置、类目资质与隐私指引自查，规则以微信官方最新文档为准。

---

## 八、修复记录（2026-11-23）

> 针对本报告第三、四章的问题已完成修复，专项回归 17 项 + 全量回归 1006 项全通过。

| 编号 | 修复动作 | 修改文件 | 验证 |
|---|---|---|---|
| 🔴 BUG-1 | 女官晋升差事由 2 条补齐为 **9 条全覆盖**（掌事/司佐/司正/局丞/局佐/尚属/尚宫7级补齐），`minRank`=前一级；并在 `PromotionSystem` 增加 `hasPromotionDuty()` 兜底——未配差事的职级不强求校验，防未来新增职级遗漏再卡死 | `DutyConfig.ts` / `DutySystem.ts` / `PromotionSystem.ts` | 实测功勋声望拉满可从女史一路升至尚宫；兜底方法对已配/未配职级分别返回 true/false |
| 🟠 NUM-1 | 怀孕概率：体质系数 `1/100 → 1/250`、基础 `12% → 8%`（帝宠系数 1/300 不变）。修正后体质70+帝宠55≈54%（原溢出100%），体质100+帝宠100≈81%，保留策略空间 | `EmperorConfig.ts` | 概率曲线不再触顶，断言公式与配置一致 |
| 🟡 NUM-2 | 帝宠威望减免新增 **30% 下限**（配置项 `prestigeFloorRatio:0.3`）：`实际门槛 = max(原门槛×0.3, 原门槛−减免)`。满宠下常在门槛由 0 恢复为 10.5，高位阶减免不变 | `EmperorConfig.ts` / `types.ts` / `EmperorInteractionSystem.ts` | 满宠常在门槛>0且=原门槛30% |
| 🟡 NUM-3 | 结婚好感门槛 `100 → 96`，与"相许"阶段阈值对齐 | `MarriageConfig.ts` | requiredAffection===相许阈值96 |
| 小瑕疵 | 4 条差事 ID 空格改下划线（`duty_promote_guan_shi`/`zhang_shi`/`dian_shi`/`si_shi`） | `DutyConfig.ts` | 全部差事ID无空格，可正常查到 |
| ⚪ DESIGN-1 | **未改动**（产品决策项）：宫女宠幸转线仍无品级门槛。若采纳"掌事姑姑二选一"设定，在 `MaidTransitionSystem.canTransit()` 增加 `maidRank >= ZHANG_SHI` 即可（会改变玩法，故保留现状待定） | — | — |

**回归结果**：
- 修复专项 `tests/fix-verify.ts`：**17/17 通过**
- 全量历史回归：smoke2~10 + regress + v4closure + fix-verify，**1006 项 0 失败**
- `tsc strict` 全量 0 错误；同步更新 smoke4/smoke6 两处硬编码旧公式断言改为读配置（数值调整后测试自动跟随）
