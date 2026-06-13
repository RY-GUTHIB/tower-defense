/**
 * spells.js - 功能牌配置
 *
 * 功能牌与防御塔混合抽取，使用后立即生效
 * isSpell: true 标识为功能牌（非防御塔）
 */
const SPELLS = [
  {
    id: 'heal',
    name: '治疗术',
    isSpell: true,
    rarity: 'common',
    color: '#4CAF50',
    value: 3,
    desc: '终点血量+3',
    weight: 20,
    execute(gameState) {
      gameState.healHp(this.value || 3);
    }
  },
  {
    id: 'max_hp_up',
    name: '加固术',
    isSpell: true,
    rarity: 'rare',
    color: '#2196F3',
    value: 5,
    desc: '最大血量+5',
    weight: 12,
    execute(gameState) {
      gameState.increaseMaxHp(this.value || 5);
    }
  },
  {
    id: 'aoe_damage',
    name: '陨石术',
    isSpell: true,
    rarity: 'epic',
    color: '#FF5722',
    value: 8,
    desc: '全图8伤害',
    weight: 6,
    execute(gameState, monsters) {
      const dmg = this.value || 8;
      for (const m of monsters) {
        if (m.alive && !m.reached) {
          m.takeDamage(dmg);
        }
      }
    }
  }
];

export default SPELLS;
