/**
 * game.js - 抖音小游戏入口
 * 负责初始化并跳转到首页场景
 */
import { SceneManager } from './src/ui/SceneManager.js';
import { StorageUtil } from './src/utils/StorageUtil.js';
import { ConfigManager } from './src/data/ConfigManager.js';

// 全局画布
const canvas = tt.createCanvas();
const ctx = canvas.getContext('2d');

// 屏幕尺寸
const { windowWidth: W, windowHeight: H } = tt.getSystemInfoSync();
canvas.width = W;
canvas.height = H;

// 初始化全局配置
ConfigManager.init();

// 初始化场景管理器并进入首页
const sceneManager = new SceneManager(canvas, ctx, W, H);
sceneManager.goto('home');

// 触摸事件转发
tt.onTouchStart(e => sceneManager.onTouchStart(e));
tt.onTouchMove(e => sceneManager.onTouchMove(e));
tt.onTouchEnd(e => sceneManager.onTouchEnd(e));
