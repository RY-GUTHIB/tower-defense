/**
 * HomePage.js - 首页
 * 画布绘制：游戏标题 + "开始游戏" + "后台配置"（需开发者授权）
 */
import { StorageUtil } from '../../src/utils/StorageUtil.js';
import { Color, Font, font } from '../../src/ui/theme.js';
import { drawButton } from '../../src/utils/DrawUtil.js';

export class HomePage {
  constructor(ctx, w, h, onStartGame) {
    this.ctx = ctx;
    this.w = w;
    this.h = h;
    this.onStartGame = onStartGame;

    // 按钮区域
    this.startBtn = { x: w / 2 - 80, y: h * 0.45, w: 160, h: 50 };
    this.adminBtn = { x: w / 2 - 80, y: h * 0.55, w: 160, h: 50 };

    // 开发者标记
    this.isDeveloper = this._checkDeveloper();

    // 背景图
    this._bgImage = null;
  }

  _checkDeveloper() {
    return StorageUtil.get('__dev_authorized') === true;
  }

  _loadBgImage() {
    const bgDataUrl = StorageUtil.get('__home_bg_dataUrl');
    if (!bgDataUrl) { this._bgImage = null; return; }

    // 已经加载过且URL未变则跳过
    if (this._bgImage && this._bgImage._src === bgDataUrl) return;

    // 抖音小游戏环境
    if (typeof tt !== 'undefined' && tt.createImage) {
      const img = tt.createImage();
      img.onload = () => { this._bgImage = img; this._bgImage._src = bgDataUrl; this.render(); };
      img.onerror = () => { console.warn('[HomePage] 背景图加载失败:', bgDataUrl); };
      img.src = bgDataUrl;
    } else {
      // 浏览器环境
      const img = new Image();
      img.onload = () => { this._bgImage = img; this._bgImage._src = bgDataUrl; this.render(); };
      img.onerror = () => { console.warn('[HomePage] 背景图加载失败:', bgDataUrl); };
      img.src = bgDataUrl;
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;

    ctx.clearRect(0, 0, w, h);

    // 背景
    if (this._bgImage) {
      try { ctx.drawImage(this._bgImage, 0, 0, w, h); } catch(e) {}
      ctx.fillStyle = Color.overlayLight;
      ctx.fillRect(0, 0, w, h);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, Color.surface);
      grad.addColorStop(1, Color.bg);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // 标题
    ctx.fillStyle = Color.gold;
    ctx.font = `700 ${Math.floor(w * 0.07)}px ${Font.family}`;
    ctx.textAlign = 'center';
    ctx.fillText('塔防风云', w / 2, h * 0.22);

    ctx.fillStyle = Color.textSecondary;
    ctx.font = font(Math.floor(w * 0.035), '400');
    ctx.fillText('—— 抽卡塔防 · 百塔争锋 ——', w / 2, h * 0.28);

    // 按钮
    drawButton(ctx, this.startBtn.x, this.startBtn.y, this.startBtn.w, this.startBtn.h,
      '开始游戏', { color: Color.accent, textColor: Color.gold, fontSize: 18, fontWeight: '700' });

    // 后台配置始终可见（AdminPage 自带密码验证）
    drawButton(ctx, this.adminBtn.x, this.adminBtn.y, this.adminBtn.w, this.adminBtn.h,
      '后台配置', { color: Color.warning, fontSize: 18, fontWeight: '700' });

    // 版本号
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = Font.caption;
    ctx.textAlign = 'right';
    ctx.fillText('v1.7.0', w - 12, h - 12);
  }

  onTouchStart(e) {}
  onTouchMove(e) {}

  onTouchEnd(e) {
    const t = e.changedTouches[0];
    const x = t.clientX;
    const y = t.clientY;

    if (this._hit(this.startBtn, x, y)) {
      this.onStartGame();
      return;
    }

    if (this._hit(this.adminBtn, x, y)) {
      this.onAdminClick && this.onAdminClick();
    }
  }

  _hit(rect, x, y) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  onLeave() {}
  onEnter() {
    this.isDeveloper = this._checkDeveloper();
    this._loadBgImage();
    this.render();
  }
}
