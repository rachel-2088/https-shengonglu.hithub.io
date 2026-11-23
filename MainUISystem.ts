/**
 * 主界面串联系统 —— 构建主界面视图模型（顶部栏 / 大地图 / 底部导航），按路线动态显隐。
 * ⚠️ 本系统只产出"视图模型（ViewModel）"，UI 层（Cocos 场景脚本）只读渲染，不含 Cocos API，便于测试。
 * ⚠️ 读档后可由 save 完整重建，保证 UI 状态与存档一致。
 */
import {
  GameRoute,
  MainUIViewModel,
  MapPointViewModel,
  NavItem,
  TopBarViewModel,
} from '../types/types';
import {
  getConsortConfig,
  getMaidRankConfig,
  getOfficialConfig,
  getRouteConfig,
  TIME_CONFIG,
} from '../config/GameConfig';
import { GameSaveData } from '../types/types';
import { MapSystem } from '../systems/MapSystem';
import { PromotionSystem } from '../systems/PromotionSystem';
import { gameEvents, GameEvent } from '../core/EventBus';

export class MainUISystem {
  constructor(
    private save: GameSaveData,
    private map: MapSystem,
    private promotion: PromotionSystem,
  ) {}

  /** 构建完整视图模型（每次进入主界面/读档后调用） */
  buildViewModel(): MainUIViewModel {
    return {
      topBar: this.buildTopBar(),
      navItems: this.buildNavItems(),
      mapPoints: this.buildMapPoints(),
    };
  }

  /** 顶部栏：年月/行动点/银两/位分/路线标识 */
  private buildTopBar(): TopBarViewModel {
    const c = this.save.character;
    const routeCfg = getRouteConfig(c.route);
    let rankName = '';
    if (c.route === GameRoute.CONSORT) rankName = getConsortConfig(c.consortRank!)?.name ?? '秀女';
    else if (c.route === GameRoute.MAID) rankName = getMaidRankConfig(c.maidRank!)?.name ?? '粗使宫女';
    else if (c.route === GameRoute.OFFICIAL) rankName = getOfficialConfig(c.officialRank!)?.name ?? '女史';

    return {
      year: this.save.time.year,
      month: this.save.time.month,
      actionPoints: this.save.time.actionPoints,
      actionPointMax: TIME_CONFIG.actionPointMax,
      silver: c.silver,
      rankName,
      routeName: routeCfg?.name ?? '未知',
      routeTag: c.route,
    };
  }

  /**
   * 底部导航显隐（核心权限隔离）：
   *   - 子嗣面板：仅妃嫔线显示（宫女/女官隐藏）
   *   - 朝臣/婚恋面板：仅女官线显示，且职级到典事后才可用
   *   - 妃嫔线：显示帝宠/嫔妃入口（此处以 nav 项体现），隐藏朝臣婚恋
   *   - 宫女线：隐藏子嗣、隐藏朝臣婚恋
   *   - 女官线：隐藏帝宠、嫔妃博弈、子嗣
   */
  private buildNavItems(): NavItem[] {
    const route = this.save.character.route;
    const items: NavItem[] = [
      { key: 'attributes', label: '属性', visible: true },
      { key: 'inventoryShop', label: '背包商店', visible: true },
      { key: 'servants', label: '侍从', visible: true },
      { key: 'children', label: '子嗣', visible: false },
      { key: 'duties', label: '差事', visible: true },
      { key: 'ministerMarriage', label: '朝臣/婚恋', visible: false },
      { key: 'saveLoad', label: '存档', visible: true },
      { key: 'consortIntrigue', label: '帝宠/嫔妃', visible: false },
      { key: 'maidBranch', label: '宫女分支', visible: false },
    ];

    const set = (key: string, visible: boolean, reason?: string) => {
      const it = items.find((i) => i.key === key);
      if (it) { it.visible = visible; it.reason = reason; }
    };

    if (route === GameRoute.CONSORT) {
      set('children', true);
      set('consortIntrigue', true);
      if (!this.promotion.isChildSystemUnlocked()) {
        set('children', false, '位分达贵人后解锁子嗣系统');
      }
    } else if (route === GameRoute.MAID) {
      set('maidBranch', true);
      // 宫女转线后若已携带子嗣（宠幸进封），按妃嫔逻辑显示——由转线系统切换 route，此处遵循 route
    } else if (route === GameRoute.OFFICIAL) {
      const unlocked = this.promotion.isMinisterSystemUnlocked();
      set('ministerMarriage', unlocked, unlocked ? undefined : '职级达典事后解锁朝臣婚恋');
    }

    return items;
  }

  /** 地图点位：按路线标记可进入/置灰原因 */
  private buildMapPoints(): MapPointViewModel[] {
    return this.map.listAvailable().map(({ config, available, reason }) => ({
      id: config.id,
      name: config.name,
      desc: config.desc,
      enabled: available,
      reason,
    }));
  }

  /** 推送视图模型刷新事件（UI 层订阅后重绘） */
  refresh(): MainUIViewModel {
    const vm = this.buildViewModel();
    gameEvents.emit(GameEvent.UI_REFRESH, vm);
    return vm;
  }
}
