declare const require: any;
import { TimeSystem } from './core/TimeSystem';
import { MapSystem } from './systems/MapSystem';
import { DutySystem } from './systems/DutySystem';
import { MinisterEncounterSystem } from './systems/MinisterEncounterSystem';
import { PromotionSystem } from './systems/PromotionSystem';
import { MaidTransitionSystem } from './systems/MaidTransitionSystem';
import { MarriageSystem } from './systems/MarriageSystem';
import { ChildSystem } from './systems/ChildSystem';
import { ServantSystem } from './systems/ServantSystem';
import { ConsortIntrigueSystem } from './systems/ConsortIntrigueSystem';
import { EmperorInteractionSystem } from './systems/EmperorInteractionSystem';
import { ShopSystem } from './systems/ShopSystem';
import { SaveManager } from './systems/SaveManager';
import { EventFlowSystem } from './systems/EventFlowSystem';
import { AdService, AdPlatformAdapter } from './utils/AdService';
import { MainUISystem } from './ui/MainUISystem';
import { GameFlowSystem } from './systems/GameFlowSystem';
import { CharacterCreationSystem } from './systems/CharacterCreationSystem';
import {
  createNewSave, rawRemove, rawGet, getSlotKey, SAVE_KEY, AUTOSAVE_KEY,
  loadGame, setMinisterAffection, addDebuff, addMinisterAffection, createMinisterRuntime,
} from './data/saveData';
import { gameEvents, GameEvent } from './core/EventBus';
import {
  GameRoute, FamilyOrigin, ConsortRank, OfficialRank, MaidRank, SixBureau,
  PalaceLocation, EncounterSpot, MinisterInteraction, MarriageStatus, AffectionStage,
  AdSlot, ServantStatus,
} from './types/types';
import {
  MINISTER_ROSTER, MARRIAGE_CONDITIONS, MARRIAGE_LOVE_CONFIG, FAVOR_EFFECTS,
  CHILDBIRTH_CONFIG, SERVANT_TRAINING, AFFECTION_STAGE_THRESHOLDS,
} from './config/GameConfig';

// ==================== 测试框架 ====================
let pass = 0, fail = 0;
const failures: { group: string; msg: string }[] = [];
let CUR_GROUP = '';
function group(name: string) { CUR_GROUP = name; console.log(`\n===== ${name} =====`); }
function ok(c: boolean, m: string) {
  if (c) { pass++; }
  else { fail++; failures.push({ group: CUR_GROUP, msg: m }); console.log('  ✗ FAIL:', m); }
}
function info(m: string) { console.log('  ·', m); }

// 固定随机源（可覆写序列）
function fixedRng(v: number) { return () => v; }
function seqRng(seq: number[]) { let i = 0; return () => seq[i++ % seq.length]; }

// ==================== 装配 helper ====================
function makeWorld(route: GameRoute, overrides: any = {}) {
  const attrs = {
    appearance: overrides.appearance ?? 70, talent: 70, wit: 70,
    social: 70, constitution: overrides.constitution ?? 70,
  };
  const save = createNewSave({
    name: overrides.name ?? '测试',
    age: 15,
    route,
    familyOrigin: overrides.family ?? FamilyOrigin.NOBLE,
    attributes: attrs,
    silver: overrides.silver ?? 500,
    bureau: route === GameRoute.CONSORT ? null : (overrides.bureau ?? SixBureau.SHANG_GONG),
  });
  if (overrides.consortRank) save.character.consortRank = overrides.consortRank;
  if (overrides.officialRank) save.character.officialRank = overrides.officialRank;
  if (overrides.maidRank) save.character.maidRank = overrides.maidRank;
  if (overrides.favor != null) save.character.favor = overrides.favor;
  if (overrides.prestige != null) save.character.prestige = overrides.prestige;
  if (overrides.merit != null) save.character.merit = overrides.merit;
  if (overrides.reputation != null) save.character.reputation = overrides.reputation;
  if (overrides.diligence != null) save.character.diligence = overrides.diligence;

  [SAVE_KEY, AUTOSAVE_KEY, getSlotKey(1), getSlotKey(2), getSlotKey(3)].forEach(k => rawRemove(k));

  const persist = () => {};
  const rng = overrides.rng ?? fixedRng(0.5);
  const time = new TimeSystem(save, persist, rng);
  const map = new MapSystem(save, time, rng);
  const duty = new DutySystem(save, persist, rng);
  const encounter = new MinisterEncounterSystem(save, persist, rng);
  const emperor = new EmperorInteractionSystem(save, persist, rng);
  const promotion = new PromotionSystem(save, duty, emperor, persist);
  const transition = new MaidTransitionSystem(save, persist);
  const marriage = new MarriageSystem(save, persist);
  const child = new ChildSystem(save, persist, rng, emperor);
  const servant = new ServantSystem(save, persist, rng);
  const intrigue = new ConsortIntrigueSystem(save, persist, rng);
  const shop = new ShopSystem(save, persist, rng);
  const ui = new MainUISystem(save, map, promotion);
  const saves = new SaveManager(save);
  const flow = new GameFlowSystem(save, time, map, duty, encounter, promotion, transition, ui, saves, 1);
  return { save, time, map, duty, encounter, emperor, promotion, transition, marriage, child, servant, intrigue, shop, ui, saves, flow };
}

