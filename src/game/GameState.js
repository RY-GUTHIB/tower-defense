/**
 * GameState.js - 游戏状态管理
 *
 * 状态机: idle → playing → paused / gameover / victory
 * 全局血量、金币、波次进度、已放置塔列表
 */
import { ConfigManager } from '../data/ConfigManager.js';
import { MAX_HAND_SIZE } from '../data/gacha.js';

export const STATE = {
  IDLE: 'idle',           // 初始待机
  PLAYING: 'playing',     // 战斗进行中
  PAUSED: 'paused',       // 暂停
  GAMEOVER: 'gameover',   // 失败
  VICTORY: 'victory'      // 胜利
};

export class GameState {
  constructor(levelData) {
    this.state = STATE.IDLE;
    this.level = levelData;

    // 终点血量
    this.maxHp = levelData.baseHp;
    this.hp = levelData.baseHp;

    // 金币
    this.gold = levelData.initGold || 100;

    // 已放置的塔 [{towerDef, col, row}]
    this.placedTowers = [];

    // 手牌 [{towerDef}, ...] 上限 MAX_HAND_SIZE
    this.hand = [];

    // 手牌禁用状态 [boolean, ...] 放置一张后其余不可用
    this.handDisabled = [];

    // 波次
    this.currentWave = 0;
    this.totalWaves = levelData.waves.length;
    this.allWavesComplete = false;

    // 抽卡计数（用于递增费用和保底）
    this.drawCount = 0;
    this.pityCounter = 0;
  }

  start() {
    this.state = STATE.PLAYING;
  }

  pause() {
    if (this.state === STATE.PLAYING) this.state = STATE.PAUSED;
    else if (this.state === STATE.PAUSED) this.state = STATE.PLAYING;
  }

  isRunning() {
    return this.state === STATE.PLAYING;
  }

  isEnded() {
    return this.state === STATE.GAMEOVER || this.state === STATE.VICTORY;
  }

  // 扣血
  takeDamage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp <= 0) {
      this.state = STATE.GAMEOVER;
    }
  }

  // 治疗终点血量
  healHp(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  // 增加最大血量（同时增加当前血量）
  increaseMaxHp(amount) {
    this.maxHp += amount;
    this.hp += amount;
  }

  // 金币
  addGold(amount) { this.gold += amount; }
  spendGold(amount) {
    if (this.gold < amount) return false;
    this.gold -= amount;
    return true;
  }

  // 放置塔
  placeTower(towerDef, col, row, towerInstance) {
    this.placedTowers.push({ towerDef, col, row, tower: towerInstance });
  }

  // 手牌
  addToHand(towerDef) {
    if (this.hand.length >= MAX_HAND_SIZE) return false;
    this.hand.push(towerDef);
    this.handDisabled.push(false);
    return true;
  }

  removeFromHand(index) {
    if (index >= 0 && index < this.hand.length) {
      this.hand.splice(index, 1);
      this.handDisabled.splice(index, 1);
      return true;
    }
    return false;
  }

  // 禁用除指定索引外的所有手牌
  disableOtherCards(usedIndex) {
    for (let i = 0; i < this.handDisabled.length; i++) {
      this.handDisabled[i] = (i !== usedIndex);
    }
  }

  // 禁用所有手牌（放置/使用牌后调用）
  disableAllCards() {
    for (let i = 0; i < this.handDisabled.length; i++) {
      this.handDisabled[i] = true;
    }
  }

  // 重置所有手牌为可用
  resetHandDisabled() {
    for (let i = 0; i < this.handDisabled.length; i++) {
      this.handDisabled[i] = false;
    }
  }
}
