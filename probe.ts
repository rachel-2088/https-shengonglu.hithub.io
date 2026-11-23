declare const require: any;
import { TimeSystem } from './core/TimeSystem';
import { MapSystem } from './systems/MapSystem';
import { DutySystem } from './systems/DutySystem';
import { MinisterEncounterSystem } from './systems/MinisterEncounterSystem';
import { PromotionSystem } from './systems/PromotionSystem';
import { MaidTransitionSystem } from './systems/MaidTransitionSystem';
import { MarriageSystem } from './systems/MarriageSystem';
import { ChildSystem } from './systems/ChildSystem';
import { EmperorInteractionSystem } from './systems/EmperorInteractionSystem';
import { MainUISystem } from './ui/MainUISystem';
import { SaveManager } from './systems/SaveManager';
import { GameFlowSystem } from './systems/GameFlowSystem';
import { createNewSave, rawRemove, getSlotKey, SAVE_KEY, AUTOSAVE_KEY, addDebuff } from './data/saveData';
import { GameRoute, FamilyOrigin, ConsortRank, OfficialRank, MaidRank, SixBureau } from './types/types';
import {
  FAVOR_EFFECTS, CONSORT_RANK_CONFIGS, OFFICIAL_RANK_ORDER, getOfficialConfig,
  MARRIAGE_CONDITIONS, getConsortConfig, CHILDBIRTH_CONFIG,
} from './config/GameConfig';

function fixedRng(v: number) { return () => v; }
function makeWorld(route: GameRoute, o: any = {}) {
  const save = createNewSave({
    name: 'probe', route, familyOrigin: o.family ?? FamilyOrigin.NOBLE,
    attributes: { appearance: o.appearance ?? 70, talent: 70, wit: 70, social: 70, constitution: o.constitution ?? 70 },
    silver: 500, bureau: route === GameRoute.CONSORT ? null : SixBureau.SHANG_GONG,
  });
  if (o.consortRank) save.character.consortRank = o.consortRank;
  if (o.officialRank) save.character.officialRank = o.officialRank;
  if (o.maidRank) save.character.maidRank = o.maidRank;
  if (o.merit != null) save.character.merit = o.merit;
  if (o.reputation != null) save.character.reputation = o.reputation;
  if (o.favor != null) save.character.favor = o.favor;
  [SAVE_KEY, AUTOSAVE_KEY, getSlotKey(1)].forEach(k => rawRemove(k));
  const persist = () => {};
  const rng = fixedRng(0.5);
  const time = new TimeSystem(save, persist, rng);
  const map = new MapSystem(save, time, rng);
  const duty = new DutySystem(save, persist, rng);
  const encounter = new MinisterEncounterSystem(save, persist, rng);
  const emperor = new EmperorInteractionSystem(save, persist, rng);
  const promotion = new PromotionSystem(save, duty, emperor, persist);
  const transition = new MaidTransitionSystem(save, persist);
  const marriage = new MarriageSystem(save, persist);
  const child = new ChildSystem(save, persist, rng, emperor);
  const ui = new MainUISystem(save, map, promotion);
  const saves = new SaveManager(save);
  const flow = new GameFlowSystem(save, time, map, duty, encounter, promotion, transition, ui, saves, 1);
  return { save, time, map, duty, encounter, emperor, promotion, transition, marriage, child, ui, saves, flow };
}

console.log('\n==================== 深度探查报告 ====================\n');

// ---- 探查1：怀孕概率溢出曲线 ----
console.log('【探查1】怀孕概率公式溢出分析（公式 = 12% + 帝宠/300 + 体质/100，上限100%）');
const conProbe = makeWorld(GameRoute.CONSORT, { consortRank: ConsortRank.GUI_REN });
for (const constitution of [30, 50, 70, 90]) {
  conProbe.save.character.attributes.constitution = constitution;
  for (const favor of [0, 35, 55, 85, 100]) {
    conProbe.save.character.favor = favor;
    const raw = FAVOR_EFFECTS.pregnancyBase + favor * FAVOR_EFFECTS.pregnancyPerPoint + constitution * FAVOR_EFFECTS.pregnancyConstitutionPerPoint;
    const real = conProbe.child.getConceptionProbability();
    const overflow = raw > 1 ? ' ⚠️溢出钳制' : '';
    console.log(`  体质${constitution} 帝宠${favor}: 原始=${(raw*100).toFixed(1)}% 实际=${(real*100).toFixed(1)}%${overflow}`);
  }
}
console.log('  → 结论：体质≥70时即便帝宠0，概率也已达82%；体质70+帝宠55即100%。体质对生育影响过强。');