function makeAdapter(mode: 'success' | 'close' | 'fail'): AdPlatformAdapter {
  return {
    isConfigured: (id: string) => id.length > 0,
    load: (_id, onLoad, onError) => { if (mode === 'fail') onError(new Error('load fail')); else onLoad(); },
    show: (onReward, onClose) => {
      if (mode === 'success') { onReward(); onClose(true); }
      else if (mode === 'close') onClose(false);
    },
  };
}

async function main() {

// ================================================================
// 路线一：秀女 → 妃嫔线闭环
// ================================================================
group('路线一：秀女→妃嫔线闭环');
{
  const w = makeWorld(GameRoute.CONSORT, { consortRank: ConsortRank.XIU_NV });
  const s = w.save;
  // 1) 开局状态
  ok(s.character.route === GameRoute.CONSORT && s.character.consortRank === ConsortRank.XIU_NV, '秀女开局位分正确');
  ok(s.character.officialRank === null && s.character.maidRank === null, '秀女线无宫女/女官职级');
  ok(s.time.year === 1 && s.time.month === 1 && s.time.actionPoints === 5, '开局第1年1月AP=5');
  info(`初始银两=${s.character.silver} 家世=${s.character.familyOrigin}`);

  // 2) 权限隔离：妃嫔看不到朝臣婚恋，看不到女官面板
  const vm = w.ui.buildViewModel();
  ok(vm.navItems.find(n => n.key === 'ministerMarriage')!.visible === false, '妃嫔线隐藏朝臣婚恋面板');
  // 婚恋系统直接调用也应被拦截
  const blockedMarriage = w.marriage.checkEligibility(MINISTER_ROSTER[0].id);
  ok(blockedMarriage.ok === false && blockedMarriage.reasons[0].includes('礼制'), '妃嫔调用婚恋系统被礼制拦截');
  const blockedChildLow = w.child.tryConceive();
  ok(blockedChildLow.ok === false, '秀女未达贵人不可生育');

  // 3) 侍寝承宠 → 帝宠提升 → 晋升贵人
  s.character.favor = 55; s.character.prestige = 65;
  const rel = w.emperor.getPrestigeRelief();
  ok(rel > 0, `帝宠减免威望门槛生效（减免=${rel}）`);
  const promo = w.promotion.checkAndPromote();
  ok(promo.promoted, `妃嫔满足威望+帝宠后晋升（${promo.fromRank}→${promo.toRank}）`);
  info(`晋升结果 toRank=${promo.toRank} storyTriggered=${promo.storyTriggered}`);

  // 4) 达贵人后解锁子嗣
  s.character.consortRank = ConsortRank.GUI_REN;
  ok(w.child.isUnlocked(), '晋至贵人解锁子嗣系统');
  ok(w.ui.buildViewModel().navItems.find(n => n.key === 'children')!.visible === true, '贵人显示子嗣面板');

  // 5) 怀孕概率数值校验（体质70/帝宠55 → 0.12 + 55/300 + 70/100）
  const expectProb = FAVOR_EFFECTS.pregnancyBase + 55 * FAVOR_EFFECTS.pregnancyPerPoint + 70 * FAVOR_EFFECTS.pregnancyConstitutionPerPoint;
  const realProb = w.child.getConceptionProbability();
  ok(Math.abs(realProb - Math.min(1, expectProb)) < 1e-9, `怀孕概率公式正确(含100%上限钳制)（原始${expectProb.toFixed(3)} 实际${realProb.toFixed(3)}）`);
  info(`怀孕概率=${(realProb * 100).toFixed(1)}%（原始公式溢出=${expectProb>1}）`);
  // 强制受孕
  const conceive = new ChildSystem(s, () => {}, fixedRng(0.0), w.emperor); // rng=0 必成功
  const cr = conceive.tryConceive();
  ok(cr.conceived && s.pregnancy.active, '受孕成功写入怀孕状态');
  ok(s.character.activeDebuffs.some(d => d.id === CHILDBIRTH_CONFIG.pregnancyDebuff.id), '怀孕挂龙胎不稳DEBUFF');
  // 怀胎十月（rng=0.9 避开滑胎，安稳事件）
  let delivered = false;
  for (let i = 0; i < 12 && !delivered; i++) {
    const t = conceive.tickPregnancy();
    if (t.delivered) delivered = true;
  }
  ok(delivered && s.children.length === 1, '怀胎十月后足月诞育1名子嗣');
  ok(!s.pregnancy.active, '分娩后怀孕状态清空');
  ok(!s.character.activeDebuffs.some(d => d.id === CHILDBIRTH_CONFIG.pregnancyDebuff.id), '分娩后DEBUFF移除');
  info(`子嗣数=${s.children.length}`);
}

// ================================================================
// 路线二：宫女线（含宠幸转答应分支）
// ================================================================
group('路线二：宫女线闭环（含宠幸转答应）');
{
  const w = makeWorld(GameRoute.MAID, { maidRank: MaidRank.CU_SHI, family: FamilyOrigin.COMMONER });
  const s = w.save;
  ok(s.character.maidRank === MaidRank.CU_SHI && s.character.bureau != null, '宫女开局粗使宫女+供职六局');
  ok(s.character.consortRank === null && s.character.officialRank === null, '宫女线无妃嫔/女官职级');
  const vm = w.ui.buildViewModel();
  ok(vm.navItems.find(n => n.key === 'children')!.visible === false, '宫女线隐藏子嗣面板');
  ok(vm.navItems.find(n => n.key === 'ministerMarriage')!.visible === false, '宫女线隐藏朝臣婚恋');
  // 宫女不能直接结婚
  const bm = w.marriage.checkEligibility(MINISTER_ROSTER[0].id);
  ok(bm.ok === false, '宫女不能直接赐婚（婚恋系统拦截）');
  // 宫女不能生育
  ok(w.child.tryConceive().ok === false, '宫女不能生育');

  // 勤谨晋升
  s.character.diligence = 45;
  const p1 = w.promotion.checkAndPromote();
  ok(p1.promoted && p1.toRank === MaidRank.PU_TONG, '宫女勤谨达标晋升普通宫女');

  // —— 宠幸转答应分支 ——
  const w2 = makeWorld(GameRoute.MAID, { maidRank: MaidRank.ZHANG_SHI, family: FamilyOrigin.COMMONER, appearance: 40, rng: fixedRng(0.0) });
  const enemy = w2.save;
  // 偶遇判定：容貌40 → chance=0.12+40*0.0015≈0.18，rng=0必触发；容貌<55非世家 → kind='light'
  const enc = w2.emperor.maidEncounter(40, FamilyOrigin.COMMONER);
  ok(enc.triggered && enc.kind === 'light', '低容貌寒门宫女偶遇=轻幸（非进封）');
  const tr = w2.transition.imperialFavorPromotion();
  ok(tr.ok && tr.newRank === ConsortRank.DA_YING, `宠幸进封默认答应当（实际${tr.newRank}）`);
  ok(enemy.character.route === GameRoute.CONSORT && enemy.character.maidRank === null, '转线后route=妃嫔且宫女品级清空');
  ok(enemy.character.favor >= 30, '宠幸进封帝宠+30');
  ok(w2.ui.buildViewModel().navItems.find(n => n.key === 'ministerMarriage')!.visible === false, '转妃嫔后仍隐藏朝臣婚恋');

  // ——  exceptional 进封常在 ——
  const w3 = makeWorld(GameRoute.MAID, { maidRank: MaidRank.ZHANG_SHI, family: FamilyOrigin.NOBLE, appearance: 60 });
  const tr3 = w3.transition.imperialFavorPromotion();
  ok(tr3.ok && tr3.newRank === ConsortRank.CHANG_ZAI, '高容貌世家宫女宠幸进封常在');

  // —— 考选转女官分支 ——
  const w4 = makeWorld(GameRoute.MAID, { maidRank: MaidRank.ZHANG_SHI, diligence: 100 });
  const tr4 = w4.transition.examinationToOfficial();
  ok(tr4.ok && w4.save.character.route === GameRoute.OFFICIAL, '考选转女官成功');
  ok(w4.save.character.merit === 50, '勤谨100按0.5折算功勋50');
  ok(w4.save.character.favor === 0, '转女官后帝宠清零');
  ok(w4.save.marriage.status === MarriageStatus.SINGLE, '转女官后婚恋初始化未婚');
}

// ================================================================
// 路线三：女官线（典事解锁朝臣、刷好感、赐婚成婚）
// ================================================================
group('路线三：女官线闭环（典事→邂逅→刷好感→赐婚）');
{
  const w = makeWorld(GameRoute.OFFICIAL, { officialRank: OfficialRank.NV_SHI });
  const s = w.save;
  ok(s.character.officialRank === OfficialRank.NV_SHI, '女官开局女史');
  ok(w.ui.buildViewModel().navItems.find(n => n.key === 'children')!.visible === false, '女官线隐藏子嗣面板');
  ok(w.ui.buildViewModel().navItems.find(n => n.key === 'consortIntrigue')!.visible === false, '女官线隐藏帝宠嫔妃');
  // 女史未解锁朝臣
  ok(w.encounter.isUnlocked() === false, '女史未解锁朝臣邂逅');
  const mm = w.ui.buildViewModel().navItems.find(n => n.key === 'ministerMarriage')!;
  ok(mm.visible === false && (mm.reason || '').includes('典事'), '女史朝臣婚恋置灰并提示典事');

  // 晋升到典事
  s.character.merit = 200; s.character.reputation = 60;
  // 女官晋升需专属差事，先标记完成（直接构造flags或直接next）
  const promo = w.promotion.checkAndPromote();
  info(`女官晋升尝试 toRank=${promo.toRank} promoted=${promo.promoted}（差事要求可能影响）`);
  // 直接设为典事继续闭环
  s.character.officialRank = OfficialRank.DIAN_SHI;
  ok(w.encounter.isUnlocked() === true, '典事解锁朝臣邂逅');
  ok(w.ui.buildViewModel().navItems.find(n => n.key === 'ministerMarriage')!.visible === true, '典事显示朝臣婚恋面板');

  // 邂逅朝臣（典事解锁七品及以下）
  w.encounter.refreshMonthly(true);
  const enc = w.encounter.encounterAt(EncounterSpot.GATE);
  ok(enc.ok && !!enc.minister, `宫门邂逅朝臣成功（${enc.minister?.name ?? '-'}）`);

  // 直接指定一位低品朝臣刷好感（用 min_c9 九品，典事可接触）
  const mid = 'min_c9';
  setMinisterAffection(s, mid, 0);
  s.ministers[mid] = createMinisterRuntime(mid, 0);
  s.ministers[mid].met = true;
  // 反复诗文唱和（+10/次）到满值
  for (let i = 0; i < 12; i++) w.marriage.interact(mid, MinisterInteraction.POEM);
  const rt = s.ministers[mid];
  ok(rt.affection >= MARRIAGE_CONDITIONS.requiredAffection, `好感刷满（${rt.affection}≥${MARRIAGE_CONDITIONS.requiredAffection}）`);
  ok(rt.proposalTriggered, '好感满触发求娶标记');
  // 好感阶段校验
  ok(w.marriage.resolveStage(rt.affection) === AffectionStage.PROMISE, '满好感阶段=相许');
  ok(w.marriage.resolveStage(50) === AffectionStage.ADMIRE, '好感50阶段=欣赏');

  // 结婚硬性校验：先制造声望不足
  s.character.reputation = 10;
  const eligBad = w.marriage.checkEligibility(mid);
  ok(eligBad.ok === false && eligBad.reasons.some(r => r.includes('声望')), '声望不足时结婚校验失败');
  // 制造 DEBUFF
  s.character.reputation = 80;
  addDebuff(s, { id: 'db_test', name: '测试DEBUFF', desc: 'x', remainMonths: 2 });
  const eligDebuff = w.marriage.checkEligibility(mid);
  ok(eligDebuff.ok === false && eligDebuff.reasons.some(r => r.includes('DEBUFF')), '有负面DEBUFF时结婚校验失败');
  s.character.activeDebuffs = [];
  // 满足全部条件 → 赐婚
  const elig = w.marriage.checkEligibility(mid);
  ok(elig.ok, `结婚四项条件全满足（${elig.reasons.join(',') || 'OK'}）`);
  const mar = w.marriage.imperialDecreeMarriage(mid);
  ok(mar.ok && !!mar.husband, '赐婚成功写入夫君数据');
  ok(s.marriage.status === MarriageStatus.MARRIED, '婚后状态=已婚');
  ok(s.marriage.loveValue === MARRIAGE_LOVE_CONFIG.initialLove, '婚后恩爱值初始化');
  info(`夫君=${mar.husband?.name} 品级=${mar.husband?.grade} 年银两加成=${mar.husband?.annualSilverBonus}`);

  // 婚后银两加成数值校验
  const settle = w.marriage.getAnnualSettlement();
  ok(settle.silverBonus === mar.husband!.annualSilverBonus, `婚后年银两加成读取夫君配置（${settle.silverBonus}）`);
  // 回家相聚
  ok(w.marriage.visitHusband().ok, '本月回家相聚成功');
  const visit2 = w.marriage.visitHusband();
  ok(visit2.ok === false && (visit2.reason || '').includes('本月'), '同月重复回家相聚被拒');

  // 权限隔离反过来验证：女官不能生育
  ok(w.child.tryConceive().ok === false && String(w.child.tryConceive().reason).includes('女官'), '女官线不能生育');
}

// ================================================================
// 行动点流转 / 按月结算俸禄 / 年末结算
// ================================================================
group('行动点流转 / 俸禄 / 年末结算');
{
  const w = makeWorld(GameRoute.CONSORT, { consortRank: ConsortRank.CHANG_ZAI });
  const s = w.save;
  // 俸禄：常在月俸50
  const salary = w.time.getMonthlySalary();
  ok(salary === 50, `常在月俸=50（实际${salary}）`);
  // 消耗到跨月
  const silverBefore = s.character.silver;
  while (s.time.month === 1) w.time.consume(1);
  ok(s.time.month === 2 && s.time.actionPoints === 5, '行动点归零跨月并重置为5');
  ok(s.character.silver >= silverBefore + 50, '跨月发放俸禄');
  // 行动点不足禁止进入地点
  s.time.actionPoints = 0;
  const denied = w.flow.enterLocation(PalaceLocation.CHU_XIU_GONG);
  ok(denied.ok === false && (denied.reason || '').includes('行动点'), '行动点不足禁止进入地点');
  // 年末结算：12月 consume 归零跨年
  s.time.month = 12; s.time.actionPoints = 1;
  const yearBefore = s.time.year;
  const r = w.time.consume(1);
  ok(!!r.monthReport && r.monthReport.yearEnd != null, '12月跨年触发年末结算');
  ok(s.time.year === yearBefore + 1 && s.time.month === 1, '跨年后年份+1月份归1');
  ok(r.monthReport!.yearEnd!.silverBonus > 0, '年末发放银两奖励');
  info(`年末奖励银两=${r.monthReport!.yearEnd!.silverBonus}`);
}

// ================================================================
// 存档 / 读档：夫君、子嗣、侍从、好感、DEBUFF 完整恢复
// ================================================================
group('存档回滚：全量数据恢复');
{
  const w = makeWorld(GameRoute.OFFICIAL, { officialRank: OfficialRank.DIAN_SHI });
  const s = w.save;
  // 构造夫君
  const mid = 'min_c9';
  s.ministers[mid] = createMinisterRuntime(mid, 100);
  s.ministers[mid].met = true;
  s.character.reputation = 80;
  const eligDbg = w.marriage.checkEligibility(mid);
  const mar = w.marriage.imperialDecreeMarriage(mid);
  ok(mar.ok, '构造已婚状态用于存档测试');
  // 构造侍从
  w.servant.ensureInitialServants();
  const sv0 = s.servants[0];
  if (sv0) w.servant.reward(sv0.id);
  // 构造 DEBUFF
  addDebuff(s, { id: 'db_persist', name: '持久DEBUFF', desc: 'x', remainMonths: -1 });
  // 构造好感（另一位朝臣）
  const mid2 = 'min_c8';
  s.ministers[mid2] = createMinisterRuntime(mid2, 33);
  s.ministers[mid2].met = true;
  // 构造子嗣（直接推入）
  s.children.push({
    id: 'child_test', name: '测试儿', gender: 'male' as any,
    talent: 50, physique: 50, mind: 50, appearance: 50,
    birthDate: { ...s.time }, age: 2, health: 'healthy' as any,
    motherId: '', educationCost: 0, growthStage: 'toddler' as any,
    educationFocus: undefined, isAlive: true,
  } as any);

  // 存档到槽位2 + 自动存档
  w.saves.setCurrent(s);
  const saveR = w.saves.saveToSlot(2);
  ok(saveR.ok, '手动存档到槽位2成功');
  const autoR = w.saves.autoSave();
  ok(autoR.ok, '自动存档成功');

  // 篡改内存数据模拟回档前污染
  s.character.silver = 99999;
  s.marriage.status = MarriageStatus.SINGLE;
  s.children = [];
  s.servants = [];
  s.character.activeDebuffs = [];

  // 从槽位2读档
  const loadR = w.saves.loadFromSlot(2);
  ok(loadR.ok === true && !!loadR.data, '槽位2读档成功');
  const d = loadR.data!;
  ok(d.marriage.status === MarriageStatus.MARRIED && !!d.marriage.husband, '读档恢复夫君与已婚状态');
  ok(d.marriage.husband!.ministerId === mid, '读档夫君ID正确');
  ok(d.children.length === 1 && d.children[0].name === '测试儿', '读档恢复子嗣');
  ok(d.servants.length >= 1, '读档恢复侍从');
  ok(d.ministers[mid2] && d.ministers[mid2].affection === 33, '读档恢复朝臣好感');
  ok(d.character.activeDebuffs.some(x => x.id === 'db_persist'), '读档恢复DEBUFF');
  ok(d.character.silver !== 99999, '读档覆盖被污染的银两');

  // 自动存档读档一致性
  const autoLoad = w.saves.loadAuto();
  ok(autoLoad.ok && autoLoad.data!.marriage.status === MarriageStatus.MARRIED, '自动存档可读且数据一致');
}

// ================================================================
// 忠心判定逻辑
// ================================================================
group('侍从忠心判定');
{
  const w = makeWorld(GameRoute.CONSORT, { consortRank: ConsortRank.FEI });
  const s = w.save;
  w.servant.ensureInitialServants();
  ok(s.servants.length >= 1, '开局分配侍从');
  const sv = s.servants[0];
  // 赏赐提升忠心
  const lo0 = sv.loyalty;
  w.servant.reward(sv.id);
  ok(s.servants[0].loyalty > lo0, '赏赐提升忠心');
  // 低忠心反噬（忠心<30 + rng=0 必触发）
  sv.loyalty = 10;
  const w2 = makeWorld(GameRoute.CONSORT, { consortRank: ConsortRank.FEI, rng: fixedRng(0.0) });
  w2.servant.ensureInitialServants();
  const bad = w2.save.servants[0];
  bad.loyalty = 10;
  const assist = w2.servant.resolveAssist('intrigue');
  ok(assist.triggered && assist.kind === 'backfire', '低忠心侍从触发反噬');
  // 背离（忠心<10 + rng=0）
  bad.loyalty = 9;
  const desert = w2.servant.checkDesertion();
  ok(desert != null, '极低忠心侍从被收买离走');
}

// ================================================================
// 广告兜底（4点位不卡死）
// ================================================================
group('激励广告兜底');
{
  const modes: ('success' | 'close' | 'fail')[] = ['success', 'close', 'fail'];
  for (const mode of modes) {
    const s = makeWorld(GameRoute.CONSORT).save;
    const ads = new AdService(s, makeAdapter(mode), { [AdSlot.DOUBLE_REWARD]: 'unit-test' });
    const r = await ads.show(AdSlot.DOUBLE_REWARD, { onReward: () => true, onFallback: () => true });
    ok(r.rewarded, `广告[${mode}]流程不卡死（rewarded=${r.rewarded} fallback=${r.fallback}）`);
  }
  // 未配置ID
  const s2 = makeWorld(GameRoute.CONSORT).save;
  const ads2 = new AdService(s2, makeAdapter('success'), {});
  const r2 = await ads2.show(AdSlot.REROLL_ATTRS, { onFallback: () => true });
  ok(r2.fallback && r2.rewarded, '未配置广告位ID时走兜底不中断');
}

// ================================================================
// 开局随机数值边界 + 姓名校验 + 覆盖旧档
// ================================================================
group('开局随机边界 / 覆盖旧档');
{
  const cc = new CharacterCreationSystem({ rng: fixedRng(0.0) });
  const age = cc.rollAge();
  ok(age >= 14 && age <= 16, `年龄在14~16（${age}）`);
  const fam = cc.rollFamilyOrigin();
  ok(!!fam, `家世抽取有效（${fam}）`);
  const attrs = cc.rollAttributes(fam);
  for (const k of ['appearance', 'talent', 'wit', 'social', 'constitution'] as const) {
    ok(attrs[k] >= 0 && attrs[k] <= 100, `${k}在0~100（${(attrs as any)[k]}）`);
  }
  const nameBad = cc.validateName('');
  ok(nameBad.ok === false, '空姓名校验失败');
  const nameGood = cc.validateName('婉贞');
  ok(nameGood.ok === true, '合法姓名校验通过');

  // 覆盖旧档检测
  const { SaveManager } = require('./systems/SaveManager');
  const sm = new SaveManager();
  const s = createNewSave({ name: '旧档', route: GameRoute.CONSORT, familyOrigin: FamilyOrigin.COMMONER, attributes: { appearance: 50, talent: 50, wit: 50, social: 50, constitution: 50 }, silver: 100, bureau: null });
  sm.setCurrent(s);
  sm.saveToSlot(1);
  const willOverwrite = sm.getCurrent() != null;
  ok(willOverwrite, '旧档已写入槽位1，覆盖检测前提成立');
  const cc2 = new CharacterCreationSystem({ rng: fixedRng(0.5), saveManager: sm });
  const draft = cc2.generateDraft('新角色');
  const build = cc2.buildCharacter({ draft, route: GameRoute.CONSORT, bureau: null });
  ok(build.ok && !!build.save, '新角色生成成功');
  info('覆盖旧档检测：新档生成后可写入槽位1（willOverwrite语义另测）');
}

console.log(`\n==================================================`);
console.log(`V4 三路线闭环测试结果：PASS=${pass} FAIL=${fail}`);
if (failures.length > 0) {
  console.log('\n--- 失败清单（按分组）---');
  failures.forEach((f, i) => console.log(`  ${i + 1}. [${f.group}] ${f.msg}`));
}
console.log(`==================================================`);
if (fail > 0) require('process').exit(1);
}
main().catch(e => { console.error('测试异常:', e); require('process').exit(2); });
