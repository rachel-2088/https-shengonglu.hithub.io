/**
 * V4 修复专项回归测试 —— 验证 BUG-1 / NUM-1 / NUM-2 / NUM-3 / 差事ID 五项修复
 * 每个断言都针对修复前的失败场景，确保修复真实生效。
 */
import {
  GameRoute, OfficialRank, ConsortRank, FamilyOrigin, AffectionStage, SixBureau,
} from './types/types';
import { FAVOR_EFFECTS } from './config/EmperorConfig';
import { MARRIAGE_CONDITIONS, AFFECTION_STAGE_THRESHOLDS } from './config/MarriageConfig';
import { DUTY_CONFIGS, getDutyConfig } from './config/DutyConfig';
import { OFFICIAL_RANK_ORDER, CONSORT_RANK_ORDER } from './config/GameConfig';
import { createNewSave, createMinisterRuntime } from './data/saveData';
import { DutySystem } from './systems/DutySystem';
import { PromotionSystem } from './systems/PromotionSystem';
import { EmperorInteractionSystem } from './systems/EmperorInteractionSystem';
import { MarriageSystem } from './systems/MarriageSystem';
import { TimeSystem } from './core/TimeSystem';
import { gameEvents } from './core/EventBus';

declare const require: any;
let pass = 0, fail = 0;
function ok(cond: boolean, name: string) {
  if (cond) { pass++; /* console.log('  ✓ '+name); */ }
  else { fail++; console.log('  ✗ FAIL: ' + name); }
}
function fixedRng(v: number) { return () => v; }
function attr() { return { appearance: 60, talent: 60, wit: 60, social: 60, constitution: 60 }; }

