/**
 * monsters.js - 怪物默认配置
 *
 * type: 'normal' | 'elite' | 'boss'
 * hp: 血量
 * speed: 移动速度（格/秒）
 * damage: 到达终点造成的伤害
 * reward: 击杀金币奖励
 * image: 贴图路径（null则自动生成占位图）
 */
const MONSTERS = [
  {
    id: 'normal_1',
    name: '小兵',
    type: 'normal',
    hp: 5,
    speed: 2,
    damage: 1,
    reward: 5,
    color: '#4CAF50',
    image: null,
    animDataUrl: null
  },
  {
    id: 'normal_2',
    name: '快速小兵',
    type: 'normal',
    hp: 3,
    speed: 3.5,
    damage: 1,
    reward: 6,
    color: '#8BC34A',
    image: null,
    animDataUrl: null
  },
  {
    id: 'elite_1',
    name: '精英战士',
    type: 'elite',
    hp: 20,
    speed: 1.5,
    damage: 3,
    reward: 20,
    color: '#FF9800',
    image: null,
    animDataUrl: null
  },
  {
    id: 'elite_2',
    name: '精英法师',
    type: 'elite',
    hp: 15,
    speed: 2,
    damage: 3,
    reward: 22,
    color: '#FF5722',
    image: null,
    animDataUrl: null
  },
  {
    id: 'boss_1',
    name: '魔王',
    type: 'boss',
    hp: 60,
    speed: 1,
    damage: 4,
    reward: 80,
    color: '#9C27B0',
    image: null,
    animDataUrl: null
  }
];

export default MONSTERS;
