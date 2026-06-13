/**
 * ProgressManager.js - 玩家进度管理
 * 管理关卡解锁、通关记录、拥有的塔、金币等跨局持久化数据
 */
import { StorageUtil } from './StorageUtil.js';
import { ConfigManager } from '../data/ConfigManager.js';

const PROGRESS_KEY = '__user_progress';

const DEFAULT_PROGRESS = {
  currentLevel: 1,
  levels: {},       // { [levelId]: { cleared: bool, bestScore: number } }
  totalGold: 0,
  ownedCards: [],   // 持有的永久塔卡 [{towerId}, ...]
  openedCards: []   // 本局已开塔ID列表（用于图鉴）
};

export const ProgressManager = {
  _data: null,

  get() {
    if (this._data) return this._data;
    this._data = StorageUtil.get(PROGRESS_KEY) || JSON.parse(JSON.stringify(DEFAULT_PROGRESS));
    return this._data;
  },

  save() {
    StorageUtil.set(PROGRESS_KEY, this._data);
  },

  // 关卡解锁
  isLevelUnlocked(levelId) {
    if (levelId === 1) return true;
    const prev = this.get().levels[levelId - 1];
    return prev && prev.cleared === true;
  },

  markLevelCleared(levelId) {
    const p = this.get();
    p.levels[levelId] = p.levels[levelId] || {};
    p.levels[levelId].cleared = true;
    this.save();

    // 解锁下一关
    const levels = ConfigManager.getLevels();
    const nextLevel = levels.find(l => l.id === levelId + 1);
    if (nextLevel) {
      nextLevel.unlocked = true;
      ConfigManager.saveLevels(levels);
    }
  },

  // 金币
  addGold(amount) {
    this.get().totalGold += amount;
    this.save();
  },

  getGold() {
    return this.get().totalGold;
  }
};
