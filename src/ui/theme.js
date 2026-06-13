/**
 * theme.js — 塔防风云 设计令牌
 *
 * 所有页面共用同一套色板 / 字阶 / 间距 / 圆角，
 * 不再各自写死颜色和字体。
 */

// ─── 色板 ───────────────────────────────────────────
export const Color = {
  bg:           '#0F1A0F',   // 页面底色（最深）
  surface:      '#1A2F1A',   // 导航栏 / 弹窗背景
  card:         '#243524',   // 卡片 / 列表项
  cardHover:    '#2E442E',   // 卡片高亮

  // 功能色
  accent:       '#4CAF50',   // 主操作 / 选中 / 成功
  gold:         '#FFD54F',   // 标题 / 金币 / 高亮
  danger:       '#F44336',   // 删除 / 危险 / 失败
  warning:      '#FF9800',   // 次要操作 / 提示
  purple:       '#9C27B0',   // 抽卡 / 特殊功能

  // 文字
  textPrimary:  '#E8F5E9',   // 正文
  textSecondary:'#81C784',   // 辅助文字
  textMuted:    '#4A6B4A',   // 弱化 / 禁用

  // 叠加层
  overlay:      'rgba(0,0,0,0.75)',
  overlayLight: 'rgba(0,0,0,0.35)',

  // 地图编辑器
  gridEmpty:    '#2E7D32',
  gridPath:     '#795548',
  gridBlocked:  '#546E7A',
};

// ─── 字体 ───────────────────────────────────────────
const FF = "'Fira Sans', sans-serif";

export const Font = {
  family: FF,
  title:    `700 22px ${FF}`,
  subtitle: `600 16px ${FF}`,
  body:     `400 13px ${FF}`,
  caption:  `400 10px ${FF}`,
};

/** 快捷生成 font 字符串 */
export function font(size, weight = '400') {
  return `${weight} ${size}px ${FF}`;
}

// ─── 间距 ───────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

// ─── 圆角 ───────────────────────────────────────────
export const Radius = {
  sm: 4,
  md: 8,
};