// ---- 探查2：女官晋升差事卡点 ----
console.log('\n【探查2】女官晋升"专属差事"卡点分析');
const off = makeWorld(GameRoute.OFFICIAL, { officialRank: OfficialRank.NV_SHI, merit: 1000, reputation: 1000 });
const p1 = off.promotion.checkAndPromote();
console.log(`  功勋1000+声望1000，女史→下一级：promoted=${p1.promoted} toRank=${p1.toRank}`);
console.log(`  原因：OFFICIAL路线 requireDuty=${true}，需 isPromotionDone(目标职级)，未做专属差事则永远卡住。`);
console.log(`  差事池当前路线分类可用数=${off.duty.getAvailableDuties().length}`);
// 检查差事是否能覆盖所有晋升职级
const offCfg = OFFICIAL_RANK_ORDER.slice(1); // 除女史外都需晋升
console.log(`  女官晋升目标职级数=${offCfg.length}（${offCfg.join(',')}）`);
console.log('  → 需确认每个晋升职级都有对应的专属差事 dutyPromotionRank，否则该级永远无法晋升。');

// ---- 探查3：宫女宠幸转线无品级门槛 ----
console.log('\n【探查3】宫女宠幸转答应的品级门槛');
const maidLow = makeWorld(GameRoute.MAID, { maidRank: MaidRank.CU_SHI, family: FamilyOrigin.COMMONER });
const tr = maidLow.transition.imperialFavorPromotion();
console.log(`  粗使宫女（最低品级）直接宠幸进封：ok=${tr.ok} newRank=${tr.newRank}`);
console.log('  → canTransit() 仅检查 route==MAID，无 maidRank≥掌事姑姑门槛；粗使宫女可一步登天转妃嫔。');

// ---- 探查4：帝宠减免导致威望门槛归零 ----
console.log('\n【探查4】妃嫔晋升威望门槛帝宠减免');
for (const cfg of CONSORT_RANK_CONFIGS.slice(1, 5)) {
  const relief = 100 * FAVOR_EFFECTS.prestigeThresholdReliefPerPoint; // 满宠
  const eff = Math.max(0, cfg.prestigeRequired - relief);
  console.log(`  ${cfg.name}: 配置威望${cfg.prestigeRequired} → 满宠减免50 → 实际${eff}（帝宠仍需${cfg.favorRequired}）`);
}
console.log('  → 满宠可减免50威望，中低位阶（答应15/常在35）门槛直接归零，只靠帝宠即可晋升。');

// ---- 探查5：永久DEBUFF存档往返 ----
console.log('\n【探查5】永久DEBUFF(remainMonths=-1)存档往返');
const dbw = makeWorld(GameRoute.CONSORT, { consortRank: ConsortRank.CHANG_ZAI });
addDebuff(dbw.save, { id: 'db_perm', name: '永久测试', desc: 'x', remainMonths: -1 });
dbw.saves.setCurrent(dbw.save);
dbw.saves.saveToSlot(1);
const loaded = dbw.saves.loadFromSlot(1);
const perm = loaded.data!.character.activeDebuffs.find(d => d.id === 'db_perm');
console.log(`  永久DEBUFF存档往返：保留=${!!perm} remainMonths=${perm?.remainMonths}`);
// 跨月看是否被清掉
dbw.time.advanceMonth();
const stillThere = dbw.save.character.activeDebuffs.find(d => d.id === 'db_perm');
console.log(`  跨月后永久DEBUFF：保留=${!!stillThere}（TimeSystem对remainMonths<0直接return true保留）`);

// ---- 探查6：结婚硬性条件满好感需求 ----
console.log('\n【探查6】女官结婚好感门槛与阶段映射');
console.log(`  结婚所需好感=${MARRIAGE_CONDITIONS.requiredAffection}，相许阶段阈值=${96}`);
console.log(`  四类互动单次增量：送礼8 / 诗文10 / 相助12 / 朝堂6；喜好礼物额外+6`);
console.log(`  → 从0到${MARRIAGE_CONDITIONS.requiredAffection}需诗文约${Math.ceil(MARRIAGE_CONDITIONS.requiredAffection/10)}次；无自然衰减时约需3个月每月互动，节奏合理。`);

console.log('\n==================== 探查结束 ====================\n');
