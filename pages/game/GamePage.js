/**
 * GamePage.js - 游戏主界面
 * 负责HUD绘制（血量条/金币/波次/手牌/抽卡按钮）
 * 代理触摸事件给 GameEngine 进行塔放置、抽卡等操作
 */
import { GameEngine } from '../../src/game/GameEngine.js';
import { SCENE } from '../../src/ui/SceneTypes.js';
import { TILE_SIZE, MAP_OFFSET_X, MAP_OFFSET_Y, GRID_COLS, GRID_ROWS, pixelToGrid } from '../../src/utils/DrawUtil.js';
import { Color, Font, font } from '../../src/ui/theme.js';

export class GamePage {
  constructor(ctx, w, h, onSceneChange) {
    this.ctx = ctx;
    this.w = w;
    this.h = h;
    this.onSceneChange = onSceneChange;
    this.engine = null;
    this.snapshot = null;
    this.selectedHandIndex = -1;

    // HUD区域边界
    this.mapBottom = MAP_OFFSET_Y + GRID_ROWS * TILE_SIZE;
    this.hudY = this.mapBottom + 4;

    // 拖拽状态
    this.dragging = false;
    this.dragTowerIdx = -1;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragCurrentX = 0;
    this.dragCurrentY = 0;
    this.dragThreshold = 10; // 超过10px才进入拖拽模式
    this.dragDef = null; // 正在拖拽的塔定义（用于渲染幽灵）
  }

  onEnter(levelData) {
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.engine = new GameEngine(levelData, this.ctx, this.w, this.h, (snapshot) => {
      this.snapshot = snapshot;
      this._renderHUD();
    });
    this.selectedHandIndex = -1; this.resultBtn = null;
    this.dragging = false;
    this.dragTowerIdx = -1;
    this.dragDef = null;
    this.engine.start();
  }

  onLeave() {
    if (this.engine) {
      this.engine.stop();
      this.engine = null;
    }
  }

