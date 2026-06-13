/**
 * StorageUtil.js - 本地存储封装
 * 自动适配 tt（抖音）和浏览器 localStorage
 */

const _isDouyin = typeof tt !== 'undefined' && tt.getStorageSync;

const _get = (key) => {
  try {
    if (_isDouyin) {
      const v = tt.getStorageSync(key);
      if (v === '' || v === undefined || v === null) return null;
      return JSON.parse(v);
    } else {
      const v = localStorage.getItem(key);
      if (!v) return null;
      return JSON.parse(v);
    }
  } catch (e) { return null; }
};

const _set = (key, value) => {
  try {
    if (_isDouyin) {
      tt.setStorageSync(key, JSON.stringify(value));
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (e) {}
};

const _remove = (key) => {
  try {
    if (_isDouyin) {
      tt.removeStorageSync(key);
    } else {
      localStorage.removeItem(key);
    }
  } catch (e) {}
};

const _keys = () => {
  try {
    if (_isDouyin) {
      return tt.getStorageInfoSync().keys || [];
    } else {
      const ks = [];
      for (let i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i));
      return ks;
    }
  } catch (e) { return []; }
};

export const StorageUtil = {
  get: _get,
  set: _set,
  remove: _remove,
  keys: _keys
};
