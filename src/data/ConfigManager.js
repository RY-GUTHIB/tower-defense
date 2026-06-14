/**
 * ConfigManager.js - 配置管理
 * 本地开发：从同源 /config.json 拉取（server.js 提供）
 * 生产环境：从 jsDelivr CDN 拉取（部署后使用）
 * Admin 通过 POST /api/config 更新，直接写服务器文件
 */
import MONSTERS from './monsters.js';
import TOWERS from './towers.js';
import LEVELS from './levels.js';
import SPELLS from './spells.js';
import { GACHA_CONFIG, RARITY_WEIGHTS, MAX_HAND_SIZE, calcGachaCost } from './gacha.js';
import { StorageUtil } from '../utils/StorageUtil.js';

const CONFIG_VERSION = "1.7.0"; // 与 game.json 版本同步

// CDN 地址（生产环境，jsDelivr 国内有节点）
const CDN_CONFIG_URL = 'https://cdn.jsdelivr.net/gh/RY-GUTHIB/tower-defense@main/config.json';
const FETCH_TIMEOUT_MS = 5000;

/** 判断运行环境 */
function isLocalhost() {
  try {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');
  } catch { return false; }
}

/** 获取配置文件地址 */
function getConfigUrl() {
  if (isLocalhost()) {
    return '/config.json'; // 从本地 server.js 拉取
  }
  return CDN_CONFIG_URL;
}

const STORAGE_KEYS = {
  MONSTERS: '__cfg_monsters',
  TOWERS: '__cfg_towers',
  LEVELS: '__cfg_levels',
  SPELLS: '__cfg_spells',
  GACHA_CONFIG: '__cfg_gacha',
  RARITY_WEIGHTS: '__cfg_rarity_weights',
  HOME_BG_URL: '__cfg_home_bg_url'
};

/**
 * 法术的 execute 函数不可 JSON 序列化，此处根据 id 重建
 * 如需在远程配置中新增法术，在此处补充映射
 */
