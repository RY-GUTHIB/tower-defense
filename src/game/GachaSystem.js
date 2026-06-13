/**
 * GachaSystem.js - 抽卡系统
 *
 * 规则：
 * - 递增费用：baseCost + drawCount × costIncrease，上限 maxCost
 * - 保底：每 pityCount 次未出稀有及以上，强制稀有+
 * - 出稀有及以上后计数器重置
 * - 手牌上限 MAX_HAND_SIZE
 */
import { ConfigManager } from '../data/ConfigManager.js';
import { RARITY_WEIGHTS, MAX_HAND_SIZE } from '../data/gacha.js';
// spells 通过 ConfigManager.getSpells() 获取，支持后台动态配置

export class GachaSystem {
  constructor() {
    this.drawCount = 0;
    this.pityCounter = 0;
  }

  reset() {
    this.drawCount = 0;
    this.pityCounter = 0;
  }

  /**
   * 计算本次抽卡费用
   */
  getCurrentCost() {
    return ConfigManager.calcGachaCost(this.drawCount);
  }

  /**
   * 执行一次抽卡
   * @param {GameState} gameState
   * @returns {{success:boolean, card:object|null, reason:string}}
   */
  draw(gameState) {
    const cost = this.getCurrentCost();

    // 检查金币
    if (!gameState.spendGold(cost)) {
      return { success: false, card: null, reason: `金币不足，需要 ${cost} 金` };
    }

    // 检查手牌是否满
    if (gameState.hand.length >= MAX_HAND_SIZE) {
      // 已扣金币，归还
      gameState.addGold(cost);
      return { success: false, card: null, reason: `手牌已满 (${MAX_HAND_SIZE}/${MAX_HAND_SIZE})` };
    }

    // 执行抽卡（混合防御塔和功能牌）
    const card = this._rollCard();
    if (!card.isSpell) {
      card.level = 1; // 防御塔默认1级
    }

    // 更新计数
    this.drawCount++;
    gameState.drawCount = this.drawCount;

    // 保底逻辑
    const rarityOrder = ['common', 'rare', 'epic', 'legendary'];
    const rarityIdx = rarityOrder.indexOf(card.rarity);

    if (rarityIdx >= 1) {
      // 出了稀有+，保底计数器重置
      this.pityCounter = 0;
    } else {
      this.pityCounter++;
    }

    // 加入手牌
    gameState.addToHand(card);
    gameState.pityCounter = this.pityCounter;

    return { success: true, card, reason: '' };
  }

  /**
   * 刷新4张牌（一次抽4张，清空现有手牌）
   * @param {GameState} gameState
   * @returns {{success:boolean, cards:Array, reason:string}}
   */
  draw4(gameState) {
    const cost = this.getCurrentCost();

    // 检查金币
    if (!gameState.spendGold(cost)) {
      return { success: false, cards: [], reason: `金币不足，需要 ${cost} 金` };
    }

    // 清空现有手牌
    gameState.hand = [];
    gameState.handDisabled = [];

    // 连续抽4张
    const drawn = [];
    for (let i = 0; i < MAX_HAND_SIZE; i++) {
      const card = this._rollCard();
      if (!card.isSpell) {
        card.level = 1; // 防御塔默认1级
      }
      this.drawCount++;
      gameState.drawCount = this.drawCount;

      // 保底逻辑
      const rarityOrder = ['common', 'rare', 'epic', 'legendary'];
      const rarityIdx = rarityOrder.indexOf(card.rarity);
      if (rarityIdx >= 1) {
        this.pityCounter = 0;
      } else {
        this.pityCounter++;
      }

      gameState.hand.push(card);
      gameState.handDisabled.push(false);
      drawn.push(card);
    }

    gameState.pityCounter = this.pityCounter;

    return { success: true, cards: drawn, reason: '' };
  }

  /**
   * 核心抽卡随机算法（混合防御塔和功能牌）
   * 优先检查保底 → 否则按权重随机
   */
  _rollCard() {
    const cfg = ConfigManager;
    const towers = cfg.getTowers();
    const weights = { ...cfg.getRarityWeights() };
    const gachaCfg = cfg.getGachaConfig();

    // 合并防御塔和功能牌到候选池
    const allCards = [...towers, ...cfg.getSpells()];

    // 保底：强制稀有+
    if (this.pityCounter >= (gachaCfg.pityCount || 10) - 1) {
      return this._rollByRarity(weights, allCards, 'rare');
    }

    // 正常权重抽卡
    return this._rollByWeight(weights, allCards);
  }

  /**
   * 按权重在全部卡牌中随机
   */
  _rollByWeight(rarityWeights, allCards) {
    // 稀有度权重抽
    const rarities = Object.keys(rarityWeights);
    const totalRW = rarities.reduce((s, r) => s + rarityWeights[r], 0);
    let roll = Math.random() * totalRW;
    let selectedRarity = 'common';

    for (const r of rarities) {
      roll -= rarityWeights[r];
      if (roll <= 0) {
        selectedRarity = r;
        break;
      }
    }

    return this._rollByRarity(rarityWeights, allCards, selectedRarity);
  }

  /**
   * 指定稀有度中按 weight 随机一张卡
   */
  _rollByRarity(rarityWeights, allCards, minRarity) {
    const rarityOrder = ['common', 'rare', 'epic', 'legendary'];
    const minIdx = rarityOrder.indexOf(minRarity);

    const candidates = allCards.filter(c => {
      const idx = rarityOrder.indexOf(c.rarity);
      return idx >= minIdx;
    });

    if (candidates.length === 0) return allCards[0];

    const totalW = candidates.reduce((s, c) => s + (c.weight || 10), 0);
    let roll = Math.random() * totalW;
    for (const c of candidates) {
      roll -= (c.weight || 10);
      if (roll <= 0) return { ...c };
    }

    return { ...candidates[0] };
  }
}
