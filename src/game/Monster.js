/**
 * Monster.js - 怪物实体
 * 管理单个怪物的状态：位置、血量、类型、移动进度
 */
export class Monster {
  /**
   * @param {object} def - 怪物配置定义
   * @param {Array} path - 路径节点 [{col,row}, ...]
   * @param {number} tileSize - 每格像素大小
   */
  constructor(def, path, tileSize, offsetX, offsetY) {
    this.id = def.id;
    this.name = def.name;
    this.type = def.type;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.speed = def.speed;     // 格/秒
    this.damage = def.damage;   // 到达终点伤害
    this.reward = def.reward;   // 击杀金币
    this.color = def.color;
    this.image = def.image;
    this.animDataUrl = def.animDataUrl;

    // 运行时动画图（从配置传入的上传图片）
    this._animImage = def._animImage || null;

    // 序列帧动画配置
    this.anim = def.anim || null; // { frameWidth, frameHeight, frameCount, frameRate }
    this._animFrameIndex = 0;
    this._animFrameTimer = 0;

    this.path = path;
    this.tileSize = tileSize;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.pathIndex = 0;        // 当前目标路径点索引
    this.progress = 0;         // 当前段进度 0→1

    // 初始位置设为第一个路径点
    this.x = offsetX + path[0].col * tileSize + tileSize / 2;
    this.y = offsetY + path[0].row * tileSize + tileSize / 2;

    this.alive = true;
    this.reached = false;      // 是否到达终点
    this._direction = 'down';  // 当前移动方向: down/left/up/right

    // 减速效果
    this.slowMultiplier = 1.0;
    this.slowTimer = 0;

    // 动画系统
    this.animTime = 0;       // 动画累计时间
    this.hitFlash = 0;       // 受击闪白倒计时
  }

  takeDamage(dmg) {
    this.hp -= dmg;
    this.hitFlash = 0.15; // 受击闪白0.15秒
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  applySlow(multiplier, duration) {
    this.slowMultiplier = multiplier;
    this.slowTimer = duration;
  }

  /**
   * 移动到下一路径点
   * @param {number} dt 秒
   */
  update(dt) {
    if (!this.alive || this.reached) return;

    // 减速时间更新
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowMultiplier = 1.0;
      }
    }

    // 动画时间更新
    this.animTime += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    // 序列帧更新（支持多方向布局）
    if (this._animImage && this.anim) {
      const dir = this._direction || 'down';
      let frameCount = this.anim.frameCount;
      if (this.anim.directions && this.anim.directions[dir]) {
        frameCount = this.anim.directions[dir].frameCount;
      }
      if (frameCount > 1) {
        this._animFrameTimer += dt;
        const frameInterval = 1 / (this.anim.frameRate || 8);
        if (this._animFrameTimer >= frameInterval) {
          this._animFrameTimer -= frameInterval;
          this._animFrameIndex = (this._animFrameIndex + 1) % frameCount;
        }
      }
    }

    const effectiveSpeed = this.speed * this.slowMultiplier;
    let step = effectiveSpeed * dt;

    // 限制单帧最大移动距离，防止切后台回来后怪物瞬移
    const maxStepPerFrame = 2.0; // 最多跨 2 个路径段
    step = Math.min(step, maxStepPerFrame);
    this.progress += step;

    // 到达当前路径点 → 前进到下一个（逐点更新位置，避免视觉跳过）
    while (this.progress >= 1.0 && this.pathIndex < this.path.length - 1) {
      this.progress -= 1.0;
      this.pathIndex++;
    }

    // 如果到达了最终路径点
    if (this.pathIndex >= this.path.length - 1) {
      this.reached = true;
      this.progress = 1.0;
      const last = this.path[this.path.length - 1];
      this.x = this.offsetX + last.col * this.tileSize + this.tileSize / 2;
      this.y = this.offsetY + last.row * this.tileSize + this.tileSize / 2;
      return;
    }

    // 插值计算当前位置
    const cur = this.path[this.pathIndex];
    const nxt = this.path[this.pathIndex + 1];
    this.x = this.offsetX + (cur.col + (nxt.col - cur.col) * this.progress) * this.tileSize + this.tileSize / 2;
    this.y = this.offsetY + (cur.row + (nxt.row - cur.row) * this.progress) * this.tileSize + this.tileSize / 2;

    // 根据路径方向自动识别当前朝向
    const dx = nxt.col - cur.col;
    const dy = nxt.row - cur.row;
    if (Math.abs(dx) > Math.abs(dy)) {
      this._direction = dx > 0 ? 'right' : 'left';
    } else if (Math.abs(dy) > Math.abs(dx)) {
      this._direction = dy > 0 ? 'down' : 'up';
    }
    // 如果 dx===dy===0 或相等，保持原有方向不变
  }
}