const SPELL_EXECUTORS = {
  heal(gameState) {
    gameState.healHp(this.value || 3);
  },
  max_hp_up(gameState) {
    gameState.increaseMaxHp(this.value || 5);
  },
  aoe_damage(gameState, monsters) {
    const dmg = this.value || 8;
    for (const m of monsters) {
      if (m.alive && !m.reached) {
        m.takeDamage(dmg);
      }
    }
  }
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
    this.homeBgUrl = null; // 主页背景图服务器路径
    this.initialized = false;
    this.remoteLoaded = false; // 是否成功从远程加载过
  }

  /**
   * 初始化：远程优先 → localStorage 降级 → 代码默认值兜底
   * 5 秒超时，玩家无感知降级
   */
  async init() {
    if (this.initialized) return;

    const storedVer = StorageUtil.get("__config_version");
    const forceReset = storedVer !== CONFIG_VERSION;

    // 尝试拉取远程配置
    let remoteCfg = null;
    try {
      remoteCfg = await this._fetchRemote();
      if (remoteCfg && remoteCfg.version) {
        console.log('[ConfigManager] 远程配置加载成功, version:', remoteCfg.version);
      }
    } catch (e) {
      console.warn('[ConfigManager] 远程配置加载失败，降级到本地缓存:', e.message);
    }

    if (remoteCfg && remoteCfg.version && !forceReset) {
      // 远程配置可用且版本匹配 → 用它
      this._applyRemote(remoteCfg);
      // 缓存到本地，下次无网也能用
      this._cacheToLocal(remoteCfg);
      this.remoteLoaded = true;
    } else if (!forceReset) {
      // 远程失败 + 本地有缓存 → 用缓存
      this._loadLocal();
      if (remoteCfg && remoteCfg.version) {
        console.warn('[ConfigManager] 版本不匹配，但使用远程最新配置');
        this._applyRemote(remoteCfg);
        this._cacheToLocal(remoteCfg);
        this.remoteLoaded = true;
      }
    } else {
      // 版本升级 or 都失败 → 用代码默认值
      console.log('[ConfigManager] 使用代码默认配置');
      this._loadDefaults();
      this._persistAll();
    }

    // 保存当前配置版本
    StorageUtil.set("__config_version", CONFIG_VERSION);

    this.initialized = true;
  }

  // ==================== 远程拉取 ====================

  /**
   * 从服务器拉取 config.json（本地 → /config.json，生产 → jsDelivr CDN），5 秒超时
   */
  async _fetchRemote() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const remoteUrl = getConfigUrl();

    try {
      // 加时间戳防止缓存
      const resp = await fetch(remoteUrl + '?t=' + Date.now(), {
        signal: controller.signal,
        cache: 'no-store'
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return await resp.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 将远程配置写入本地 localStorage（离线降级用）
   */
  _cacheToLocal(cfg) {
    if (cfg.monsters) StorageUtil.set(STORAGE_KEYS.MONSTERS, cfg.monsters);
    if (cfg.towers) StorageUtil.set(STORAGE_KEYS.TOWERS, cfg.towers);
    if (cfg.levels) StorageUtil.set(STORAGE_KEYS.LEVELS, cfg.levels);
    if (cfg.spells) StorageUtil.set(STORAGE_KEYS.SPELLS, cfg.spells);
    if (cfg.gacha) StorageUtil.set(STORAGE_KEYS.GACHA_CONFIG, cfg.gacha);
    if (cfg.rarityWeights) StorageUtil.set(STORAGE_KEYS.RARITY_WEIGHTS, cfg.rarityWeights);
    if (cfg.homeBgUrl) StorageUtil.set(STORAGE_KEYS.HOME_BG_URL, cfg.homeBgUrl);
    // 注意：远程没给 homeBgUrl 时不覆盖本地已有的值
  }

  /**
   * 将远程配置应用到内存
   */
  _applyRemote(cfg) {
    this.monsters = cfg.monsters || [...MONSTERS];
    this.towers = cfg.towers || [...TOWERS];
    this.levels = cfg.levels || [...LEVELS];
    this.spells = cfg.spells || [...SPELLS];
    this.gachaConfig = cfg.gacha || { ...GACHA_CONFIG };
    this.rarityWeights = cfg.rarityWeights || { ...RARITY_WEIGHTS };

    // 法术需要重建 execute 函数
    this._buildSpellExecutors(this.spells);

    // 主页背景图 URL：远程优先，localStorage 兜底
    this.homeBgUrl = (cfg.homeBgUrl && typeof cfg.homeBgUrl === 'string' && cfg.homeBgUrl.trim())
      ? cfg.homeBgUrl
      : (StorageUtil.get(STORAGE_KEYS.HOME_BG_URL) || null);

    // 恢复运行时 Image 对象
    this._restoreImages(this.monsters);
    this._restoreImages(this.towers);
    this._restoreLevelImages();
  }

  // ==================== 本地降级 ====================

  _loadLocal() {
    this.monsters = StorageUtil.get(STORAGE_KEYS.MONSTERS) || [...MONSTERS];
    this.towers = StorageUtil.get(STORAGE_KEYS.TOWERS) || [...TOWERS];
    this.levels = StorageUtil.get(STORAGE_KEYS.LEVELS) || [...LEVELS];
    this.spells = StorageUtil.get(STORAGE_KEYS.SPELLS) || [...SPELLS];
    this.gachaConfig = StorageUtil.get(STORAGE_KEYS.GACHA_CONFIG) || { ...GACHA_CONFIG };
    this.rarityWeights = StorageUtil.get(STORAGE_KEYS.RARITY_WEIGHTS) || { ...RARITY_WEIGHTS };

    this._buildSpellExecutors(this.spells);
    this._restoreImages(this.monsters);
    this._restoreImages(this.towers);
    this._restoreLevelImages();

    // 主页背景图 URL
    this.homeBgUrl = StorageUtil.get(STORAGE_KEYS.HOME_BG_URL) || null;
  }

  _loadDefaults() {
    this.monsters = [...MONSTERS];
    this.towers = [...TOWERS];
    this.levels = [...LEVELS];
    this.spells = [...SPELLS];
    this.gachaConfig = { ...GACHA_CONFIG };
    this.rarityWeights = { ...RARITY_WEIGHTS };
    this.homeBgUrl = null;

    this._buildSpellExecutors(this.spells);
    this._restoreImages(this.monsters);
    this._restoreImages(this.towers);
    this._restoreLevelImages();
  }

  _persistAll() {
    StorageUtil.set(STORAGE_KEYS.MONSTERS, this.monsters);
    StorageUtil.set(STORAGE_KEYS.TOWERS, this.towers);
    StorageUtil.set(STORAGE_KEYS.LEVELS, this.levels);
    StorageUtil.set(STORAGE_KEYS.SPELLS, this.spells);
    StorageUtil.set(STORAGE_KEYS.GACHA_CONFIG, this.gachaConfig);
    StorageUtil.set(STORAGE_KEYS.RARITY_WEIGHTS, this.rarityWeights);
    StorageUtil.set(STORAGE_KEYS.HOME_BG_URL, this.homeBgUrl || '');
  }

  // ==================== 法术函数重建 ====================

  /**
   * JSON 不可序列化函数，从远程加载后需要根据 id 重建 execute
   */
  _buildSpellExecutors(spells) {
    for (const spell of spells) {
      if (spell.isSpell && SPELL_EXECUTORS[spell.id]) {
        spell.execute = SPELL_EXECUTORS[spell.id];
      }
    }
  }

  // ==================== 图片恢复 ====================

  /**
   * 从 animDataUrl 恢复 _animImage 运行时对象
   */
  _restoreImages(list) {
    for (const item of list) {
      const url = item.animDataUrl || item.image;
      if (url && typeof url === 'string') {
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

  _restoreLevelImages() {
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
  }

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

  // ==================== 导出当前完整配置（供 Admin 同步到 GitHub）====================

  /**
   * 导出当前内存配置为可序列化 JSON（剥离 Image 对象和函数）
   */
  exportConfig() {
    const stripImages = (arr) => arr.map(item => {
      const c = { ...item };
      delete c._animImage;
      delete c._bgImage;
      delete c._pathImage;
      delete c._goalImage;
      return c;
    });

    const stripSpells = (arr) => arr.map(item => {
      const c = { ...item };
      delete c.execute; // 函数不可序列化
      return c;
    });

    return {
      version: CONFIG_VERSION,
      monsters: stripImages(this.monsters),
      towers: stripImages(this.towers),
      levels: stripImages(this.levels),
      spells: stripSpells(this.spells),
      gacha: { ...this.gachaConfig },
      rarityWeights: { ...this.rarityWeights },
      homeBgUrl: this.homeBgUrl || ''
    };
  }

  // ==================== 读写接口（供后台配置页使用）====================

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

  /** 保存主页背景图 URL 并同步到 localStorage */
  saveHomeBgUrl(url) {
    this.homeBgUrl = url || null;
    StorageUtil.set(STORAGE_KEYS.HOME_BG_URL, url || '');
  }

  // 抽卡相关便捷方法
  getGachaConfig() { return this.gachaConfig; }
  getRarityWeights() { return this.rarityWeights; }
  calcGachaCost(drawCount) { return calcGachaCost(drawCount); }
}

export const ConfigManager = new _ConfigManager();
