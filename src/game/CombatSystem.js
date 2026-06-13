/**
 * CombatSystem.js - 战斗系统
 * 每帧协调：塔攻击 → 怪物受伤 → 怪物移动 → 到达终点扣血 → 清理死亡
 */
import { AudioManager } from "../audio/AudioManager.js";

export class CombatSystem {
  constructor() {
    this.effects = [];  // 视觉特效队列 [{type, x, y, ...}]
  }

  /**
   * 每帧更新战斗
   * @param {GameState} gameState
   * @param {Array} monsters - 怪物数组
   * @param {number} dt - 秒
   * @param {number} tileSize
   * @param {number} offsetX
   * @param {number} offsetY
   * @returns {{hpLost: number, goldGained: number, effects: Array}}
   */
  update(gameState, monsters, dt, tileSize, offsetX, offsetY) {
    let hpLost = 0;
    let goldGained = 0;
    this.effects = [];

    // 1. 塔攻击
    for (const pt of gameState.placedTowers) {
      const result = pt.tower.tryAttack(monsters, dt);
      if (result) {
        result.target.takeDamage(result.damage);
        this.effects.push({
          type: 'attack',
          fromX: pt.tower.x, fromY: pt.tower.y,
          toX: result.target.x, toY: result.target.y
        });
        // 根据塔类型播放攻击音效
        const sfxType = pt.towerDef.sfxType || "arrow";
        AudioManager.playAttack(sfxType);

        // 击杀检查
        if (!result.target.alive) {
          goldGained += result.target.reward;
          this.effects.push({
            type: 'kill',
            x: result.target.x,
            y: result.target.y,
            reward: result.target.reward
          });
          AudioManager.playKill();
        }
      }
    }

    // 2. 怪物移动
    for (const m of monsters) {
      if (m.alive && !m.reached) {
        m.update(dt);
      }
    }

    // 3. 到达终点后移除并扣血
    const reachedMonsters = monsters.filter(m => m.reached);
    for (const rm of reachedMonsters) {
      hpLost += rm.damage;
      rm.alive = false;
    }

    // 4. 清理死亡（alive=false）的怪物
    // 调用侧负责 splice

    return { hpLost, goldGained, effects: this.effects };
  }

  /**
   * 是否可以在此位置建塔（支持多格塔）
   * @param {Array} grid - 二维数组
   * @param {Array} placedTowers - 已放置的塔
   * @param {number} col - 左上角列
   * @param {number} row - 左上角行
   * @param {object} [towerDef] - 手牌中的塔定义（可选，用于合并判断）
   */
  static canPlace(grid, placedTowers, col, row, towerDef) {
    const gridCols = (towerDef && towerDef.gridCols) || 1;
    const gridRows = (towerDef && towerDef.gridRows) || 1;

    // 边界检查
    if (col < 0 || col + gridCols > grid[0].length || row < 0 || row + gridRows > grid.length) return false;

    // 功能牌不能放置到地图上
    if (towerDef && towerDef.isSpell) return false;

    // 检查所有占用格子是否都是空地（grid=0）
    for (let dr = 0; dr < gridRows; dr++) {
      for (let dc = 0; dc < gridCols; dc++) {
        if (grid[row + dr][col + dc] !== 0) return false;
      }
    }

    // 检查是否有已放置塔占用这些格子
    // 注意：完全重叠（同位置同尺寸同类型同等级）允许合并升级，
    // 此时格子类型仍为 0（空地），所以不会被上面的格子类型检查拦截。
    for (const pt of placedTowers) {
      const ptGC = pt.towerDef.gridCols || 1;
      const ptGR = pt.towerDef.gridRows || 1;
      // 判断两个矩形是否重叠
      const overlap = !(col + gridCols <= pt.col || pt.col + ptGC <= col ||
                        row + gridRows <= pt.row || pt.row + ptGR <= row);
      if (overlap) {
        // 完全重叠（同位置同尺寸）才允许合并，部分重叠一律失败
        const isExactOverlap = (col === pt.col && row === pt.row
          && gridCols === ptGC && gridRows === ptGR);
        if (isExactOverlap && towerDef) {
          const cardLevel = towerDef.level || 1;
          if (pt.towerDef.id === towerDef.id
            && pt.tower.level === cardLevel
            && pt.tower.level < 5) {
            return true; // 完全重叠+同类型+同等级 → 可合并升级
          }
        }
        return false; // 部分重叠 或 不满足合并条件 → 失败
      }
    }

    return true; // 无冲突，可放置
  }
}