  _renderHUD() {
    if (!this.snapshot) return;
    const ctx = this.ctx;
    const s = this.snapshot;
    const w = this.w;

    // === 顶部信息栏 ===
    const topBarH = 32;
    ctx.fillStyle = Color.overlay;
    ctx.fillRect(0, 0, w, topBarH);

    // 暂停按钮
    const isPaused = s.state === 'paused';
    const pauseBtn = { x: 6, y: 2, w: 48, h: 28 };
    ctx.fillStyle = isPaused ? Color.accent : Color.warning;
    ctx.fillRect(pauseBtn.x, pauseBtn.y, pauseBtn.w, pauseBtn.h);
    ctx.fillStyle = Color.textPrimary;
    ctx.font = font(12, '700');
    ctx.textAlign = 'center';
    ctx.fillText(isPaused ? '继续' : '暂停', pauseBtn.x + 24, pauseBtn.y + 20);
    this.pauseBtn = pauseBtn;

    // 波次
    ctx.textAlign = 'left';
    ctx.fillStyle = Color.gold;
    ctx.font = font(13, '700');
    ctx.fillText(`第${s.currentWave}/${s.totalWaves}波`, 62, 22);

    // 金币
    ctx.fillText(`金币: ${s.gold}`, 150, 22);

    // HOME 按钮
    const homeBtn = { x: w - 54, y: 2, w: 48, h: 28 };
    ctx.fillStyle = Color.danger;
    ctx.fillRect(homeBtn.x, homeBtn.y, homeBtn.w, homeBtn.h);
    const hx = homeBtn.x + 24;
    const hy = homeBtn.y + 14;
    ctx.fillStyle = Color.textPrimary;
    ctx.beginPath();
    ctx.moveTo(hx - 12, hy + 2);
    ctx.lineTo(hx + 12, hy + 2);
    ctx.lineTo(hx, hy - 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(hx - 8, hy, 16, 10);
    this.homeBtn = homeBtn;

    // === 手牌区域 ===
    const y0 = this.hudY;
    ctx.fillStyle = Color.overlay;
    ctx.fillRect(0, y0, w, this.h - y0);

    const handY = y0 + 6;
    const cardW = 54;
    const cardH = 60;
    const cardGap = 4;
    const handCount = s.hand.length;

    this.handButtons = [];
    for (let i = 0; i < 4; i++) {
      const cx = 8 + i * (cardW + cardGap);
      const isSelected = (i === this.selectedHandIndex);
      const hasCard = i < handCount;
      const isDisabled = hasCard && s.handDisabled && s.handDisabled[i];

      const cardFill = isSelected ? Color.accent
        : isDisabled ? '#111' : hasCard ? Color.card : '#111';
      const cardStroke = isSelected ? Color.gold
        : isDisabled ? '#222' : hasCard ? Color.textMuted : '#222';

      ctx.fillStyle = cardFill;
      ctx.strokeStyle = cardStroke;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.fillRect(cx, handY, cardW, cardH);
      ctx.strokeRect(cx, handY, cardW, cardH);

      if (hasCard) {
        const card = s.hand[i];
        ctx.globalAlpha = isDisabled ? 0.4 : 1.0;

        if (card.isSpell) {
          ctx.fillStyle = card.color || '#E040FB';
          ctx.fillRect(cx + 6, handY + 6, cardW - 12, 28);
          ctx.fillStyle = Color.textPrimary;
          ctx.font = Font.caption;
          ctx.textAlign = 'center';
          ctx.fillText(card.name, cx + cardW / 2, handY + 42);
          ctx.font = '8px ' + Font.family;
          ctx.fillStyle = Color.textMuted;
          ctx.fillText(card.desc || '', cx + cardW / 2, handY + 54);
        } else {
          ctx.fillStyle = card.color || '#607D8B';
          ctx.fillRect(cx + 6, handY + 6, cardW - 12, 28);
          ctx.fillStyle = Color.textPrimary;
          ctx.font = Font.caption;
          ctx.textAlign = 'center';
          ctx.fillText(card.name, cx + cardW / 2, handY + 42);
          ctx.font = '8px ' + Font.family;
          ctx.fillStyle = Color.textMuted;
          ctx.fillText(`ATK:${card.atk} R:${card.range}`, cx + cardW / 2, handY + 54);
        }
        ctx.globalAlpha = 1.0;
      }

      this.handButtons.push({ x: cx, y: handY, w: cardW, h: cardH, index: i, hasCard, isDisabled });
    }

    // 手牌禁用提示
    if (s.handDisabled && s.handDisabled.some(d => d)) {
      ctx.fillStyle = Color.textMuted;
      ctx.font = Font.caption;
      ctx.textAlign = "left";
      ctx.fillText("放置后需刷新手牌才能继续操作", 8, handY + cardH + 14);
    }

    // 刷新按钮
    const drawBtn = { x: w - 72, y: handY + 8, w: 64, h: 44 };
    ctx.fillStyle = Color.purple;
    ctx.fillRect(drawBtn.x, drawBtn.y, drawBtn.w, drawBtn.h);
    ctx.fillStyle = Color.textPrimary;
    ctx.font = font(13, '700');
    ctx.textAlign = 'center';
    ctx.fillText('刷新', drawBtn.x + 32, drawBtn.y + 20);
    ctx.font = Font.caption;
    ctx.fillText(`${s.drawCost}金`, drawBtn.x + 32, drawBtn.y + 36);
    this.drawBtn = drawBtn;

    // 删除按钮
    this.deleteBtn = null;
    if (s.selectedPlacedTowerIdx >= 0 && s.placedTowers && s.selectedPlacedTowerIdx < s.placedTowers.length) {
      const pt = s.placedTowers[s.selectedPlacedTowerIdx];
      const gc = pt.towerDef.gridCols || 1;
      const gr = pt.towerDef.gridRows || 1;
      const tx = MAP_OFFSET_X + (pt.col + gc) * TILE_SIZE - 8;
      const ty = MAP_OFFSET_Y + pt.row * TILE_SIZE - 4;
      ctx.fillStyle = Color.danger;
      ctx.beginPath();
      ctx.arc(tx, ty, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = Color.textPrimary;
      ctx.font = font(14, '700');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('×', tx, ty);
      ctx.textBaseline = 'alphabetic';
      this.deleteBtn = { x: tx - 10, y: ty - 10, w: 20, h: 20, towerIdx: s.selectedPlacedTowerIdx };

      // 塔名称（正下方居中）
      const gc2 = pt.towerDef.gridCols || 1;
      const gr2 = pt.towerDef.gridRows || 1;
      const nameX = MAP_OFFSET_X + (pt.col + gc2 / 2) * TILE_SIZE;
      const nameY = MAP_OFFSET_Y + (pt.row + gr2) * TILE_SIZE + 14;
      ctx.font = font(11, '700');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      // 描边增强可读性
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2.5;
      ctx.strokeText(pt.towerDef.name || '', nameX, nameY);
      ctx.fillStyle = Color.gold;
      ctx.fillText(pt.towerDef.name || '', nameX, nameY);
      ctx.textBaseline = 'alphabetic';
    }

    // 拖拽幽灵
    if (this.dragging && this.dragDef) {
      const gc = this.dragDef.gridCols || 1;
      const gr = this.dragDef.gridRows || 1;
      const ghostW = gc * TILE_SIZE;
      const ghostH = gr * TILE_SIZE;
      const gx = this.dragCurrentX - ghostW / 2;
      const gy = this.dragCurrentY - ghostH / 2;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = this.dragDef.color || '#607D8B';
      ctx.fillRect(gx, gy, ghostW, ghostH);
      ctx.strokeStyle = Color.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(gx, gy, ghostW, ghostH);
      ctx.globalAlpha = 1.0;

      const grid = pixelToGrid(this.dragCurrentX, this.dragCurrentY);
      if (grid.col >= 0 && grid.col < GRID_COLS && grid.row >= 0 && grid.row < GRID_ROWS) {
        const canPlace = this.engine.canMergeTower(this.dragTowerIdx, grid.col, grid.row);
        for (let dr = 0; dr < gr; dr++) {
          for (let dc = 0; dc < gc; dc++) {
            const tx = MAP_OFFSET_X + (grid.col + dc) * TILE_SIZE;
            const ty = MAP_OFFSET_Y + (grid.row + dr) * TILE_SIZE;
            ctx.fillStyle = canPlace ? 'rgba(76,175,80,0.4)' : 'rgba(244,67,54,0.3)';
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = canPlace ? Color.accent : Color.danger;
            ctx.lineWidth = 2;
            ctx.strokeRect(tx, ty, TILE_SIZE, TILE_SIZE);
          }
        }
      }
    }

    // 结算弹窗
    if (s.state === 'gameover' || s.state === 'victory') {
      this._renderResult(s.state);
    }

    if (this._confirmHome) {
      this._renderConfirmHome();
    }
  }

  _renderConfirmHome() {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;

    ctx.fillStyle = Color.overlay;
    ctx.fillRect(0, 0, w, h);

    const bx = w / 2 - 120, by = h / 2 - 60, bw = 240, bh = 120;
    ctx.fillStyle = Color.surface;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = Color.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = Color.textPrimary;
    ctx.font = font(14, '700');
    ctx.textAlign = 'center';
    ctx.fillText('终止游戏并返回主页？', w / 2, by + 40);

    ctx.fillStyle = Color.danger;
    ctx.fillRect(bx + 20, by + 60, 90, 36);
    ctx.fillStyle = Color.textPrimary;
    ctx.fillText('确认', bx + 65, by + 84);

    ctx.fillStyle = Color.accent;
    ctx.fillRect(bx + 130, by + 60, 90, 36);
    ctx.fillText('取消', bx + 175, by + 84);

    this._confirmYesBtn = { x: bx + 20, y: by + 60, w: 90, h: 36 };
    this._confirmNoBtn = { x: bx + 130, y: by + 60, w: 90, h: 36 };
  }

  _renderResult(state) {
    const ctx = this.ctx;
    const msg = state === 'victory' ? '胜利!' : '失败!';
    const msgColor = state === 'victory' ? Color.gold : Color.danger;

    ctx.fillStyle = Color.overlay;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.fillStyle = msgColor;
    ctx.font = font(36, '700');
    ctx.textAlign = 'center';
    ctx.fillText(msg, this.w / 2, this.h / 2 - 30);

    ctx.fillStyle = Color.textPrimary;
    ctx.font = Font.body;
    ctx.fillText('点击返回关卡选择', this.w / 2, this.h / 2 + 20);
    this.resultBtn = { x: 0, y: 0, w: this.w, h: this.h };
  }

  onTouchStart(e) {
    if (!this.engine) return;
    const t = e.changedTouches[0];
    this.dragStartX = t.clientX;
    this.dragStartY = t.clientY;
    this.dragCurrentX = t.clientX;
    this.dragCurrentY = t.clientY;
    this.dragging = false;
    this.dragTowerIdx = -1;
    this.dragDef = null;

    // 检查是否触摸了已放置的塔（仅记录拖拽候选，不选中）
    if (this.selectedHandIndex < 0) {
      const grid = pixelToGrid(t.clientX, t.clientY);
      if (grid.col >= 0 && grid.col < GRID_COLS && grid.row >= 0 && grid.row < GRID_ROWS) {
        const s = this.engine.gameState;
        for (let i = 0; i < s.placedTowers.length; i++) {
          const pt = s.placedTowers[i];
          const gc = pt.towerDef.gridCols || 1;
          const gr = pt.towerDef.gridRows || 1;
          if (grid.col >= pt.col && grid.col < pt.col + gc && grid.row >= pt.row && grid.row < pt.row + gr) {
            this.dragTowerIdx = i;
            this.dragDef = pt.towerDef;
            break;
          }
        }
      }
    }
  }

  onTouchMove(e) {
    if (!this.engine) return;
    const t = e.changedTouches[0];
    const x = t.clientX;
    const y = t.clientY;
    this.dragCurrentX = x;
    this.dragCurrentY = y;

    // 拖拽判定：触摸已放置塔且移动超过阈值
    if (this.dragTowerIdx >= 0 && !this.dragging) {
      const dx = x - this.dragStartX;
      const dy = y - this.dragStartY;
      if (Math.sqrt(dx * dx + dy * dy) > this.dragThreshold) {
        this.dragging = true;
        // 拖拽中清除选中状态（攻击范围等）
        this.engine.clearPlacedTowerSelection();
      }
    }

    // 范围预览（选中防御塔手牌时，功能牌不需要）
    if (this.selectedHandIndex >= 0) {
      const card = this.engine.gameState.hand[this.selectedHandIndex];
      if (!card || card.isSpell) {
        this.engine.clearHover();
      } else {
        const grid = pixelToGrid(x, y);
        if (grid.col >= 0 && grid.col < GRID_COLS && grid.row >= 0 && grid.row < GRID_ROWS) {
          this.engine.setHoverGrid(grid.col, grid.row);
        } else {
          this.engine.clearHover();
        }
      }
    }
  }

  onTouchEnd(e) {
    if (!this.engine) return;
    const t = e.changedTouches[0];
    const x = t.clientX;
    const y = t.clientY;

    // === 拖拽结束：尝试合并升级 ===
    if (this.dragging && this.dragTowerIdx >= 0) {
      const grid = pixelToGrid(x, y);
      if (grid.col >= 0 && grid.col < GRID_COLS && grid.row >= 0 && grid.row < GRID_ROWS) {
        const success = this.engine.mergeTower(this.dragTowerIdx, grid.col, grid.row);
        if (success) {
          this._showToast('升级成功');
        } else {
          this._showToast('无法合并升级');
        }
      }
      this.dragging = false;
      this.dragTowerIdx = -1;
      this.dragDef = null;
      return;
    }

    // 清除拖拽状态
    const wasDragCandidate = this.dragTowerIdx >= 0;
    this.dragging = false;
    this.dragTowerIdx = -1;
    this.dragDef = null;

    // === UI 按钮区域（从上到下） ===

    // 结算弹窗→返回
    if (this.resultBtn) {
      this.onSceneChange(SCENE.LEVEL_SELECT);
      return;
    }

    // 暂停按钮
    if (this.pauseBtn && this._hit(this.pauseBtn, x, y)) {
      this.engine.togglePause();
      return;
    }

    // HOME按钮
    if (this.homeBtn && this._hit(this.homeBtn, x, y)) {
      this._confirmHome = true;
      return;
    }

    // 确认返回主页弹窗
    if (this._confirmHome) {
      if (this._confirmYesBtn && this._hit(this._confirmYesBtn, x, y)) {
        this._confirmHome = false;
        this.engine.stop();
        this.onSceneChange(SCENE.HOME);
        return;
      }
      if (this._confirmNoBtn && this._hit(this._confirmNoBtn, x, y)) {
        this._confirmHome = false;
        return;
      }
      this._confirmHome = false;
      return;
    }

    // 抽卡按钮
    if (this.drawBtn && this._hit(this.drawBtn, x, y)) {
      const result = this.engine.refreshCards();
      if (!result.success) {
        this._showToast(result.reason);
      }
      return;
    }

    // 手牌选择
    if (this.handButtons) {
      for (const hb of this.handButtons) {
        if (hb.hasCard && !hb.isDisabled && this._hit(hb, x, y)) {
          this.selectedHandIndex = (this.selectedHandIndex === hb.index) ? -1 : hb.index;
          this.engine.selectedHandIndex = this.selectedHandIndex;
          this.engine.clearPlacedTowerSelection();
          return;
        }
      }
    }

    // === 地图交互 ===

    // 删除按钮（×）→ 仅删除已选中的塔
    if (this.deleteBtn && this._hit(this.deleteBtn, x, y)) {
      this.engine.removePlacedTower(this.deleteBtn.towerIdx);
      this.engine.clearPlacedTowerSelection();
      this._showToast('塔已删除');
      return;
    }

    // 放置防御塔 / 使用功能牌（手牌已选中时）
    if (this.selectedHandIndex >= 0) {
      const card = this.engine.gameState.hand[this.selectedHandIndex];

      if (card && card.isSpell) {
        const success = this.engine.useSpell(this.selectedHandIndex);
        if (success) {
          this.selectedHandIndex = -1;
          this.engine.selectedHandIndex = -1;
          this.engine.clearHover();
          this.engine.clearPlacedTowerSelection();
          this._showToast(`${card.name} 已使用!`);
          this.engine.gameState.disableAllCards();
        } else {
          this._showToast('使用失败');
        }
        return;
      }

      const grid = pixelToGrid(x, y);
      const success = this.engine.tryPlaceTower(this.selectedHandIndex, grid.col, grid.row);
      if (success) {
        this.selectedHandIndex = -1;
        this.engine.selectedHandIndex = -1;
        this.engine.clearHover();
        this._showToast('放置成功');
        this.engine.gameState.disableAllCards();
      } else {
        this._showToast('无法在此放置');
      }
      return;
    }

    // 短按塔体 → 选中（非拖拽、非手牌模式）
    const grid = pixelToGrid(x, y);
    if (grid.col >= 0 && grid.col < GRID_COLS && grid.row >= 0 && grid.row < GRID_ROWS) {
      const selected = this.engine.selectPlacedTower(grid.col, grid.row);
      if (selected) return;
    }

    // 点空地 → 取消选中
    this.engine.clearPlacedTowerSelection();
  }

  _showToast(msg) {
    // 使用 DOM toast（由 UIManager 提供），避免 Canvas 绘制后被下一帧覆盖
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = msg;
      toast.classList.add("show");
      if (this._toastTimer) clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => toast.classList.remove("show"), 1500);
    }
  }

  _hit(rect, x, y) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }
}
