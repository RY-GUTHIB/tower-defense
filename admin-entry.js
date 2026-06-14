/**
 * admin-entry.js - 后台配置独立入口
 * 不从 SceneManager 加载，纯独立页面
 */
import { AdminPage } from './pages/admin/AdminPage.js';
import { ConfigManager } from './src/data/ConfigManager.js';
import { bootstrapUI } from './src/ui/UIManager.js';

// ---- Canvas 初始化 ----
const canvas = document.getElementById('adminCanvas');
const ctx = canvas.getContext('2d');

function initCanvas() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { W, H };
}

const { W, H } = initCanvas();

// ---- 初始化 UI（toast/modal） ----
bootstrapUI();

// ---- 初始化配置 & 启动后台 ----
ConfigManager.init().then(() => {
  const adminPage = new AdminPage(ctx, W, H, () => {
    // 返回首页
    window.location.href = '/';
  });

  // 进入后台（含授权检查）
  adminPage.onEnter();

  // ---- 触摸事件 ----
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    adminPage.onTouchStart(e);
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    adminPage.onTouchMove(e);
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    adminPage.onTouchEnd(e);
  }, { passive: false });

  // ---- 鼠标事件（桌面调试） ----
  canvas.addEventListener('mousedown', (e) => {
    const fakeE = { changedTouches: [{ clientX: e.clientX, clientY: e.clientY }] };
    adminPage.onTouchStart(fakeE);
  });
  canvas.addEventListener('mousemove', (e) => {
    if (e.buttons !== 1) return;
    const fakeE = { changedTouches: [{ clientX: e.clientX, clientY: e.clientY }] };
    adminPage.onTouchMove(fakeE);
  });
  canvas.addEventListener('mouseup', (e) => {
    const fakeE = { changedTouches: [{ clientX: e.clientX, clientY: e.clientY }] };
    adminPage.onTouchEnd(fakeE);
  });

  // ---- 窗口尺寸调整 ----
  window.addEventListener('resize', () => {
    const { W: nW, H: nH } = initCanvas();
    adminPage.w = nW;
    adminPage.h = nH;
    adminPage.render();
  });

  // ---- 键盘快捷键 ----
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      adminPage.onBack();
    }
  });
});
