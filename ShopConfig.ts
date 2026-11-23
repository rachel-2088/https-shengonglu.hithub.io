/**
 * 背包商店数值配置表 —— 道具全字段 / 商店每月刷新 / 背包容量
 * ------------------------------------------------------------------
 * 道具 ID 兼容三套已落地系统的引用：
 *   - 朝臣喜好（MinisterConfig）：brush_painting / plain_silk / fine_incense / pearl_jewelry / brocade
 *   - 嫔妃喜好（ConsortNpcConfig）：silk_brocade / calligraphy / rare_incense / pearl_jewelry
 *   - 侍从赏赐（ServantConfig）：tonic_common / tonic_fine / plain_silk / brocade / pearl_jewelry
 * 价格对齐需求原始商店表（普通补品25/精致补品60/素色绸缎30/织金锦缎70/寻常香料20/名贵香膏55/笔墨字画45/珍珠首饰80）。
 */
import { ItemType, ShopItemConfig } from '../types/types';

/** 全部道具静态配置（ID 稳定，勿随意更改） */
export const SHOP_ITEMS: ShopItemConfig[] = [
  // —— 补品类（可使用，加体质）——
  {
    id: 'tonic_common', name: '普通补品', price: 25, usage: 'attribute', type: ItemType.TONIC,
    effectDesc: '使用：体质 +10', giftable: true, usable: true,
    attrBonus: { constitution: 10 }, affectionBonus: 3,
  },
  {
    id: 'tonic_fine', name: '精致补品', price: 60, usage: 'attribute', type: ItemType.TONIC,
    effectDesc: '使用：体质 +22', giftable: true, usable: true,
    attrBonus: { constitution: 22 }, affectionBonus: 6,
  },
  // —— 绸缎类（送礼）——
  {
    id: 'plain_silk', name: '素色绸缎', price: 30, usage: 'gift', type: ItemType.SILK,
    effectDesc: '送礼，小幅提升好感', giftable: true, usable: false, affectionBonus: 6,
  },
  {
    id: 'brocade', name: '织金锦缎', price: 70, usage: 'gift', type: ItemType.SILK,
    effectDesc: '送礼，大幅提升好感', giftable: true, usable: false, affectionBonus: 12,
  },
  {
    id: 'silk_brocade', name: '云锦绸缎', price: 70, usage: 'gift', type: ItemType.SILK,
    effectDesc: '嫔妃喜爱的高级绸缎，大幅提升好感', giftable: true, usable: false, affectionBonus: 12,
  },
  // —— 香膏类（送礼）——
  {
    id: 'fine_incense', name: '寻常香料', price: 20, usage: 'gift', type: ItemType.INCENSE,
    effectDesc: '送礼', giftable: true, usable: false, affectionBonus: 4,
  },
  {
    id: 'rare_incense', name: '名贵香膏', price: 55, usage: 'gift', type: ItemType.INCENSE,
    effectDesc: '送礼', giftable: true, usable: false, affectionBonus: 9,
  },
  // —— 字画类（送礼，可加才情）——
  {
    id: 'brush_painting', name: '笔墨字画', price: 45, usage: 'gift', type: ItemType.PAINTING,
    effectDesc: '送礼，加才情', giftable: true, usable: true,
    attrBonus: { talent: 3 }, affectionBonus: 8,
  },
  {
    id: 'calligraphy', name: '名家法帖', price: 45, usage: 'gift', type: ItemType.PAINTING,
    effectDesc: '送礼，加才情', giftable: true, usable: true,
    attrBonus: { talent: 4 }, affectionBonus: 8,
  },
  // —— 首饰类（送礼）——
  {
    id: 'pearl_jewelry', name: '珍珠首饰', price: 80, usage: 'gift', type: ItemType.JEWELRY,
    effectDesc: '送礼，加容貌相关好感', giftable: true, usable: false, affectionBonus: 14,
  },
  // —— 差事需求品（不可送礼/不可用，专门交差）——
  {
    id: 'duty_ledger', name: '账册副本', price: 15, usage: 'duty', type: ItemType.DUTY,
    effectDesc: '女官核账差事所需', giftable: false, usable: false, requiredByDuty: 'duty_bureau_special',
  },
  {
    id: 'duty_laundry_token', name: '浣衣令牌', price: 10, usage: 'duty', type: ItemType.DUTY,
    effectDesc: '宫女浣衣差事所需', giftable: false, usable: false, requiredByDuty: 'duty_laundry',
  },
];

const ITEM_MAP: Record<string, ShopItemConfig> = {};
SHOP_ITEMS.forEach((i) => { ITEM_MAP[i.id] = i; });

/** 按 ID 查道具配置 */
export function getItemConfig(id: string): ShopItemConfig | undefined {
  return ITEM_MAP[id];
}

/** 商店配置（每月刷新货品列表 / 条目数 / 背包容量） */
export const SHOP_CONFIG = {
  /** 每月刷新的货品条目数 */
  refreshCount: 8,
  /** 背包容量上限（不同道具 ID 计一格） */
  inventoryCapacity: 30,
  /** 补给类道具在刷新池中的最低权重（保证补品常驻） */
  tonicWeight: 2,
  /** 普通货品权重 */
  normalWeight: 1,
} as const;

/** 按权重随机抽取本月货品（不重复） */
export function refreshShopStock(rng: () => number = Math.random): string[] {
  const pool = [...SHOP_ITEMS];
  const picked: string[] = [];
  const count = Math.min(SHOP_CONFIG.refreshCount, pool.length);
  while (picked.length < count && pool.length > 0) {
    const weights = pool.map((i) => (i.type === ItemType.TONIC ? SHOP_CONFIG.tonicWeight : SHOP_CONFIG.normalWeight));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll < 0) { idx = i; break; }
    }
    picked.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  return picked;
}
