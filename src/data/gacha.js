/**
 * gacha.js - 抽卡系统配置
 */
export const GACHA_CONFIG = {
  // 每次抽卡的基础费用
  baseCost: 10,
  // 每次抽卡后费用增幅
  costIncrease: 5,
  // 最大费用上限
  maxCost: 100,

  // 保底规则：每 pityCount 次未出稀有及以上，保底
  pityCount: 10,
  // 保底触发的稀有度最低要求（>= rare）
  pityMinRarity: 'rare',
  // 出稀有及以上后，计数器重置
  pityResetOnRarePlus: true
};

// 稀有度权重（归一化时会重新计算）
export const RARITY_WEIGHTS = {
  'common':    100,
  'rare':      30,
  'epic':      6,
  'legendary': 1
};

// 手牌上限
export const MAX_HAND_SIZE = 4;

/**
 * 计算当前抽卡费用
 * @param {number} drawCount - 已抽次数
 * @returns {number} 当前抽卡所需金币
 */
export function calcGachaCost(drawCount) {
  const cost = GACHA_CONFIG.baseCost + drawCount * GACHA_CONFIG.costIncrease;
  return Math.min(cost, GACHA_CONFIG.maxCost);
}
