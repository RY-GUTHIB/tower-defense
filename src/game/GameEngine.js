/**
 * GameEngine.js - 游戏主引擎
 *
 * 主循环: update → render
 * 管理 GameState、WaveManager、CombatSystem、GachaSystem 的协作
 */

// 跨平台 RAF 适配
const _raf = (typeof tt !== 'undefined' && tt.requestAnimationFrame)
  ? fn => tt.requestAnimationFrame(fn)
  : fn => window.requestAnimationFrame(fn);
const _caf = (typeof tt !== 'undefined' && tt.cancelAnimationFrame)
  ? id => tt.cancelAnimationFrame(id)
  : id => window.cancelAnimationFrame(id);

import { GameState, STATE } from './GameState.js';
import { WaveManager } from './WaveManager.js';
import { CombatSystem } from './CombatSystem.js';
import { GachaSystem } from './GachaSystem.js';
import { Monster } from './Monster.js';
import { Tower } from './Tower.js';
import { ConfigManager } from '../data/ConfigManager.js';
import { ProgressManager } from '../utils/ProgressManager.js';
import { TILE_SIZE, MAP_OFFSET_X, MAP_OFFSET_Y, GRID_COLS, GRID_ROWS } from '../utils/DrawUtil.js';

export class GameEngine {
  /**
   * @param {object} levelData - 关卡数据
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} screenW
   * @param {number} screenH
   * @param {Function} onUpdateUICallback - 状态变化通知回调
   */
  constructor(levelData, ctx, screenW, screenH, onUpdateUICallback) {
    this.levelData = levelData;
    this.ctx = ctx;
    this.screenW = screenW;
    this.screenH = screenH;
    this.onUpdateUI = onUpdateUICallback;

    this.gameState = new GameState(levelData);
    this.waveManager = new WaveManager(levelData);
    this.combat = new CombatSystem();
    this.gacha = new GachaSystem();

    this.monsters = [];         // 场上所有怪物

    // 波次启动标记
    this.waveActive = false;

    // 帧循环
    this.lastTime = 0;
    this.animId = null;
    this.running = false;

    // 交互状态
    this.hoverCol = -1;
    this.hoverRow = -1;
    this.selectedPlacedTowerIdx = -1;
    this.selectedHandIndex = -1;  // 由GamePage设置
    this._snapshot = {};  // 复用对象，减少 GC
  }

  start() {
    this.gameState.start();
    this.running = true;
    this.lastTime = Date.now();
    this._loop();
  }

  stop() {
    this.running = false;
    if (this.animId) _caf(this.animId);
  }

  // === 主循环 ===
  _loop() {
    if (!this.running) return;

    const now = Date.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // 秒，上限0.1防跳帧
    this.lastTime = now;

    this._update(dt);
    this._render();

    // HUD绘制在地图之上
    if (this.onUpdateUI) {
      this.onUpdateUI(this.getSnapshot());
    }

    this.animId = _raf(() => this._loop());
  }

  _update(dt) {
    if (!this.gameState.isRunning()) return;

    const gs = this.gameState;
    const wm = this.waveManager;

    // 波次管理
    if (!this.waveActive) {
      if (!wm.allWavesDone) {
        wm.startNextWave();
        this.waveActive = true;
      }
    }

    if (this.waveActive) {
      const spawn = gs.level.spawn || { col: 0, row: 0 };
      const newMonsters = wm.update(dt, spawn.col, spawn.row);

      // 生成新怪物
      for (const nm of newMonsters) {
        const def = ConfigManager.getMonsters().find(m => m.id === nm.id);
        if (def) {
          this.monsters.push(new Monster(def, gs.level.path, TILE_SIZE, MAP_OFFSET_X, MAP_OFFSET_Y));
        }
      }

      if (wm.waveComplete) {
        if (wm.allWavesDone && this.monsters.length === 0) {
          gs.state = STATE.VICTORY;
          ProgressManager.markLevelCleared(this.levelData.id);
          ProgressManager.addGold(gs.gold);
        } else if (!wm.allWavesDone) {
          // 当前波次怪已全部生成，等待进入下一波
          this.waveActive = false;
        }
      }
    }

    // 战斗更新
    const { hpLost, goldGained } = this.combat.update(
      gs, this.monsters, dt, TILE_SIZE, MAP_OFFSET_X, MAP_OFFSET_Y
    );

    // 扣血 & 加金
    if (hpLost > 0) gs.takeDamage(hpLost);
    if (goldGained > 0) gs.addGold(goldGained);

    // 动画更新
    for (const pt of gs.placedTowers) {
      pt.tower.updateAnim(dt);
    }
    // 攻击闪光已由 Tower.tryAttack() 命中时直接触发，无需额外检测

    // 清除死亡/到达怪物
    this.monsters = this.monsters.filter(m => m.alive);
  }

