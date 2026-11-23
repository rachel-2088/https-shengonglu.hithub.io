/**
 * 皇宫大地图系统 —— 总规则第 2 条
 * 内置完整皇宫地点清单，每个地点独立；进入消耗 1 行动点；
 * 进入后返回「可选操作列表 + 该地点随机事件」。
 * 朝臣邂逅点位由 MinisterEncounterSystem 单独负责刷新。
 */
import {
  EventLogType,
  GameRoute,
  GameSaveData,
  LocationConfig,
  PalaceLocation,
} from '../types/types';
import { LOCATION_CONFIGS, LOCATION_MAP } from '../config/GameConfig';
import { TimeSystem } from '../core/TimeSystem';
import { gameEvents, GameEvent } from '../core/EventBus';

/** 地点进入结果（供 UI 弹窗展示） */
export interface LocationVisitResult {
  ok: boolean;
  reason?: string;
  location: LocationConfig | null;
  /** 可选操作列表（差事/拜访/邂逅等，由 UI 渲染成按钮） */
  actions: LocationAction[];
  /** 本次触发的随机事件 ID（可能为空） */
  eventId: string | null;
}

/** 地点可选操作 */
export interface LocationAction {
  id: string;
  label: string;
  kind: 'duty' | 'visit' | 'rest' | 'encounter' | 'special';
  actionPointCost: number;
}

export class MapSystem {
  constructor(
    private save: GameSaveData,
    private time: TimeSystem,
    private random: () => number = Math.random
  ) {}

  /** 全部地点清单（UI 地图用） */
  listAll(): LocationConfig[] {
    return LOCATION_CONFIGS;
  }

  /** 按路线过滤玩家当前可去的地点（UI 显示用；不做硬性拦截，仅标记） */
  listAvailable(): { config: LocationConfig; available: boolean; reason?: string }[] {
    const route = this.save.character.route;
    return LOCATION_CONFIGS.map((config) => {
      const check = this.checkAvailability(config.id, route);
      return { config, available: check.ok, reason: check.reason };
    });
  }

  /** 路线可去性校验（礼制限制：妃嫔不可接触朝臣点位） */
  private checkAvailability(id: PalaceLocation, route: GameRoute): { ok: boolean; reason?: string } {
    const cfg = LOCATION_MAP[id];
    if (cfg.isMinisterSpot && route === GameRoute.CONSORT) {
      return { ok: false, reason: '礼制限制：妃嫔不可接触朝臣' };
    }
    if (id === PalaceLocation.HUAN_YI_JU && route === GameRoute.OFFICIAL) {
      return { ok: false, reason: '女官无浣衣局差事' };
    }
    return { ok: true };
  }

  /** 进入地点：消耗行动点 → 返回操作列表 + 随机事件 */
  enter(id: PalaceLocation): LocationVisitResult {
    const cfg = LOCATION_MAP[id];
    if (!cfg) {
      return { ok: false, reason: '地点不存在', location: null, actions: [], eventId: null };
    }
    const check = this.checkAvailability(id, this.save.character.route);
    if (!check.ok) {
      return { ok: false, reason: check.reason, location: cfg, actions: [], eventId: null };
    }

    // 消耗 1 点行动点（内部自动处理跨月）
    const cost = this.time.consume(1);
    if (!cost.ok) {
      return { ok: false, reason: cost.reason, location: cfg, actions: [], eventId: null };
    }

    const actions = this.buildActions(cfg);
    const eventId = this.rollEvent(cfg);

    this.save.eventLog.push({
      date: this.time.currentDate,
      type: EventLogType.EVENT,
      title: `前往 ${cfg.name}`,
      detail: eventId ? `触发事件：${eventId}` : '无事发生',
    });
    gameEvents.emit(GameEvent.LOCATION_ENTERED, { id, eventId });
    return { ok: true, location: cfg, actions, eventId };
  }

  /** 依据地点配置生成操作列表 */
  private buildActions(cfg: LocationConfig): LocationAction[] {
    const actions: LocationAction[] = [];
    cfg.dutyIds.forEach((dutyId, idx) => {
      actions.push({ id: dutyId, label: `执行差事·${dutyId}`, kind: 'duty', actionPointCost: 1 });
    });
    if (cfg.npcIds.length > 0) {
      actions.push({ id: 'visit_npc', label: '拜访此处人物', kind: 'visit', actionPointCost: 1 });
    }
    if (cfg.isMinisterSpot) {
      actions.push({ id: 'encounter_minister', label: '留意朝臣动静', kind: 'encounter', actionPointCost: 0 });
    }
    if (cfg.type === 'rest') {
      actions.push({ id: 'rest', label: '歇息调养（体质+8）', kind: 'rest', actionPointCost: 1 });
    }
    if (cfg.id === PalaceLocation.KU_FANG) {
      actions.push({ id: 'draw_salary', label: '领取月例俸禄', kind: 'special', actionPointCost: 0 });
    }
    return actions;
  }

  /** 随机触发该地点的一个事件（概率 50%，事件池来自配置） */
  private rollEvent(cfg: LocationConfig): string | null {
    if (cfg.eventIds.length === 0 || this.random() >= 0.5) return null;
    return cfg.eventIds[Math.floor(this.random() * cfg.eventIds.length)];
  }
}
