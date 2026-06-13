/**
 * ConfigManager.js - 配置管理
 * 首次运行用默认数据初始化，支持后台配置覆盖
 */
import MONSTERS from './monsters.js';
import TOWERS from './towers.js';
import LEVELS from './levels.js';
import SPELLS from './spells.js';
import { GACHA_CONFIG, RARITY_WEIGHTS, MAX_HAND_SIZE, calcGachaCost } from './gacha.js';
import { StorageUtil } from '../utils/StorageUtil.js';

const STORAGE_KEYS = {
  MONSTERS: '__cfg_monsters',
  TOWERS: '__cfg_towers',
  LEVELS: '__cfg_levels',
  SPELLS: '__cfg_spells',
  GACHA_CONFIG: '__cfg_gacha',
  RARITY_WEIGHTS: '__cfg_rarity_weights'
};

class _ConfigManager {
  constructor() {
    this.monsters = [];
    this.towers = [];
    this.levels = [];
    this.spells = [];
    this.gachaConfig = {};
    this.rarityWeights = {};
    this.maxHandSize = MAX_HAND_SIZE;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    this.monsters = StorageUtil.get(STORAGE_KEYS.MONSTERS) || [...MONSTERS];
    this.towers = StorageUtil.get(STORAGE_KEYS.TOWERS) || [...TOWERS];
    this.levels = StorageUtil.get(STORAGE_KEYS.LEVELS) || [...LEVELS];
    this.spells = StorageUtil.get(STORAGE_KEYS.SPELLS) || [...SPELLS];
    this.gachaConfig = StorageUtil.get(STORAGE_KEYS.GACHA_CONFIG) || { ...GACHA_CONFIG };
    this.rarityWeights = StorageUtil.get(STORAGE_KEYS.RARITY_WEIGHTS) || { ...RARITY_WEIGHTS };

    // 恢复运行时 Image 对象（从 animDataUrl / image 重建）
    this._restoreImages(this.monsters);
    this._restoreImages(this.towers);
    // 恢复关卡贴图
    for (const lv of this.levels) {
      if (lv.bgImage && typeof lv.bgImage === 'string') {
        lv._bgImage = this._createImage(lv.bgImage);
      }
      if (lv.pathImage && typeof lv.pathImage === 'string') {
        lv._pathImage = this._createImage(lv.pathImage);
      }
      if (lv.goalImage && typeof lv.goalImage === 'string') {
        lv._goalImage = this._createImage(lv.goalImage);
      }
    }

    this.initialized = true;
  }

  /**
   * 从 animDataUrl 恢复 _animImage 运行时对象
   * Image 对象不可 JSON 序列化，页面刷新后需从 data URL 重建
   */
  _restoreImages(list) {
    for (const item of list) {
      const url = item.animDataUrl || item.image;
      if (url && typeof url === 'string') {
        // 有效 Image 对象必定有 number 类型的 width；JSON 反序列化的 {} 没有
        const needsRebuild = !item._animImage || typeof item._animImage.width !== 'number';
        if (needsRebuild) {
          const img = this._createImage(url);
          if (img) {
            img.onerror = () => { console.warn('[ConfigManager] 图片恢复失败:', url); };
            item._animImage = img;
          }
          if (!item.image) item.image = url;
        }
      }
    }
  }

  /**
   * 创建跨平台 Image 对象
   */
  _createImage(url) {
    if (typeof tt !== 'undefined' && tt.createImage) {
      const img = tt.createImage();
      img.src = url;
      return img;
    } else {
      const img = new Image();
      img.src = url;
      return img;
    }
  }

  // --- 读写接口（供后台配置页使用）---
  getMonsters() { return this.monsters; }
  getTowers() { return this.towers; }
  getLevels() { return this.levels; }
  getSpells() { return this.spells; }

  saveMonsters(data) {
    this.monsters = data;
    const clean = data.map(item => { const c = { ...item }; delete c._animImage; return c; });
    StorageUtil.set(STORAGE_KEYS.MONSTERS, clean);
  }
  saveTowers(data) {
    this.towers = data;
    const clean = data.map(item => { const c = { ...item }; delete c._animImage; return c; });
    StorageUtil.set(STORAGE_KEYS.TOWERS, clean);
  }
  saveLevels(data) { this.levels = data; StorageUtil.set(STORAGE_KEYS.LEVELS, data); }
  saveSpells(data) { this.spells = data; StorageUtil.set(STORAGE_KEYS.SPELLS, data); }
  saveGachaConfig(data) { this.gachaConfig = data; StorageUtil.set(STORAGE_KEYS.GACHA_CONFIG, data); }
  saveRarityWeights(data) { this.rarityWeights = data; StorageUtil.set(STORAGE_KEYS.RARITY_WEIGHTS, data); }

  // 抽卡相关便捷方法
  getGachaConfig() { return this.gachaConfig; }
  getRarityWeights() { return this.rarityWeights; }
  calcGachaCost(drawCount) { return calcGachaCost(drawCount); }
}

export const ConfigManager = new _ConfigManager();