  _render() {
    const ctx = this.ctx;
    const gs = this.gameState;

    ctx.clearRect(0, 0, this.screenW, this.screenH);

    // 地图底纹
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(0, 0, this.screenW, this.screenH);

    // 渲染网格
    this._renderGrid(ctx, gs);

    // 渲染已放置塔
    this._renderTowers(ctx, gs);

    // 渲染范围预览（选中手牌时）
    if (this.hoverCol >= 0 && this.hoverRow >= 0) {
      this._renderRangePreview(ctx, gs);
    }

    // 渲染已放置塔范围（选中已放置塔时）
    if (this.selectedPlacedTowerIdx >= 0 && this.selectedPlacedTowerIdx < gs.placedTowers.length) {
      this._renderPlacedTowerRange(ctx, gs.placedTowers[this.selectedPlacedTowerIdx]);
    }

    // 渲染怪物
    this._renderMonsters(ctx);

    // 渲染HUD (由UI模块负责叠加绘制)
  }

  /**
   * 渲染网格地图
   */
  _renderGrid(ctx, gs) {
    const grid = gs.level.grid;
    const rows = grid.length;
    const cols = grid[0].length;
    const mapW = cols * TILE_SIZE;
    const mapH = rows * TILE_SIZE;

    // 背景图
    if (gs.level._bgImage) {
      try { ctx.drawImage(gs.level._bgImage, MAP_OFFSET_X, MAP_OFFSET_Y, mapW, mapH); } catch(e) {}
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = MAP_OFFSET_X + c * TILE_SIZE;
        const y = MAP_OFFSET_Y + r * TILE_SIZE;
        const cell = grid[r][c];

        if (cell === 1) {
          // 路径：贴图优先
          if (gs.level._pathImage) {
            try { ctx.drawImage(gs.level._pathImage, x, y, TILE_SIZE, TILE_SIZE); } catch(e) {
              ctx.fillStyle = '#795548';
              ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            }
          } else {
            ctx.fillStyle = '#795548';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = '#5D4037';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          }
        } else if (cell === 2) {
          // 障碍
          ctx.fillStyle = '#546E7A';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        } else {
          // 空地 (可建塔)
          ctx.fillStyle = '#388E3C';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = '#43A047';
          ctx.lineWidth = 0.3;
          ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        }

        // 出生点和终点标记
        const spawn = gs.level.spawn;
        const goal = gs.level.goal;
        if (spawn && c === spawn.col && r === spawn.row) {
          ctx.fillStyle = 'rgba(0, 200, 83, 0.3)';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#00C853';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('起点', x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 3);
        }
        if (goal && c === goal.col && r === goal.row) {
          // 终点贴图（可配置）
          if (gs.level._goalImage) {
            try { ctx.drawImage(gs.level._goalImage, x, y, TILE_SIZE, TILE_SIZE); } catch(e) {}
          } else {
            ctx.fillStyle = 'rgba(244, 67, 54, 0.3)';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#F44336';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('终点', x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 3);
          }
          // 终点血量显示在终点上方（current/total格式）
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${gs.hp}/${gs.maxHp}`, x + TILE_SIZE / 2, y - 4);
        }
      }
    }
  }

  /**
   * 渲染已放置的塔（支持多格）
   */
  _renderTowers(ctx, gs) {
    for (const pt of gs.placedTowers) {
      const gc = pt.towerDef.gridCols || 1;
      const gr = pt.towerDef.gridRows || 1;
      const x = MAP_OFFSET_X + pt.col * TILE_SIZE;
      const y = MAP_OFFSET_Y + pt.row * TILE_SIZE;
      const tw = gc * TILE_SIZE;
      const th = gr * TILE_SIZE;
      const t = pt.tower;
      const breathScale = t.getBreathScale();
      const size = (Math.min(tw, th) - 8) * breathScale;

      // 检查是否有上传的动画图
      const towerAnimImg = pt.towerDef._animImage;
      if (towerAnimImg) {
        try {
          const towerAnim = pt.towerDef.anim;
          if (towerAnim && towerAnim.frameCount > 1) {
            // 序列帧模式
            const fw = towerAnim.frameWidth || (towerAnimImg.width / towerAnim.frameCount);
            const fh = towerAnim.frameHeight || towerAnimImg.height;
            const fi = Math.floor(t.animTime * (towerAnim.frameRate || 4)) % towerAnim.frameCount;
            ctx.drawImage(
              towerAnimImg,
              fi * fw, 0, fw, fh,
              x + (tw - size) / 2, y + (th - size) / 2, size, size
            );
          } else {
            ctx.drawImage(towerAnimImg, x + (tw - size) / 2, y + (th - size) / 2, size, size);
          }
        } catch(e) {
          // fallback to code draw
        }
      } else {
        // 根据等级调整颜色亮度
        const levelColors = ['#78909C', '#66BB6A', '#FFD54F', '#FF7043', '#E040FB'];
        const levelColor = t.level >= 1 && t.level <= 5
          ? levelColors[t.level - 1]
          : pt.towerDef.color || '#607D8B';

        const cx = x + tw / 2;
        const cy = y + th / 2;

        ctx.save();
        ctx.translate(cx, cy);

        // 攻击闪光效果
        if (t.attackFlash > 0) {
          ctx.scale(1.15, 1.15);
          ctx.shadowColor = '#FFD54F';
          ctx.shadowBlur = 12;
        }

        ctx.fillStyle = levelColor;
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-size / 2, -size / 2, size, size);

        ctx.restore();
      }

      // 等级显示
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Lv.${t.level}`, x + tw / 2, y + 12);
    }
  }

