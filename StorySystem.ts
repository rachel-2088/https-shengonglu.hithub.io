/**
 * 剧情播放系统 —— 从 storyQueue 取剧本，填充变量，逐步播放，处理选项分支。
 * 剧情文本层核心：UI 只调本类接口，不直接碰 storyQueue 结构。
 * 变量占位符：{selfName}/{name}/{title}/{trait}。
 */
import {
  GameSaveData,
  StoryScript,
  StoryStep,
  StoryChoice,
  MaritalEventType,
} from '../types/types';
import { getMinisterConfig } from '../config/GameConfig';

/** 填充后的对话节点 */
export interface RenderedStep {
  speaker: StoryStep['speaker'];
  text: string;
  emotion?: string;
}

/** 当前剧情视图 */
export interface StoryView {
  script: StoryScript;
  step: RenderedStep;
  stepIndex: number;
  stepCount: number;
  choices: StoryChoice[] | null;
  /** 是否为最后一步 */
  isLast: boolean;
}

/** 选择结果 */
export interface ChoiceResult {
  ok: boolean;
  reason?: string;
  /** 玩家选择的选项（若有） */
  choice: StoryChoice | null;
  /** 选择是否导致婉拒（好感下降由调用方决定，剧情层只返回意图） */
  rejected: boolean;
}

export class StorySystem {
  constructor(private save: GameSaveData, private persist: () => void = () => {}) {}

  /** 队列是否有剧情 */
  hasStory(): boolean {
    return this.save.storyQueue.length > 0;
  }

  queueLength(): number {
    return this.save.storyQueue.length;
  }

  /** 取当前剧本（队首），失败的实例自动跳过 */
  current(): StoryScript | null {
    while (this.save.storyQueue.length > 0) {
      const head = this.save.storyQueue[0];
      if (!head.finished) return head;
      this.save.storyQueue.shift(); // 清理已完成
    }
    this.persist();
    return null;
  }

  /** 渲染当前步骤（含变量填充） */
  renderCurrent(): StoryView | null {
    const script = this.current();
    if (!script) return null;
    const rawStep = script.steps[script.currentStep];
    if (!rawStep) return null;
    return {
      script,
      step: { speaker: rawStep.speaker, text: this.fillVariables(rawStep.text, script.ministerId), emotion: rawStep.emotion },
      stepIndex: script.currentStep,
      stepCount: script.steps.length,
      choices: script.currentStep === script.steps.length - 1 && script.choices ? script.choices : null,
      isLast: script.currentStep === script.steps.length - 1,
    };
  }

  /** 推进一步；到末尾标记完成但不出队（留给 choose/finish 处理） */
  next(): StoryView | null {
    const script = this.current();
    if (!script) return null;
    if (script.currentStep < script.steps.length - 1) {
      script.currentStep += 1;
      this.persist();
    }
    return this.renderCurrent();
  }

  /** 玩家选择选项；选后将剧情标记完成并出队 */
  choose(choiceId: string): ChoiceResult {
    const script = this.current();
    if (!script || !script.choices) {
      return { ok: false, reason: '当前剧情无选项', choice: null, rejected: false };
    }
    const choice = script.choices.find((c) => c.id === choiceId);
    if (!choice) return { ok: false, reason: '无效选项', choice: null, rejected: false };

    script.finished = true;
    this.save.storyQueue.shift();
    this.persist();
    return { ok: true, choice, rejected: choice.outcome === 'reject' };
  }

  /** 无选项剧情的收尾：标记完成并出队 */
  finishCurrent(): boolean {
    const script = this.current();
    if (!script) return false;
    script.finished = true;
    this.save.storyQueue.shift();
    this.persist();
    return true;
  }

  /** 清空队列（如读档后重置剧情） */
  clearAll(): void {
    this.save.storyQueue = [];
    this.persist();
  }

  /** 填充文本变量 */
  private fillVariables(text: string, ministerId: string | null): string {
    const selfName = this.save.character.name || '女官';
    const cfg = ministerId ? getMinisterConfig(ministerId) : undefined;
    const name = cfg?.name ?? '夫君';
    const title = cfg?.title ?? '大人';
    const trait = cfg?.appearanceTrait ?? '温润';
    return text
      .replace(/\{selfName\}/g, selfName)
      .replace(/\{name\}/g, name)
      .replace(/\{title\}/g, title)
      .replace(/\{trait\}/g, trait);
  }
}
