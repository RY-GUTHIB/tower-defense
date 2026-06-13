/**
 * LevelSelectPage.js - 关卡选择页
 * 显示已解锁关卡列表，点击进入游戏
 */
import { ConfigManager } from '../../src/data/ConfigManager.js';
import { StorageUtil } from '../../src/utils/StorageUtil.js';
import { TILE_SIZE } from '../../src/utils/DrawUtil.js';
import { Color, Font, font } from '../../src/ui/theme.js';

export class LevelSelectPage {
  constructor(ctx, w, h, onSelectLevel, onBack) {
    this.ctx = ctx;
    this.w = w;
    this.h = h;
    this.onSelectLevel = onSelectLevel;
    this.onBack = onBack;
    this.levels = [];
    this.progress = {};
  }

  onEnter() {
    this.levels = ConfigManager.getLevels();
    this.progress = StorageUtil.get('__user_progress') || {};
    this.render();
  }

  render() {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = Color.bg;
    ctx.fillRect(0, 0, w, h);

    // 标题
    ctx.fillStyle = Color.gold;
    ctx.font = Font.title;
    ctx.textAlign = 'center';
    ctx.fillText('选择关卡', w / 2, 50);

    // 返回
    ctx.fillStyle = Color.textSecondary;
    ctx.font = Font.body;
    ctx.textAlign = 'left';
    ctx.fillText('< 返回', 16, 50);
    this.backBtn = { x: 12, y: 30, w: 60, h: 30 };

    // 关卡列表
    const startY = 90;
    const cardH = 100;
    const gap = 12;
    this.levelBtns = [];

    for (let i = 0; i < this.levels.length; i++) {
      const lv = this.levels[i];
      const y = startY + i * (cardH + gap);
      const isUnlocked = lv.unlocked || this.progress[lv.id];

      // 卡片
      const cardFill = isUnlocked ? Color.accent : Color.card;
      const textMain = isUnlocked ? Color.textPrimary : Color.textMuted;
      const textSub  = isUnlocked ? Color.textSecondary : Color.textMuted;

      ctx.fillStyle = cardFill;
      ctx.fillRect(20, y, w - 40, cardH);

      ctx.fillStyle = textMain;
      ctx.font = Font.subtitle;
      ctx.textAlign = 'left';
      ctx.fillText(`第${lv.id}关 · ${lv.name}`, 36, y + 32);

      ctx.font = Font.body;
      ctx.fillStyle = textSub;
      ctx.fillText(`共${lv.waves.length}波 · 初始金币 ${lv.initGold}`, 36, y + 56);

      if (!isUnlocked) {
        ctx.font = Font.body;
        ctx.fillText('🔒 未解锁', w - 100, y + cardH / 2 + 4);
      } else {
        ctx.fillStyle = Color.gold;
        ctx.font = font(14, '600');
        ctx.fillText('进入 >', w - 80, y + cardH / 2 + 4);
      }

      this.levelBtns.push({ y, h: cardH, level: lv, unlocked: isUnlocked });
    }
  }

  onTouchStart(e) {}
  onTouchMove(e) {}

  onTouchEnd(e) {
    const t = e.changedTouches[0];
    const x = t.clientX;
    const y = t.clientY;

    // 返回按钮
    if (this._hit(this.backBtn, x, y)) {
      if (this.onBack) this.onBack();
      return;
    }

    // 关卡选择
    for (const btn of this.levelBtns) {
      if (btn.unlocked && y >= btn.y && y <= btn.y + btn.h) {
        this.onSelectLevel(btn.level);
        return;
      }
    }
  }

  _hit(rect, x, y) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  onLeave() {}
}
