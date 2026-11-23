/**
 * 剧情事件消费层 —— 订阅 gameEvents，把婚恋状态变化转成剧情实例入队。
 * 这是"逻辑层 → 剧情文本层"的桥：MarriageSystem 只发事件，本类负责生成剧本。
 * 剧情入队后发 STORY_READY 通知 UI 取用；剧情实例存 storyQueue，退出重进不丢。
 */
import {
  GameSaveData,
  HusbandInfo,
  MaritalEventType,
  MarriageStatus,
  MinisterInteraction,
  StoryScript,
  StoryType,
  AffectionStage,
} from '../types/types';
import {
  MARITAL_EVENT_TO_STORY,
  getMinisterConfig,
  getStoryTemplate,
} from '../config/GameConfig';
import { gameEvents, GameEvent } from '../core/EventBus';

/** 入队结果 */
export interface EnqueueResult {
  queued: boolean;
  script: StoryScript | null;
  reason?: string;
}

export class StoryEventConsumer {
  private unsubs: (() => void)[] = [];

  constructor(
    private save: GameSaveData,
    private persist: () => void = () => {}
  ) {}

  /** 启动订阅（应用初始化时调用一次） */
  start(): void {
    if (this.unsubs.length > 0) return; // 防重复订阅
    this.unsubs.push(
      gameEvents.on(GameEvent.AFFECTION_CHANGED, (p) => this.onAffectionChanged(p)),
      gameEvents.on(GameEvent.MARRIAGE_CHANGED, (p) => this.onMarriageChanged(p))
    );
  }

  /** 停止订阅（应用销毁时调用，避免内存泄漏 E-09） */
  stop(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
  }

  /** 好感变化：满值求娶标记 → 排队求娶剧情 */
  private onAffectionChanged(p: any): void {
    if (!p || p.proposalTriggered !== true) return;
    this.enqueue(StoryType.PROPOSAL, p.ministerId ?? null);
  }

  /** 婚恋变化：赐婚 / 婚后剧情 → 排队对应剧本 */
  private onMarriageChanged(p: any): void {
    if (!p) return;
    // 赐婚：status=MARRIED 且带 husband
    if (p.status === MarriageStatus.MARRIED && p.husband) {
      const husband = p.husband as HusbandInfo;
      this.enqueue(StoryType.IMPERIAL_DECREE, husband.ministerId);
      return;
    }
    // 婚后剧情：带 event（MaritalEventType）
    if (p.event) {
      const storyType = MARITAL_EVENT_TO_STORY[p.event as MaritalEventType];
      if (storyType) {
        const husbandId = this.save.marriage.husband?.ministerId ?? null;
        this.enqueue(storyType, husbandId);
      }
    }
  }

  /**
   * 生成一个剧情实例并入队。
   * 文本变量此时不填充（保留占位符），由 StorySystem 在取用时按当前存档动态填充。
   */
  enqueue(type: StoryType, ministerId: string | null): EnqueueResult {
    const tpl = getStoryTemplate(type);
    if (!tpl) return { queued: false, script: null, reason: '剧本模板不存在' };

    const instanceId = `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const script: StoryScript = {
      instanceId,
      type,
      title: tpl.title,
      // 深拷贝 steps，避免多实例共享同一对象导致进度串改
      steps: tpl.steps.map((s) => ({ ...s })),
      choices: tpl.choices ? tpl.choices.map((c) => ({ ...c })) : undefined,
      ministerId,
      triggerDate: { year: this.save.time.year, month: this.save.time.month },
      currentStep: 0,
      finished: false,
    };

    this.save.storyQueue.push(script);
    this.persist();
    gameEvents.emit(GameEvent.STORY_READY, {
      instanceId, type, title: script.title, queueLength: this.save.storyQueue.length,
    });
    return { queued: true, script };
  }

  /** 队列长度（UI 红点用） */
  queueLength(): number {
    return this.save.storyQueue.length;
  }
}