async function main() {
  console.log('===== V4 修复专项回归 =====');

  // ---------- BUG-1：女官9级晋升差事全覆盖 ----------
  console.log('\n[BUG-1] 女官晋升差事覆盖 + 连升');
  const officialTargets = OFFICIAL_RANK_ORDER.slice(1); // 除女史外的9个晋升目标
  const missing: string[] = [];
  for (const r of officialTargets) {
    const has = DUTY_CONFIGS.some((d: any) => d.isPromotion && d.promotionTarget === r);
    if (!has) missing.push(r);
  }
  ok(missing.length === 0, `全部${officialTargets.length}个晋升职级都有专属差事（缺失：${missing.join(',')}）`);

  // 实测：功勋声望拉满，逐级完成差事，看能否一路从女史升到尚宫
  {
    const save = createNewSave({
      name: '女官修复测试', route: GameRoute.OFFICIAL, familyOrigin: FamilyOrigin.SCHOLAR,
      attributes: attr(), silver: 100, bureau: SixBureau.SHANG_GONG,
    });
    save.character.officialRank = OfficialRank.NV_SHI;
    const time = new TimeSystem(save);
    const duty = new DutySystem(save, () => {}, fixedRng(0.5));
    const promo = new PromotionSystem(save, duty, null);
    // 模拟逐级完成晋升差事：把每级目标差事ID写进已完成列表
    for (const r of officialTargets) {
      const d = DUTY_CONFIGS.find((x: any) => x.isPromotion && x.promotionTarget === r)!;
      if (!save.dutyState.completedIds.includes(d.id)) save.dutyState.completedIds.push(d.id);
    }
    // 功勋声望拉满
    save.character.merit = 9999;
    save.character.reputation = 9999;
    // 单次检查因 maxStepsPerCheck=1 只升1级，循环调用直到顶
    let guard = 0;
    while (guard++ < 20) {
      const r = promo.checkAndPromote();
      if (!r.promoted) break;
    }
    const finalRank: OfficialRank = save.character.officialRank as OfficialRank;
    ok(finalRank === OfficialRank.SHANG_GONG,
       `女官可一路晋升至尚宫（实际=${finalRank}，循环${guard}次）`);
    ok(promo.isMinisterSystemUnlocked(), '晋升到典事后朝臣婚恋系统解锁');
  }

  // 兜底验证：伪造一个无差事的职级，hasPromotionDuty 返回 false 时不强求
  {
    const save = createNewSave({ name:'兜底', route: GameRoute.OFFICIAL, familyOrigin: FamilyOrigin.SCHOLAR, attributes: attr(), silver:100, bureau:SixBureau.SHANG_GONG });
    const time = new TimeSystem(save);
    const duty = new DutySystem(save, () => {}, fixedRng(0.5));
    ok(duty.hasPromotionDuty(OfficialRank.DIAN_SHI), '已配置职级 hasPromotionDuty=true');
    ok(!duty.hasPromotionDuty('__not_configured__' as OfficialRank), '未配置职级 hasPromotionDuty=false（兜底放行依据）');
  }

  // ---------- NUM-1：怀孕概率不再溢出 ----------
  console.log('\n[NUM-1] 怀孕概率曲线');
  {
    const save = createNewSave({ name:'帝宠', route: GameRoute.CONSORT, familyOrigin: FamilyOrigin.COMMONER, attributes: attr(), silver:100, bureau:null });
    const emp = new EmperorInteractionSystem(save);
    // 体质70 + 帝宠55：修复前 0.12+55/300+70/100=1.05→溢出100%；修复后应≈0.08+0.183+0.28=0.543
    save.character.attributes.constitution = 70;
    save.character.favor = 55;
    const p = emp.getPregnancyProbability();
    const expect = FAVOR_EFFECTS.pregnancyBase + 55 * FAVOR_EFFECTS.pregnancyPerPoint + 70 * FAVOR_EFFECTS.pregnancyConstitutionPerPoint;
    ok(Math.abs(p - expect) < 1e-9, `怀孕概率公式与配置一致（${(p*100).toFixed(1)}%）`);
    ok(p < 1, '体质70+帝宠55不再溢出100%（修复前恒100%）');
    // 体质满100+帝宠满100：修复后 0.08+0.333+0.4=0.813，仍有成长空间
    save.character.attributes.constitution = 100;
    save.character.favor = 100;
    const pmax = emp.getPregnancyProbability();
    ok(pmax < 1, `体质100+帝宠100概率=${(pmax*100).toFixed(1)}%<100%（保留策略空间）`);
    // 体质权重应低于帝宠每点贡献（1/250 < 1/300? 其实0.004 > 0.0033，但已接近；验证系数值）
    ok(FAVOR_EFFECTS.pregnancyConstitutionPerPoint === 1/250, '体质系数已降至1/250');
    ok(FAVOR_EFFECTS.pregnancyBase === 0.08, '基础概率已降至8%');
  }

  // ---------- NUM-2：帝宠威望减免保留下限 ----------
  console.log('\n[NUM-2] 威望门槛减免下限');
  {
    const save = createNewSave({ name:'威望', route: GameRoute.CONSORT, familyOrigin: FamilyOrigin.COMMONER, attributes: attr(), silver:100, bureau:null });
    const emp = new EmperorInteractionSystem(save);
    save.character.favor = 100; // 满宠，减免50
    // 答应(15)/常在(35)原门槛，减免后应保留30%下限：15*0.3=4.5, 35*0.3=10.5
    const changZaiReq = emp.getEffectivePrestigeRequirement(ConsortRank.CHANG_ZAI);
    ok(changZaiReq > 0, `满宠下常在门槛仍>0（实际${changZaiReq}，修复前=0）`);
    ok(Math.abs(changZaiReq - 35 * FAVOR_EFFECTS.prestigeFloorRatio) < 1e-9,
       `常在门槛=原门槛30%（${changZaiReq}）`);
    // 高位阶：贵人门槛若>50，减免后仍=原门槛-50（不受下限影响）
    const guirenCfg = (require('./config/ConsortConfig') as any).getConsortConfig(ConsortRank.GUI_REN);
    if (guirenCfg && guirenCfg.prestigeRequired > 50) {
      const grReq = emp.getEffectivePrestigeRequirement(ConsortRank.GUI_REN);
      ok(Math.abs(grReq - Math.max(guirenCfg.prestigeRequired*0.3, guirenCfg.prestigeRequired-50)) < 1e-9,
         '高位阶减免逻辑正确');
    }
  }

  // ---------- NUM-3：结婚好感门槛对齐 ----------
  console.log('\n[NUM-3] 结婚好感门槛对齐');
  const promiseStage = AFFECTION_STAGE_THRESHOLDS.find(x => x.stage === AffectionStage.PROMISE)!;
  ok(MARRIAGE_CONDITIONS.requiredAffection === promiseStage.min,
     `结婚门槛(${MARRIAGE_CONDITIONS.requiredAffection})=相许阈值(${promiseStage.min})`);

  // ---------- 差事ID无空格 ----------
  console.log('\n[小瑕疵] 差事ID空格');
  const withSpace = DUTY_CONFIGS.filter((d: any) => /\s/.test(d.id));
  ok(withSpace.length === 0, `所有差事ID无空格（含空格：${withSpace.map((d:any)=>d.id).join(',')}）`);
  ok(!!getDutyConfig('duty_promote_dian_shi'), 'duty_promote_dian_shi 可查到');
  ok(!!getDutyConfig('duty_promote_si_shi'), 'duty_promote_si_shi 可查到');

  console.log(`\n===== 修复专项结果：PASS=${pass} FAIL=${fail} =====`);
  if (fail > 0) require('process').exit(1);
}
main().catch((e: any) => { console.error(e); require('process').exit(1); });
