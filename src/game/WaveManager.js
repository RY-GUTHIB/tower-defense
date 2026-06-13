/**
 * WaveManager.js - 波次管理
 * 按关卡配置逐波生成怪物，每波之间有间隔计时
 */
export class WaveManager {
  constructor(levelData) {
    this.waves = levelData.waves;
    this.totalWaves = this.waves.length;
    this.currentWaveIndex = 0;
    this.spawnQueue = [];        // 待生成的怪物队列 [{id, col, row}]
    this.waveComplete = true;
    this.allWavesDone = false;

    // 计时器
    this.delayTimer = 0;        // 当前波次延迟计时
    this.spawnIndex = 0;        // 本波已生成总数
    this._groupsInitialized = false;
  }

  /**
   * 开始下一波
   * @returns {boolean} 是否有新波次
   */
  startNextWave() {
    if (this.currentWaveIndex >= this.totalWaves) {
      this.allWavesDone = true;
      return false;
    }
    const wave = this.waves[this.currentWaveIndex];
    this.delayTimer = wave.delay || 2;
    this.spawnIndex = 0;
    this._groupsInitialized = false;
    this.waveComplete = false;
    return true;
  }

  /**
   * 每帧更新
   * @param {number} dt 秒
   * @param {number} spawnCol 出怪列
   * @param {number} spawnRow 出怪行
   * @returns {Array} 本帧新生成的怪物 [{id, col, row}]
   */
  update(dt, spawnCol, spawnRow) {
    const spawned = [];

    if (this.waveComplete) return spawned;
    if (this.allWavesDone) return spawned;

    const wave = this.waves[this.currentWaveIndex];

    // 延迟中
    if (this.delayTimer > 0) {
      this.delayTimer -= dt;
      return spawned;
    }

    // 每波开始时初始化各组独立追踪
    if (this.spawnIndex === 0 && !this._groupsInitialized) {
      for (const group of wave.monsters) {
        group._spawned = 0;
        group._timer = 0;
      }
      this._groupsInitialized = true;
    }

    let allDone = true;

    // 每组怪物独立计时和计数
    for (const group of wave.monsters) {
      const total = group.count || 1;
      const interval = group.interval || 1.5;

      if (group._spawned >= total) continue;
      allDone = false;

      group._timer -= dt;
      if (group._timer <= 0) {
        spawned.push({ id: group.id, col: spawnCol, row: spawnRow });
        group._spawned++;
        this.spawnIndex++;
        group._timer = interval;
      }
    }

    // 全部生成完 → 标记波次完成
    if (allDone) {
      this.waveComplete = true;
      this._groupsInitialized = false;
      this.currentWaveIndex++;
      if (this.currentWaveIndex >= this.totalWaves) {
        this.allWavesDone = true;
      }
    }

    return spawned;
  }
}
