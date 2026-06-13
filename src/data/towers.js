/**
 * towers.js - 塔默认配置
 *
 * rarity: 'common' | 'rare' | 'epic' | 'legendary'
 * atk: 每次攻击伤害 (level 1 基础值)
 * range: 攻击范围（格数, level 1 基础值）
 * cd: 攻击冷却（秒, level 1 基础值）
 * image: 贴图路径（null则自动生成占位图）
 * weight: 卡池权重（影响抽卡概率）
 * levelStats: 等级1-5对应的属性数组, 每项 { atk, range, cd }
 *   - level 1 = 基础属性 (与外层 atk/range/cd 一致)
 *   - level 5 = 最终形态
 */

// 等级属性生成器: 按倍率递增
function _lvl(baseAtk, baseRange, baseCd) {
  return [
    { atk: Math.round(baseAtk * 1.0), range: +(baseRange * 1.0).toFixed(1), cd: +(baseCd * 1.0).toFixed(1) },   // Lv.1
    { atk: Math.round(baseAtk * 1.4), range: +(baseRange * 1.05).toFixed(1), cd: +(baseCd * 0.9).toFixed(2) },   // Lv.2
    { atk: Math.round(baseAtk * 2.0), range: +(baseRange * 1.1).toFixed(1), cd: +(baseCd * 0.8).toFixed(2) },    // Lv.3
    { atk: Math.round(baseAtk * 2.8), range: +(baseRange * 1.15).toFixed(1), cd: +(baseCd * 0.7).toFixed(2) },   // Lv.4
    { atk: Math.round(baseAtk * 4.0), range: +(baseRange * 1.2).toFixed(1), cd: +(baseCd * 0.6).toFixed(2) }     // Lv.5
  ];
}

const TOWERS = [
  // ===== Common =====
  {
    id: 'archer',
    name: '弓箭手',
    rarity: 'common',
    atk: 2,
    sfxType: 'arrow',
    range: 3,
    cd: 1.2,
    color: '#78909C',
    image: null,
    animDataUrl: null,
    gridCols: 1,
    gridRows: 2,
    weight: 40,
    desc: '基础攻击塔，射程适中',
    levelStats: _lvl(2, 3, 1.2)
  },
  {
    id: 'cannon',
    name: '炮台',
    rarity: 'common',
    atk: 5,
    sfxType: 'cannonball',
    range: 2.5,
    cd: 2.0,
    color: '#607D8B',
    image: null,
    animDataUrl: null,
    weight: 35,
    desc: '范围伤害，攻速较慢',
    levelStats: _lvl(5, 2.5, 2.0)
  },
  {
    id: 'spear',
    name: '长枪兵',
    rarity: 'common',
    atk: 3,
    sfxType: 'bullet',
    range: 1.5,
    cd: 0.8,
    color: '#90A4AE',
    image: null,
    animDataUrl: null,
    weight: 30,
    desc: '近程高频攻击',
    levelStats: _lvl(3, 1.5, 0.8)
  },
  // ===== Rare =====
  {
    id: 'mage',
    name: '法师',
    rarity: 'rare',
    atk: 8,
    sfxType: 'magic',
    range: 3.5,
    cd: 1.8,
    color: '#1565C0',
    image: null,
    animDataUrl: null,
    weight: 20,
    desc: '魔法攻击，对精英有效',
    levelStats: _lvl(8, 3.5, 1.8)
  },
  {
    id: 'ice_tower',
    name: '冰霜塔',
    rarity: 'rare',
    atk: 4,
    sfxType: 'ice',
    range: 3,
    cd: 1.5,
    color: '#0288D1',
    image: null,
    animDataUrl: null,
    weight: 18,
    desc: '攻击减速敌人25%',
    levelStats: _lvl(4, 3, 1.5)
  },
  {
    id: 'sniper',
    name: '狙击手',
    rarity: 'rare',
    atk: 12,
    sfxType: 'bullet',
    range: 6,
    cd: 3.0,
    color: '#01579B',
    image: null,
    animDataUrl: null,
    weight: 15,
    desc: '超远射程，单体高伤',
    levelStats: _lvl(12, 6, 3.0)
  },
  // ===== Epic =====
  {
    id: 'thunder',
    name: '雷霆法师',
    rarity: 'epic',
    atk: 20,
    sfxType: 'magic',
    range: 4,
    cd: 2.5,
    color: '#6A1B9A',
    image: null,
    animDataUrl: null,
    weight: 8,
    desc: '闪电链攻击最多3目标',
    levelStats: _lvl(20, 4, 2.5)
  },
  {
    id: 'fortress',
    name: '要塞炮',
    rarity: 'epic',
    atk: 30,
    sfxType: 'cannonball',
    range: 3,
    cd: 4.0,
    color: '#4527A0',
    image: null,
    animDataUrl: null,
    weight: 6,
    desc: '大范围爆炸，伤害极高',
    levelStats: _lvl(30, 3, 4.0)
  },
  // ===== Legendary =====
  {
    id: 'dragon',
    name: '龙巢',
    rarity: 'legendary',
    atk: 50,
    sfxType: 'fire',
    range: 5,
    cd: 3.5,
    color: '#B71C1C',
    image: null,
    animDataUrl: null,
    gridCols: 2,
    gridRows: 2,
    weight: 2,
    desc: '喷火龙，持续燃烧伤害',
    levelStats: _lvl(50, 5, 3.5)
  }
];

export default TOWERS;
