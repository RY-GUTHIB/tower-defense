/**
 * levels.js - 关卡配置（含前2关完整地图和波次数据）
 *
 * 地图说明：
 *   grid: 16列 × 12行 的二维数组
 *   0 = 空地（可建塔）
 *   1 = 路径（怪物行走）
 *   2 = 障碍/装饰（不可建塔、不可走）
 *   path: 怪物行进路径坐标数组 [{col, row}, ...]，顺序即行走顺序
 *
 * 波次说明：
 *   每关15波，第5/10波精英，第15波BOSS
 *   wave格式: { monsters: [{id, count, interval}], delay: 进波前等待秒数 }
 */

function makeWaves(normalId, eliteId, bossId) {
  const waves = [];
  for (let i = 1; i <= 15; i++) {
    if (i === 15) {
      waves.push({ delay: 4, monsters: [{ id: bossId, count: 1, interval: 0 }] });
    } else if (i === 5 || i === 10) {
      waves.push({ delay: 3, monsters: [{ id: eliteId, count: 3, interval: 1.5 }] });
    } else {
      const count = 4 + Math.floor(i * 0.8);
      waves.push({ delay: 2, monsters: [{ id: normalId, count, interval: 1.0 }] });
    }
  }
  return waves;
}

const LEVELS = [
  // ===== 第1关 =====
  {
    id: 1,
    name: '新手村',
    unlocked: true,
    baseHp: 10,
    initGold: 100,
    waves: makeWaves('normal_1', 'elite_1', 'boss_1'),
    grid: [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1]
    ],
    // 路径坐标：col/row（从左上0,0开始）
    path: [
      {col:0,row:1},{col:1,row:1},{col:2,row:1},{col:3,row:1},
      {col:3,row:2},{col:3,row:3},{col:4,row:3},{col:5,row:3},{col:6,row:3},
      {col:6,row:4},{col:6,row:5},{col:7,row:5},{col:8,row:5},{col:9,row:5},
      {col:9,row:6},{col:9,row:7},{col:10,row:7},{col:11,row:7},{col:12,row:7},
      {col:12,row:8},{col:12,row:9},{col:13,row:9},{col:14,row:9},
      {col:14,row:10},{col:14,row:11},{col:15,row:11}
    ],
    spawn: {col:0, row:1},
    goal:  {col:15, row:11},
    goalImage: null, // 终点贴图（可配置，null则用默认文字）
    bgImage: null,   // 关卡背景图（可配置）
    pathImage: null  // 路径贴图（可配置）
  },

  // ===== 第2关 =====
  {
    id: 2,
    name: '森林小道',
    unlocked: false,
    baseHp: 10,
    initGold: 80,
    waves: makeWaves('normal_2', 'elite_2', 'boss_1'),
    grid: [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
      [1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
      [0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
      [0,1,1,1,1,1,0,0,0,0,0,0,1,1,1,0],
      [0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0],
      [0,0,0,0,0,1,1,1,1,0,0,0,1,0,0,0],
      [0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0],
      [0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ],
    path: [
      {col:0,row:2},{col:1,row:2},
      {col:1,row:3},{col:1,row:4},{col:2,row:4},{col:3,row:4},{col:4,row:4},{col:5,row:4},
      {col:5,row:5},{col:5,row:6},{col:6,row:6},{col:7,row:6},{col:8,row:6},
      {col:8,row:7},{col:8,row:8},{col:9,row:8},{col:10,row:8},{col:11,row:8},{col:12,row:8},
      {col:12,row:7},{col:12,row:6},{col:12,row:5},{col:12,row:4},{col:13,row:4},{col:14,row:4},
      {col:14,row:3},{col:14,row:2},{col:14,row:1},{col:15,row:1}
    ],
    spawn: {col:0, row:2},
    goal:  {col:15, row:1},
    goalImage: null,
    bgImage: null,   // 关卡背景图（可配置）
    pathImage: null  // 路径贴图（可配置）
  }
];

export default LEVELS;
