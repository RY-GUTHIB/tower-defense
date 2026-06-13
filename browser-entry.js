/**
 * browser-entry.js - 浏览器端入口
 * 替代 game.js（抖音端入口），桥接浏览器环境
 */
import { SceneManager } from './src/ui/SceneManager.js';
import { ConfigManager } from './src/data/ConfigManager.js';
import { AudioManager } from './src/audio/AudioManager.js';
import { bootstrapUI, setVolumeWidgetVisible } from './src/ui/UIManager.js';
import { SCENE } from './src/ui/SceneTypes.js';
import { TILE_SIZE, GRID_COLS, GRID_ROWS, MAP_OFFSET_X, MAP_OFFSET_Y } from './src/utils/DrawUtil.js';

// ---- Canvas 初始化 ----
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function calcTileSize() {
  const gridW = window.innerWidth - 2 * MAP_OFFSET_X;
  let ts = Math.floor(gridW / GRID_COLS);
  ts = Math.min(ts, 48);
  ts = Math.max(ts, 18);
  return ts;
}

function initCanvas() {
  const tileSize = calcTileSize();
  const gridPixelW = GRID_COLS * tileSize;
  const gridPixelH = MAP_OFFSET_Y + GRID_ROWS * tileSize;
  const hudH = 130;
  const totalH = gridPixelH + hudH;
  const W = Math.max(window.innerWidth, gridPixelW);
  const H = Math.max(window.innerHeight, totalH);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { W, H };
}

const { W, H } = initCanvas();

// ---- 初始化系统 ----
// 初始化 UI（DOM 事件：toast/modal/音量控件）
bootstrapUI();

// 初始化配置
ConfigManager.init();

// ---- 场景管理器 ----
let sceneManager = new SceneManager(canvas, ctx, W, H);

// ---- 触摸事件 ----
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  sceneManager.onTouchStart(e);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  sceneManager.onTouchMove(e);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  sceneManager.onTouchEnd(e);
}, { passive: false });

// ---- 鼠标事件（桌面调试） ----
canvas.addEventListener('mousedown', (e) => {
  const fakeE = { changedTouches: [{ clientX: e.clientX, clientY: e.clientY }] };
  sceneManager.onTouchStart(fakeE);
});
canvas.addEventListener('mousemove', (e) => {
  if (e.buttons !== 1) return;
  const fakeE = { changedTouches: [{ clientX: e.clientX, clientY: e.clientY }] };
  sceneManager.onTouchMove(fakeE);
});
canvas.addEventListener('mouseup', (e) => {
  const fakeE = { changedTouches: [{ clientX: e.clientX, clientY: e.clientY }] };
  sceneManager.onTouchEnd(fakeE);
});

// ---- 窗口尺寸调整 ----
window.addEventListener('resize', () => {
  const n = initCanvas();
  if (sceneManager) {
    sceneManager.screenW = n.W;
    sceneManager.screenH = n.H;
    if (sceneManager.currentPage) {
      sceneManager.currentPage.w = n.W;
      sceneManager.currentPage.h = n.H;
      sceneManager.currentPage.render();
    }
  }
});

// ---- 开始 ----
sceneManager.goto(SCENE.HOME);

// ---- 音量控件显隐 ----
// 保存原始 goto 引用
const _origGoto = sceneManager.goto.bind(sceneManager);
sceneManager.goto = function(scene, data) {
  _origGoto(scene, data);
  setVolumeWidgetVisible(scene === SCENE.HOME);
};

// ---- 音频自动恢复（浏览器策略） ----
let _audioResumed = false;
const resumeAudio = () => {
  if (!_audioResumed) {
    AudioManager.audioCtx;
    _audioResumed = true;
  }
};
document.addEventListener('click', resumeAudio, { once: true });
document.addEventListener('touchstart', resumeAudio, { once: true });

// ---- 键盘快捷键 ----
document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    sceneManager.goto(SCENE.HOME);
  }
  if (e.key === 'Escape') {
    if (sceneManager.currentPage && sceneManager.currentPage.onBack) {
      sceneManager.currentPage.onBack();
    } else {
      sceneManager.goto(SCENE.LEVEL_SELECT);
    }
  }
});

// ---- 启动 BGM（首页渲染后） ----
setTimeout(() => { AudioManager.startBGM(); }, 500);