  /**
   * 渲染怪物
   */
  _renderMonsters(ctx) {
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const x = m.x;
      // 行走弹跳动画
      const bounceY = Math.sin(m.animTime * 6) * 2;
      const y = m.y + bounceY;
      const r = TILE_SIZE * 0.35;

      // 检查是否有上传的动画图（_animImage 优先，兼容 animDataUrl）
      const animImg = m._animImage;
      if (animImg) {
        try {
          ctx.save();
          if (m.hitFlash > 0) ctx.globalAlpha = 0.6;

          // 序列帧模式
          const hasAnim = m.anim && (m.anim.frameCount > 1 || (m.anim.directions && m.anim.directions[m._direction || 'down']));
          // 诊断日志：首次渲染时输出动画状态
          if (!this._animLogged) {
            this._animLogged = true;
            console.log('[GameEngine] 怪物渲染诊断:', {
              hasAnim,
              anim: m.anim ? JSON.parse(JSON.stringify(m.anim)) : null,
              hasDirections: !!(m.anim && m.anim.directions),
              direction: m._direction,
              frameIndex: m._animFrameIndex,
              imgWidth: animImg ? animImg.width : 'N/A',
              imgHeight: animImg ? animImg.height : 'N/A'
            });
          }
          if (hasAnim) {
            const dir = m._direction || 'down';
            let frameCount, fh, srcRow;
            if (m.anim.directions && m.anim.directions[dir]) {
              const dirInfo = m.anim.directions[dir];
              frameCount = dirInfo.frameCount;
              srcRow = dirInfo.row;
              // 帧宽优先用 directions 里的，回退 anim.frameWidth 或从图片宽度算
            } else {
              frameCount = m.anim.frameCount;
              srcRow = 0;
            }
            const fw = m.anim.frameWidth || (animImg.width / frameCount);
            fh = m.anim.frameHeight || animImg.height;
            const fi = m._animFrameIndex % frameCount;
            const drawSize = r * 2;
            ctx.drawImage(
              animImg,
              fi * fw, srcRow * fh, fw, fh,
              x - drawSize / 2, y - drawSize / 2, drawSize, drawSize
            );
          } else {
            // 单图模式
            const imgSize = r * 2;
            ctx.drawImage(animImg, x - imgSize / 2, y - imgSize / 2, imgSize, imgSize);
          }

          ctx.restore();
        } catch(e) {
          // fallback to code draw below
        }
      } else {
        // 受击闪白效果
        const isFlashing = m.hitFlash > 0;
        ctx.fillStyle = isFlashing ? '#fff' : (m.color || '#F44336');

        if (m.type === 'boss') {
          // 菱形
          ctx.beginPath();
          ctx.moveTo(x, y - r * 1.4);
          ctx.lineTo(x + r * 1.4, y);
          ctx.lineTo(x, y + r * 1.4);
          ctx.lineTo(x - r * 1.4, y);
          ctx.closePath();
          ctx.fill();
        } else if (m.type === 'elite') {
          // 方形
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
          ctx.strokeStyle = isFlashing ? '#FF0' : '#000';
          ctx.lineWidth = 1;
          ctx.strokeRect(x - r, y - r, r * 2, r * 2);
        } else {
          // 圆形
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 血条
      const hpRatio = m.hp / m.maxHp;
      const barW = TILE_SIZE * 0.7;
      const barH = 4;
      const barX = x - barW / 2;
      const barY = y - r * 1.6 - Math.abs(bounceY);

      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? '#4CAF50' : hpRatio > 0.25 ? '#FF9800' : '#F44336';
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
    }
  }

  /**
   * 渲染范围预览（选中手牌时悬停格子，支持多格塔）
   */
  _renderRangePreview(ctx, gs) {
    if (this.selectedHandIndex < 0 || this.selectedHandIndex >= gs.hand.length) return;
    const towerDef = gs.hand[this.selectedHandIndex];
    if (towerDef.isSpell) return;

    const gridCols = towerDef.gridCols || 1;
    const gridRows = towerDef.gridRows || 1;
    const range = towerDef.range;

    // 多格塔的中心 = 悬停格左上 + 半格偏移
    const centerGridCol = this.hoverCol + gridCols / 2;
    const centerGridRow = this.hoverRow + gridRows / 2;
    const cx = MAP_OFFSET_X + centerGridCol * TILE_SIZE;
    const cy = MAP_OFFSET_Y + centerGridRow * TILE_SIZE;

    const canPlace = CombatSystem.canPlace(gs.level.grid, gs.placedTowers, this.hoverCol, this.hoverRow, towerDef);

    const rangePx = range * TILE_SIZE;
    // 圆圈填充
    ctx.fillStyle = canPlace ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.15)';
    ctx.beginPath();
    ctx.arc(cx, cy, rangePx, 0, Math.PI * 2);
    ctx.fill();
    // 圆圈描边
    ctx.strokeStyle = canPlace ? 'rgba(76,175,80,0.7)' : 'rgba(244,67,54,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, rangePx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // 高亮占用格子
    for (let dr = 0; dr < gridRows; dr++) {
      for (let dc = 0; dc < gridCols; dc++) {
        const tx = MAP_OFFSET_X + (this.hoverCol + dc) * TILE_SIZE;
        const ty = MAP_OFFSET_Y + (this.hoverRow + dr) * TILE_SIZE;
        ctx.fillStyle = canPlace ? 'rgba(76,175,80,0.4)' : 'rgba(244,67,54,0.3)';
        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = canPlace ? '#4CAF50' : '#F44336';
        ctx.lineWidth = 2;
        ctx.strokeRect(tx, ty, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  /**
   * 渲染已放置塔的范围（选中时）
   */
  _renderPlacedTowerRange(ctx, pt) {
    const t = pt.tower;
    const rangePx = t.range * TILE_SIZE;
    ctx.fillStyle = 'rgba(255,215,0,0.12)';
    ctx.beginPath();
    ctx.arc(t.x, t.y, rangePx, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(t.x, t.y, rangePx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // === 外部交互接口 ===

  /** 点击地图格子放置塔或使用功能牌 */
  tryPlaceTower(handIndex, col, row) {
    const gs = this.gameState;
    if (!gs.isRunning()) return false;
    if (handIndex < 0 || handIndex >= gs.hand.length) return false;

    // 检查手牌是否被禁用
    if (gs.handDisabled[handIndex]) return false;

    const card = gs.hand[handIndex];

    // 功能牌：直接使用，无需放置
    if (card.isSpell) {
      return this.useSpell(handIndex);
    }

    const towerDef = card;
    const cardLevel = towerDef.level || 1;

    // 检查合并：目标格有完全重叠+同类型+同等级塔（且<5级）→ 合并升级
    const existingIdx = gs.placedTowers.findIndex(
      pt => {
        const ptGC = pt.towerDef.gridCols || 1;
        const ptGR = pt.towerDef.gridRows || 1;
        const cardGC = towerDef.gridCols || 1;
        const cardGR = towerDef.gridRows || 1;
        return pt.col === col && pt.row === row
          && ptGC === cardGC && ptGR === cardGR
          && pt.towerDef.id === towerDef.id
          && pt.tower.level === cardLevel
          && pt.tower.level < 5;
      }
    );

    if (existingIdx >= 0) {
      // 合并升级：从手牌移除，升级已有塔
      gs.hand.splice(handIndex, 1);
      gs.handDisabled.splice(handIndex, 1);
      gs.placedTowers[existingIdx].tower.upgrade();
      // 不重置手牌锁定：刷新前只能用已选的牌
      return true;
    }

    const canPlace = CombatSystem.canPlace(gs.level.grid, gs.placedTowers, col, row, towerDef);
    if (!canPlace) return false;

    gs.hand.splice(handIndex, 1);
    gs.handDisabled.splice(handIndex, 1);
    const tower = new Tower(towerDef, col, row, TILE_SIZE, MAP_OFFSET_X, MAP_OFFSET_Y);
    tower.level = cardLevel;
    tower.applyLevelStats();
    gs.placeTower(towerDef, col, row, tower);
    // 不重置手牌锁定：刷新前只能用已选的牌
    return true;
  }

  /** 使用功能牌 */
  useSpell(handIndex) {
    const gs = this.gameState;
    if (handIndex < 0 || handIndex >= gs.hand.length) return false;
    if (gs.handDisabled[handIndex]) return false;

    const spell = gs.hand[handIndex];
    if (!spell.isSpell || !spell.execute) return false;

    // 执行功能牌效果
    spell.execute(gs, this.monsters);

    // 从手牌移除
    gs.hand.splice(handIndex, 1);
    gs.handDisabled.splice(handIndex, 1);

    return true;
  }

  /** 抽卡（单抽） */
  drawCard() {
    return this.gacha.draw(this.gameState);
  }

  /** 刷新4张牌 */
  refreshCards() {
    return this.gacha.draw4(this.gameState);
  }

  /** 设置悬停格子 */
  setHoverGrid(col, row) { this.hoverCol = col; this.hoverRow = row; }

  /** 清除悬停 */
  clearHover() { this.hoverCol = -1; this.hoverRow = -1; }

  /** 选中已放置塔（支持多格塔） */
  selectPlacedTower(col, row) {
    this.selectedPlacedTowerIdx = -1;
    const gs = this.gameState;
    for (let i = 0; i < gs.placedTowers.length; i++) {
      const pt = gs.placedTowers[i];
      const gc = pt.towerDef.gridCols || 1;
      const gr = pt.towerDef.gridRows || 1;
      // 检查点击位置是否在该塔占用的格子内
      if (col >= pt.col && col < pt.col + gc && row >= pt.row && row < pt.row + gr) {
        this.selectedPlacedTowerIdx = i;
        return pt;
      }
    }
    return null;
  }

  /** 清除已放置塔选择 */
  clearPlacedTowerSelection() { this.selectedPlacedTowerIdx = -1; }

  /** 删除已放置的塔 */
  removePlacedTower(idx) {
    const gs = this.gameState;
    if (idx < 0 || idx >= gs.placedTowers.length) return false;
    gs.placedTowers.splice(idx, 1);
    this.selectedPlacedTowerIdx = -1;
    return true;
  }

  /** 检查是否可以合并升级（拖拽松手后判定） */
  canMergeTower(towerIdx, newCol, newRow) {
    const gs = this.gameState;
    if (towerIdx < 0 || towerIdx >= gs.placedTowers.length) return false;
    const pt = gs.placedTowers[towerIdx];
    const towerDef = pt.towerDef;
    const gc = towerDef.gridCols || 1;
    const gr = towerDef.gridRows || 1;

    // 边界检查
    if (newCol < 0 || newCol + gc > GRID_COLS || newRow < 0 || newRow + gr > GRID_ROWS) return false;

    // 查找目标位置是否有完全重叠的同ID同等级塔可以合并升级
    for (let i = 0; i < gs.placedTowers.length; i++) {
      if (i === towerIdx) continue;
      const other = gs.placedTowers[i];
      const ogc = other.towerDef.gridCols || 1;
      const ogr = other.towerDef.gridRows || 1;
      // 完全重叠判定：同col/row/gridCols/gridRows
      const isExactOverlap = (newCol === other.col && newRow === other.row && gc === ogc && gr === ogr);
      if (isExactOverlap) {
        // 同ID同等级且等级<5 → 可以合并升级
        if (other.towerDef.id === towerDef.id && other.tower.level === pt.tower.level && other.tower.level < 5) {
          return true;
        }
      }
    }

    return false; // 不能移动（只能合并升级，不能移动到空地）
  }

  /** 合并升级：拖拽塔到同ID同等级塔上，目标塔等级+1，拖拽塔删除 */
  mergeTower(towerIdx, newCol, newRow) {
    const gs = this.gameState;
    if (!this.canMergeTower(towerIdx, newCol, newRow)) return false;

    const pt = gs.placedTowers[towerIdx];
    const towerDef = pt.towerDef;
    const gc = towerDef.gridCols || 1;
    const gr = towerDef.gridRows || 1;

    // 找到目标塔并升级
    for (let i = 0; i < gs.placedTowers.length; i++) {
      if (i === towerIdx) continue;
      const other = gs.placedTowers[i];
      const ogc = other.towerDef.gridCols || 1;
      const ogr = other.towerDef.gridRows || 1;
      const isExactOverlap = (newCol === other.col && newRow === other.row && gc === ogc && gr === ogr);
      if (isExactOverlap && other.towerDef.id === towerDef.id && other.tower.level === pt.tower.level && other.tower.level < 5) {
        // 升级目标塔
        other.tower.upgrade();
        // 删除拖拽的塔
        gs.placedTowers.splice(towerIdx, 1);
        this.selectedPlacedTowerIdx = -1;
        return true;
      }
    }

    return false;
  }

  /** 切换暂停 */
  togglePause() {
    this.gameState.pause();
  }

  /** 获取当前状态快照 */
  getSnapshot() {
    const gs = this.gameState;
    const s = this._snapshot;
    s.state = gs.state;
    s.hp = gs.hp;
    s.maxHp = gs.maxHp;
    s.gold = gs.gold;
    s.currentWave = this.waveManager.currentWaveIndex;
    s.totalWaves = this.waveManager.totalWaves;
    s.hand = gs.hand;
    s.handDisabled = gs.handDisabled;
    s.placedTowers = gs.placedTowers;
    s.selectedPlacedTowerIdx = this.selectedPlacedTowerIdx;
    s.drawCount = gs.drawCount;
    s.pityCounter = gs.pityCounter;
    s.drawCost = this.gacha.getCurrentCost();
    return s;
  }
}
