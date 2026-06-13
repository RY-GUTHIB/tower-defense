/**
 * DrawUtil.js - Canvas绘制工具函数集
 * 负责占位图自动生成（用几何形状填充）
 */

import { Color, Font, Radius } from '../ui/theme.js';

// 跨平台 Canvas 创建
function _createCanvas() {
  if (typeof tt !== 'undefined' && tt.createCanvas) return tt.createCanvas();
  return document.createElement('canvas');
}

/**
 * 根据颜色和类型生成占位贴图并缓存
 * 返回可用于 drawImage 的 Canvas 对象
 */
const _placeholderCache = {};

export function getPlaceholderImage(width, height, color, shape) {
  const key = `${width}_${height}_${color}_${shape}`;
  if (_placeholderCache[key]) return _placeholderCache[key];

  const c = _createCanvas();
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');

  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.35;
  const s = Math.min(width, height) * 0.3;

  ctx.fillStyle = color;

  switch (shape) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'square':
      ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
      break;

    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();
      break;

    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.lineTo(cx - r, cy + r);
      ctx.closePath();
      ctx.fill();
      break;

    case 'star':
      drawStar(ctx, cx, cy, r, r * 0.4, 5);
      break;

    case 'hexagon':
      drawHexagon(ctx, cx, cy, r);
      break;

    default:
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
  }

  // 边框
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  if (shape === 'square') {
    ctx.strokeRect(cx - s, cy - s, s * 2, s * 2);
  }

  _placeholderCache[key] = c;
  return c;
}

function drawStar(ctx, cx, cy, outerR, innerR, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI * 2 * i) / (points * 2) - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawHexagon(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 6;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

// 各类型/稀有度对应的形状映射
export const MONSTER_SHAPE_MAP = {
  'normal': 'circle',
  'elite': 'square',
  'boss': 'diamond'
};

export const TOWER_RARITY_SHAPE_MAP = {
  'common': 'square',
  'rare': 'hexagon',
  'epic': 'star',
  'legendary': 'diamond'
};

export const TILE_SIZE = 48;
export const GRID_COLS = 16;
export const GRID_ROWS = 12;
export const MAP_OFFSET_X = 0;
export const MAP_OFFSET_Y = 60;

export function gridToPixel(col, row) {
  return {
    x: MAP_OFFSET_X + col * TILE_SIZE,
    y: MAP_OFFSET_Y + row * TILE_SIZE
  };
}

export function pixelToGrid(px, py) {
  return {
    col: Math.floor((px - MAP_OFFSET_X) / TILE_SIZE),
    row: Math.floor((py - MAP_OFFSET_Y) / TILE_SIZE)
  };
}

// ═══════════════════════════════════════════════════════════
// 公共 UI 绘制函数（所有页面共享）
// ═══════════════════════════════════════════════════════════

/**
 * 圆角矩形路径（不 fill / stroke，仅构建路径）
 */
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * 统一按钮绘制
 * @returns {Object} 命中区域 { x, y, w, h }
 */
export function drawButton(ctx, x, y, w, h, label, {
  color = Color.accent,
  textColor = Color.textPrimary,
  fontSize = 14,
  fontWeight = '600',
  radius = Radius.md,
} = {}) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();

  const prevAlign = ctx.textAlign;
  const prevBaseline = ctx.textBaseline;
  ctx.fillStyle = textColor;
  ctx.font = `${fontWeight} ${fontSize}px ${Font.family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
  ctx.textAlign = prevAlign;
  ctx.textBaseline = prevBaseline;
}

/**
 * 统一卡片绘制（带阴影的圆角卡片）
 * @returns {Object} 命中区域 { x, y, w, h }
 */
export function drawCard(ctx, x, y, w, h, {
  fill = Color.card,
  radius = Radius.sm,
  shadow = true,
  stroke = null,
} = {}) {
  if (shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
  }

  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();

  if (shadow) ctx.restore();

  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, radius);
    ctx.stroke();
  }
}

/**
 * 统一头部导航栏
 * @param {Object} backBtn - 会被写入 { x, y, w, h } 供触摸检测
 * @returns {number} 头部高度
 */
export function drawHeader(ctx, w, title, backBtn, {
  bg = Color.surface,
  textColor = Color.textPrimary,
  backLabel = '< 返回',
  backColor = Color.warning,
  height = 44,
} = {}) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, height);

  // 标题
  const prevAlign = ctx.textAlign;
  const prevBaseline = ctx.textBaseline;
  ctx.fillStyle = textColor;
  ctx.font = Font.subtitle;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, w / 2, height / 2);
  ctx.textAlign = prevAlign;
  ctx.textBaseline = prevBaseline;

  // 返回按钮
  const bw = ctx.measureText(backLabel).width + 16;
  const bh = 28;
  drawButton(ctx, 8, (height - bh) / 2, bw, bh, backLabel, {
    color: backColor,
    fontSize: 13,
    fontWeight: '600',
  });

  backBtn.x = 8;
  backBtn.y = (height - bh) / 2;
  backBtn.w = bw;
  backBtn.h = bh;
}

/**
 * 统一 Tab 切换器
 * @param tabs      Array<{ label: string, key: string }>
 * @param activeIndex  当前激活的 tab 索引
 * @param tabResults    回写命中区域数组
 */
export function drawTab(ctx, tabs, activeIndex, x, y, tabResults, {
  tabW = 72,
  tabH = 32,
  gap = 8,
  accent = Color.accent,
  inactive = Color.card,
  textColor = Color.textPrimary,
} = {}) {
  // 清空引用数组
  tabResults.length = 0;

  const prevAlign = ctx.textAlign;
  const prevBaseline = ctx.textBaseline;

  for (let i = 0; i < tabs.length; i++) {
    const tx = x + i * (tabW + gap);
    const isActive = i === activeIndex;

    ctx.fillStyle = isActive ? accent : inactive;
    roundRect(ctx, tx, y, tabW, tabH, Radius.sm);
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.font = Font.body;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tabs[i].label, tx + tabW / 2, y + tabH / 2);

    tabResults.push({ x: tx, y, w: tabW, h: tabH, key: tabs[i].key });
  }

  ctx.textAlign = prevAlign;
  ctx.textBaseline = prevBaseline;
}
