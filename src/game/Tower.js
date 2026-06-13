/**
 * Tower.js - 塔实体
 * 管理塔的攻击逻辑、冷却、目标选择、等级系统
 */
export class Tower {
  /**
   * @param {object} def - 塔配置定义
   * @param {number} col - 所在列
   * @param {number} row - 所在行
   * @param {number} tileSize - 每格像素大小
   * @param {number} offsetX - 地图偏移X
   * @param {number} offsetY - 地图偏移Y
   */
  constructor(def, col, row, tileSize, offsetX, offsetY) {
    this.id = def.id;
    this.name = def.name;
    this.rarity = def.rarity;
    this.atk = def.atk;
    this.range = def.range;    // 攻击范围（格）
    this.cd = def.cd;          // 冷却（秒）
    this.color = def.color;
    this.image = def.image;

    this.col = col;
    this.row = row;
    this.tileSize = tileSize;
    this.offsetX = offsetX;
    this.offsetY = offsetY;

    // 占用格子大小（默认1×1）
    this.gridCols = def.gridCols || 1;
    this.gridRows = def.gridRows || 1;

    // 中心点（多格塔的中心在多格区域中心）
    this.x = offsetX + col * tileSize + (this.gridCols * tileSize) / 2;
    this.y = offsetY + row * tileSize + (this.gridRows * tileSize) / 2;

    this.cooldownTimer = 0;    // 当前冷却剩余
    this.target = null;        // 当前目标怪物

    // 特效
    this.isSlow = false;
    this.slowMultiplier = 0;   // 减速百分比（0不减速，0.25表示减速25%）
    this.slowDuration = 0;     // 减速持续秒数

    // 等级系统
    this.level = 1;            // 默认1级
    this.levelStats = def.levelStats || null; // 等级属性数组

    // 动画系统
    this.animTime = 0;         // 动画累计时间
    this.attackFlash = 0;      // 攻击闪光倒计时
  }

  /**
   * 更新动画
   * @param {number} dt - 帧间隔秒数
   */
  updateAnim(dt) {
    this.animTime += dt;
    if (this.attackFlash > 0) this.attackFlash -= dt;
  }

  /**
   * 触发攻击闪光
   */
  triggerAttackFlash() {
    this.attackFlash = 0.2; // 0.2秒闪光
  }

  /**
   * 获取呼吸缩放值（基于animTime的正弦波动）
   */
  getBreathScale() {
    return 1.0 + Math.sin(this.animTime * 2.5) * 0.04;
  }

  /**
   * 获取当前等级属性
   * @returns {{atk: number, range: number, cd: number}}
   */
  getCurrentLevelStats() {
    if (this.levelStats && this.level >= 1 && this.level <= this.levelStats.length) {
      return this.levelStats[this.level - 1];
    }
    return { atk: this.atk, range: this.range, cd: this.cd };
  }

  /**
   * 应用当前等级属性到塔
   */
  applyLevelStats() {
    const stats = this.getCurrentLevelStats();
    this.atk = stats.atk;
    this.range = stats.range;
    this.cd = stats.cd;
  }

  /**
   * 升级：等级+1，重新计算属性
   * @returns {boolean} 是否升级成功
   */
  upgrade() {
    if (this.level >= 5) return false;
    this.level++;
    this.applyLevelStats();
    return true;
  }

  /**
   * 更新位置（拖拽移动时调用）
   */
  updatePosition(col, row) {
    this.col = col;
    this.row = row;
    this.x = this.offsetX + col * this.tileSize + (this.gridCols * this.tileSize) / 2;
    this.y = this.offsetY + row * this.tileSize + (this.gridRows * this.tileSize) / 2;
  }

  /**
   * 检查冷却状态
   */
  isReady() { return this.cooldownTimer <= 0; }

  /**
   * 尝试攻击范围内的怪物
   * @param {Array} monsters - 所有存活怪物
   * @param {number} dt - 时间差
   * @returns {object|null} {target, damage}
   */
  tryAttack(monsters, dt) {
    this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    if (!this.isReady()) return null;

    const rangePx = this.range * this.tileSize;
    let bestTarget = null;
    let bestProgress = -1;

    for (const m of monsters) {
      if (!m.alive || m.reached) continue;

      const dx = m.x - this.x;
      const dy = m.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= rangePx) {
        // 优先攻击离终点最近的（进度最大）
        const p = m.pathIndex + m.progress;
        if (p > bestProgress) {
          bestProgress = p;
          bestTarget = m;
        }
      }
    }

    if (bestTarget) {
      this.cooldownTimer = this.cd;
      this.target = bestTarget;
      this.triggerAttackFlash(); // 攻击命中时直接触发闪光

      // 减速效果
      if (this.isSlow) {
        bestTarget.applySlow(1 - this.slowMultiplier, this.slowDuration);
      }

      return { target: bestTarget, damage: this.atk };
    }

    return null;
  }
}
