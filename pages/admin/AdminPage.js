/**
 * AdminPage.js - 后台配置页面
 *
 * 功能：
 * 1. 开发者授权（首次输入密码验证）
 * 2. 怪物配置管理
 * 3. 塔配置管理
 * 4. 关卡地图编辑器（Canvas网格绘制）
 */
// 跨平台 RAF 适配（与 GameEngine.js 一致）
const _raf = (typeof tt !== 'undefined' && tt.requestAnimationFrame)
  ? fn => tt.requestAnimationFrame(fn)
  : fn => window.requestAnimationFrame(fn);
const _caf = (typeof tt !== 'undefined' && tt.cancelAnimationFrame)
  ? id => tt.cancelAnimationFrame(id)
  : id => window.cancelAnimationFrame(id);

import { ConfigManager } from '../../src/data/ConfigManager.js';
import { StorageUtil } from '../../src/utils/StorageUtil.js';
import { TILE_SIZE, GRID_COLS, GRID_ROWS, pixelToGrid, drawButton, drawCard } from '../../src/utils/DrawUtil.js';
import { Color, Font, font } from '../../src/ui/theme.js';
import { showToast, showModal, showAudioUploadModal } from '../../src/ui/UIManager.js';

const DEV_PASSWORD = 'admin888';
const GAME_WIDTH = 768;

export class AdminPage {
  constructor(ctx, w, h, onBack) {
    this.ctx = ctx;
    this.w = w;
    this.h = h;
    this.onBack = onBack;

    this.tab = 'audio'; // 'audio' | 'levels' | 'monsters' | 'towers' | 'gacha' | 'sync'
    this.scrollOffset = 0;
    this.editTarget = null;
    this.syncStatus = '';
    this._uploadFolder = 'towers';
    this.uploadResult = '';

    // 地图编辑器状态
    this.editMap = false;
    this.editMapData = null;

    // 滚动状态
    this._scrollDragging = false;
    this._scrollLastY = 0;
    this._scrollStartY = 0;
    this._scrollMoved = false;
    this.editBrush = 0;         // 0=空地 1=路径 2=障碍
  }

  onEnter() {
    // 开发者授权检查
    if (!this._isAuthorized()) {
      this._pendingAuth = true;
      this.render();
      return;
    }
    this.render();
  }

  onLeave() {}

  render() {
    // 授权未通过时只显示授权界面，不让正常内容覆盖
    if (this._pendingAuth) {
      this._showAuthPrompt();
      return;
    }

    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = Color.bg;
    ctx.fillRect(0, 0, w, h);

    // 标题栏
    ctx.fillStyle = Color.surface;
    ctx.fillRect(0, 0, w, 44);
    ctx.fillStyle = Color.textPrimary;
    ctx.font = Font.subtitle;
    ctx.textAlign = 'center';
    ctx.fillText('后台配置', w / 2, 30);

    // 返回按钮
    drawButton(ctx, 8, 14, 56, 28, '< 返回', { color: Color.warning, fontSize: 13, fontWeight: '600' });
    this.backBtn = { x: 8, y: 14, w: 56, h: 28 };

    // Tab 切换
    const tabs = [
      { label: '🎵 音频', key: 'audio' },
      { label: '关卡', key: 'levels' },
      { label: '怪物', key: 'monsters' },
      { label: '塔', key: 'towers' },
      { label: '🃏 抽卡', key: 'gacha' },
      { label: '⚡ 技能', key: 'spells' },
      { label: '☁️ 同步', key: 'sync' }
    ];
    const activeIdx = tabs.findIndex(t => t.key === this.tab);
    const tabW = 54, tabY = 50;
    this.tabButtons = [];
    for (let i = 0; i < tabs.length; i++) {
      const tx = 6 + i * (tabW + 2);
      ctx.fillStyle = i === activeIdx ? Color.accent : Color.card;
      ctx.fillRect(tx, tabY, tabW, 34);
      ctx.fillStyle = Color.textPrimary;
      ctx.font = '10px ' + Font.family;
      ctx.textAlign = 'center';
      ctx.fillText(tabs[i].label, tx + tabW / 2, tabY + 23);
      this.tabButtons.push({ x: tx, y: tabY, w: tabW, h: 34, key: tabs[i].key });
    }

    // 内容区
    const contentY = tabY + 44;
    if (this._previewing) {
      this._renderPreview(ctx, contentY);
    } else if (this.tab === 'monsters') this._renderMonsterList(ctx, contentY);
    else if (this.tab === 'towers') this._renderTowerList(ctx, contentY);
    else if (this.tab === 'levels') this._renderLevelList(ctx, contentY);
    else if (this.tab === 'audio') this._renderAudioTab(ctx, contentY);
    else if (this.tab === 'gacha') this._renderGachaTab(ctx, contentY);
    else if (this.tab === 'spells') this._renderSpellList(ctx, contentY);
    else if (this.tab === 'sync') this._renderSyncTab(ctx, contentY);
  }

  // ========== 图片预览弹窗 ==========
  _renderPreview(ctx, startY) {
    const item = this._previewTarget;
    const w = this.w;
    const h = this.h;

    if (!item || !item._animImage) {
      // 半透明遮罩
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, w, h);
      const boxW = 300, boxH = 160;
      const boxX = (w - boxW) / 2, boxY = (h - boxH) / 2;
      ctx.fillStyle = Color.card;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = Color.danger;
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.fillStyle = Color.textPrimary;
      ctx.font = font(14, '700');
      ctx.textAlign = 'center';
      ctx.fillText('预览: ' + (item ? (item.name || item.id) : '未知'), w / 2, boxY + 24);
      ctx.fillStyle = Color.danger;
      ctx.font = '14px ' + Font.family;
      ctx.textAlign = 'center';
      ctx.fillText('图片加载失败', w / 2, boxY + 60);
      ctx.fillStyle = Color.textSecondary;
      ctx.font = Font.caption;
      ctx.fillText('请重新上传图片，或检查文件格式', w / 2, boxY + 82);
      const closeBtn = { x: boxX + boxW - 36, y: boxY + 4, w: 32, h: 28 };
      drawButton(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, '✕',
        { color: Color.danger, fontSize: 14, fontWeight: '700' });
      this._previewCloseBtn = closeBtn;
      return;
    }

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);

    // 预览框
    const boxW = 300;
    const boxH = 240;
    const boxX = (w - boxW) / 2;
    const boxY = (h - boxH) / 2;

    ctx.fillStyle = Color.card;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = Color.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // 标题
    ctx.fillStyle = Color.textPrimary;
    ctx.font = font(14, '700');
    ctx.textAlign = 'center';
    ctx.fillText(`预览: ${item.name || item.id}`, w / 2, boxY + 24);

    // 图片绘制区域
    const imgAreaX = boxX + 20;
    const imgAreaY = boxY + 40;
    const imgAreaW = boxW - 40;
    const imgAreaH = boxH - 80;

    // 绘制棋盘格背景（表示透明区域）
    const gridSize = 10;
    for (let gy = 0; gy < imgAreaH; gy += gridSize) {
      for (let gx = 0; gx < imgAreaW; gx += gridSize) {
        const isLight = ((Math.floor(gx / gridSize) + Math.floor(gy / gridSize)) % 2 === 0);
        ctx.fillStyle = isLight ? '#E0E0E0' : '#BDBDBD';
        ctx.fillRect(imgAreaX + gx, imgAreaY + gy, gridSize, gridSize);
      }
    }

    const img = item._animImage;
    const anim = item.anim;

    if (anim && anim.frameCount > 1) {
      // 序列帧预览 - 播放动画
      this._previewAnimTimer += 1 / 60;
      const frameInterval = 1 / (anim.frameRate || 8);
      if (this._previewAnimTimer >= frameInterval) {
        this._previewAnimTimer -= frameInterval;
        this._previewAnimFrame = (this._previewAnimFrame + 1) % anim.frameCount;
      }

      const fw = anim.frameWidth || (img.width / anim.frameCount);
      const fh = anim.frameHeight || img.height;
      const fi = this._previewAnimFrame;

      // 缩放到预览区域
      const scale = Math.min(imgAreaW / fw, imgAreaH / fh);
      const drawW = fw * scale;
      const drawH = fh * scale;
      const drawX = imgAreaX + (imgAreaW - drawW) / 2;
      const drawY = imgAreaY + (imgAreaH - drawH) / 2;

      ctx.drawImage(img, fi * fw, 0, fw, fh, drawX, drawY, drawW, drawH);

      // 帧信息
      ctx.fillStyle = Color.textSecondary;
      ctx.font = Font.caption;
      ctx.textAlign = 'center';
      ctx.fillText(`帧 ${fi + 1}/${anim.frameCount} | ${fw}×${fh} | ${anim.frameRate}fps`, w / 2, boxY + boxH - 36);
    } else {
      // 单图预览
      const scale = Math.min(imgAreaW / img.width, imgAreaH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = imgAreaX + (imgAreaW - drawW) / 2;
      const drawY = imgAreaY + (imgAreaH - drawH) / 2;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      ctx.fillStyle = Color.textSecondary;
      ctx.font = Font.caption;
      ctx.textAlign = 'center';
      ctx.fillText(`${img.width}×${img.height} | 单图模式`, w / 2, boxY + boxH - 36);
    }

    // 关闭按钮
    const closeBtn = { x: boxX + boxW - 36, y: boxY + 4, w: 32, h: 28 };
    drawButton(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, '✕',
      { color: Color.danger, fontSize: 14, fontWeight: '700' });
    this._previewCloseBtn = closeBtn;

    // 删除按钮
    const delBtn = { x: boxX + 8, y: boxY + 4, w: 32, h: 28 };
    drawButton(ctx, delBtn.x, delBtn.y, delBtn.w, delBtn.h, '🗑',
      { color: '#C62828', fontSize: 12, fontWeight: '700' });
    this._previewDelBtn = delBtn;

    // 触发持续刷新以播放序列帧动画
    if (anim && anim.frameCount > 1) {
      this._previewRafId = _raf(() => { if (this._previewing) this.render(); });
    }
  }

  // ========== 技能卡列表 ==========
  _renderSpellList(ctx, startY) {
    const spells = ConfigManager.getSpells();
    let y = startY + this.scrollOffset;

    this.spellItems = [];
    this.spellEditBtns = [];

    for (let i = 0; i < spells.length; i++) {
      const s = spells[i];
      const pad = 12;
      const cardH = 64;
      drawCard(ctx, pad, y, this.w - pad * 2, cardH);

      // 颜色标识 + 名称
      ctx.fillStyle = s.color;
      ctx.fillRect(pad + 4, y + 4, 10, 10);
      ctx.fillStyle = Color.textPrimary;
      ctx.font = font(13, '600');
      ctx.textAlign = 'left';
      ctx.fillText(`${s.name} [${s.rarity}]`, pad + 22, y + 18);

      // 可编辑字段
      const fields = [
        { label: '数值', value: s.value, field: 'value' },
        { label: '权重', value: s.weight, field: 'weight' }
      ];
      const textY2 = y + 40;
      for (let fi = 0; fi < fields.length; fi++) {
        const f = fields[fi];
        const fx = pad + 20 + fi * 100;
        ctx.fillStyle = Color.textSecondary;
        ctx.font = Font.caption;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        const text = `${f.label}: ${f.value}`;
        ctx.fillText(text, fx, textY2);
        const textW = ctx.measureText(text).width;
        const btn = { x: fx + textW + 4, y: textY2 - 10, w: 18, h: 18 };
        drawButton(ctx, btn.x, btn.y, btn.w, btn.h, '✎',
          { color: '#263545', fontSize: 9, fontWeight: '600' });
        this.spellEditBtns.push({ ...btn, spellIdx: i, field: f.field, value: f.value });
      }

      this.spellItems.push({ y, h: cardH, spell: s });
      y += cardH + 4;
    }

    y += 4;
    ctx.fillStyle = Color.textMuted;
    ctx.font = Font.caption;
    ctx.fillText('技能效果由代码定义，此处可调整数值参数。修改后立即生效。', 16, y + 12);
  }

  // ========== 音频 Tab ==========
  _renderAudioTab(ctx, startY) {
    let y = startY;
    const pad = 12;

    // BGM 部分
    ctx.fillStyle = Color.textPrimary;
    ctx.font = font(13, '700');
    ctx.textAlign = 'left';
    ctx.fillText('背景音乐', pad + 4, y + 18);
    y += 24;

    const bgmName = StorageUtil.get('__upload_bgm_name') || '默认(程序合成)';
    ctx.fillStyle = Color.textSecondary;
    ctx.font = Font.caption;
    ctx.fillText('当前: ' + bgmName, pad + 4, y + 12);
    y += 18;

    drawButton(ctx, pad, y, this.w - pad * 2, 28, '📁 上传背景音乐 (mp3/wav)',
      { color: '#37474F', fontSize: 11, fontWeight: '600' });
    this.bgmUploadBtn = { x: pad, y, w: this.w - pad * 2, h: 28 };
    y += 36;

    // SFX 音效
    ctx.fillStyle = Color.textPrimary;
    ctx.font = font(13, '700');
    ctx.fillText('攻击音效', pad + 4, y + 18);
    y += 26;

    const sfxTypes = [
      { key: 'arrow', name: '弓箭' },
      { key: 'cannonball', name: '炮击' },
      { key: 'magic', name: '魔法' },
      { key: 'ice', name: '冰霜' },
      { key: 'bullet', name: '狙击' },
      { key: 'fire', name: '火焰' }
    ];
    this.sfxButtons = [];
    for (const st of sfxTypes) {
      const sfxName = StorageUtil.get('__upload_sfx_' + st.key) || '默认';
      ctx.fillStyle = Color.textSecondary;
      ctx.font = Font.caption;
      ctx.fillText(st.name + '音效: ' + sfxName, pad + 4, y + 12);
      y += 14;

      drawButton(ctx, pad, y, this.w - pad * 2, 24, '📁 上传 ' + st.name + '音效',
        { color: '#37474F', fontSize: 10, fontWeight: '600' });
      this.sfxButtons.push({ key: st.key, x: pad, y, w: this.w - pad * 2, h: 24 });
      y += 30;
    }

    // 击杀音效
    y += 4;
    ctx.fillStyle = Color.textPrimary;
    ctx.font = font(13, '700');
    ctx.fillText('其他', pad + 4, y + 18);
    y += 26;

    drawButton(ctx, pad, y, this.w - pad * 2, 24, '📁 上传 击杀音效',
      { color: '#37474F', fontSize: 10, fontWeight: '600' });
    this.killSfxBtn = { key: 'kill', x: pad, y, w: this.w - pad * 2, h: 24 };
  }

  // ========== 抽卡 Tab ==========
  _renderGachaTab(ctx, startY) {
    let y = startY;
    const pad = 12;
    const gacha = ConfigManager.getGachaConfig();
    const weights = ConfigManager.getRarityWeights();

    ctx.fillStyle = Color.textPrimary;
    ctx.font = font(13, '700');
    ctx.textAlign = 'left';
    ctx.fillText('抽卡配置', pad + 4, y + 18);
    y += 28;

    const gachaFields = [
      { field: 'baseCost', label: '基础费用', value: gacha.baseCost },
      { field: 'costIncrease', label: '费用递增', value: gacha.costIncrease },
      { field: 'maxCost', label: '费用上限', value: gacha.maxCost },
      { field: 'pityCount', label: '保底次数', value: gacha.pityCount },
      { field: 'pityMinRarity', label: '保底最低稀有度', value: gacha.pityMinRarity }
    ];
    this.gachaEditBtns = [];
    for (const gf of gachaFields) {
      ctx.fillStyle = Color.textSecondary;
      ctx.font = Font.body;
      ctx.fillText(gf.label + ': ' + gf.value, pad + 4, y + 16);
      const btn = { x: this.w / 2, y, w: this.w / 2 - pad - 8, h: 24 };
      drawButton(ctx, btn.x, btn.y, btn.w, btn.h, '编辑', { color: '#263545', fontSize: 10, fontWeight: '600' });
      this.gachaEditBtns.push({ ...btn, action: 'editGacha', field: gf.field, value: gf.value });
      y += 30;
    }

    y += 8;
    ctx.fillStyle = Color.textPrimary;
    ctx.font = font(13, '700');
    ctx.fillText('稀有度权重', pad + 4, y + 18);
    y += 28;

    const rarityLabels = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' };
    const weightFields = ['common', 'rare', 'epic', 'legendary'];
    this.weightEditBtns = [];
    for (const wf of weightFields) {
      ctx.fillStyle = Color.textSecondary;
      ctx.font = Font.body;
      ctx.fillText(`${rarityLabels[wf]}: ${weights[wf]}`, pad + 4, y + 16);
      const btn = { x: this.w / 2, y, w: this.w / 2 - pad - 8, h: 24 };
      drawButton(ctx, btn.x, btn.y, btn.w, btn.h, '编辑', { color: '#263545', fontSize: 10, fontWeight: '600' });
      this.weightEditBtns.push({ ...btn, action: 'editWeight', field: wf, value: weights[wf] });
      y += 30;
    }

    y += 12;
    drawButton(ctx, pad, y, this.w - pad * 2, 32, '🔄 恢复全部默认配置',
      { color: '#C62828', fontSize: 12, fontWeight: '700' });
    this.resetAllBtn = { x: pad, y, w: this.w - pad * 2, h: 32 };
  }
  _renderMonsterList(ctx, startY) {
    const monsters = ConfigManager.getMonsters();
    let y = startY + this.scrollOffset;

    this.monsterItems = [];
    this.monsterEditBtns = [];

    for (let i = 0; i < monsters.length; i++) {
      const m = monsters[i];
      const pad = 12;
      const cardH = 72;
      drawCard(ctx, pad, y, this.w - pad * 2, cardH);

      // 颜色标识 + 名称
      ctx.fillStyle = m.color;
      ctx.fillRect(pad + 4, y + 4, 10, 10);
      ctx.fillStyle = Color.textPrimary;
      ctx.font = font(13, '600');
      ctx.textAlign = 'left';
      ctx.fillText(`${m.name} [${m.type}]`, pad + 22, y + 18);

      // 数值行（可编辑）
      const fields = [
        { label: 'HP', value: m.hp, field: 'hp' },
        { label: '速度', value: m.speed, field: 'speed' },
        { label: '伤害', value: m.damage, field: 'damage' },
        { label: '金币', value: m.reward, field: 'reward' }
      ];
      const fw = (this.w - 100) / 4;
      const textY = y + 38;
      for (let fi = 0; fi < fields.length; fi++) {
        const f = fields[fi];
        const fx = pad + 20 + fi * fw;
        ctx.fillStyle = Color.textSecondary;
        ctx.font = Font.caption;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        const text = `${f.label}: ${f.value}`;
        ctx.fillText(text, fx, textY);
        const textW = ctx.measureText(text).width;
        const btn = { x: fx + textW + 4, y: textY - 10, w: 18, h: 18 };
        drawButton(ctx, btn.x, btn.y, btn.w, btn.h, '✎',
          { color: '#263545', fontSize: 9, fontWeight: '600' });
        this.monsterEditBtns.push({ ...btn, monsterIdx: i, field: f.field, value: f.value });
      }

      // 动画图按钮 + 预览按钮
      const animBtn = { x: this.w - 128, y: y + 6, w: 56, h: 24 };
      drawButton(ctx, animBtn.x, animBtn.y, animBtn.w, animBtn.h,
        m.animDataUrl ? '✓ 动图' : '上传动图',
        { color: m.animDataUrl ? Color.accent : Color.purple, fontSize: 10, fontWeight: '600' });

      const previewBtn = { x: this.w - 68, y: y + 6, w: 56, h: 24 };
      if (m._animImage) {
        drawButton(ctx, previewBtn.x, previewBtn.y, previewBtn.w, previewBtn.h,
          '👁 预览', { color: '#1565C0', fontSize: 10, fontWeight: '600' });
      }

      this.monsterItems.push({ y, h: cardH, monster: m, animBtn, previewBtn: m._animImage ? previewBtn : null });
      y += cardH + 4;
    }

    drawButton(ctx, 12, y + 4, 80, 32, '+ 新增怪物', { fontSize: 13, fontWeight: '600' });
    this.monsterAddBtn = { x: 12, y: y + 4, w: 80, h: 32 };
  }

  // ========== 塔列表 ==========
  _renderTowerList(ctx, startY) {
    const towers = ConfigManager.getTowers();
    let y = startY + this.scrollOffset;

    this.towerItems = [];
    this.towerEditBtns = [];
    this.towerLevelEditBtns = [];

    for (let i = 0; i < towers.length; i++) {
      const t = towers[i];
      const pad = 12;
      const hasLv = t.levelStats && t.levelStats.length > 0;
      const cardH = hasLv ? 100 : 45;
      drawCard(ctx, pad, y, this.w - pad * 2, cardH);

      // 颜色标识 + 名称/稀有度
      ctx.fillStyle = t.color;
      ctx.fillRect(pad + 4, y + 4, 10, 10);
      ctx.fillStyle = Color.textPrimary;
      ctx.font = font(13, '600');
      ctx.textAlign = 'left';
      ctx.fillText(`${t.name} [${t.rarity}]`, pad + 22, y + 18);

      // 等级属性
      if (hasLv) {
        for (let lv = 0; lv < t.levelStats.length; lv++) {
          const ls = t.levelStats[lv];
          const lvLabel = lv === 4 ? 'Lv.5 ★' : `Lv.${lv + 1}`;
          const ly = y + 26 + lv * 16;
          ctx.fillStyle = lv === 4 ? '#E040FB' : Color.textMuted;
          ctx.font = Font.caption;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(`${lvLabel}: ATK:${ls.atk} R:${ls.range} CD:${ls.cd}`, pad + 18, ly + 10);

          // 每级3个编辑按钮
          const lvlFields = [
            { label: 'atk', value: ls.atk, key: 'atk' },
            { label: 'range', value: ls.range, key: 'range' },
            { label: 'cd', value: ls.cd, key: 'cd' }
          ];
          for (let lf = 0; lf < lvlFields.length; lf++) {
            const lvlBtn = { x: pad + 140 + lf * 48, y: ly, w: 40, h: 16 };
            drawButton(ctx, lvlBtn.x, lvlBtn.y, lvlBtn.w, lvlBtn.h, '✎',
              { color: '#263545', fontSize: 8, fontWeight: '600' });
            this.towerLevelEditBtns.push({ ...lvlBtn, towerIdx: i, levelIdx: lv, field: lvlFields[lf].key, value: lvlFields[lf].value });
          }
        }
      }

      // 动画图按钮 + 预览按钮
      const animBtn = { x: this.w - 128, y: y + 6, w: 56, h: 24 };
      drawButton(ctx, animBtn.x, animBtn.y, animBtn.w, animBtn.h,
        t.animDataUrl ? '✓ 动图' : '上传动图',
        { color: t.animDataUrl ? Color.accent : Color.purple, fontSize: 10, fontWeight: '600' });

      const previewBtn = { x: this.w - 68, y: y + 6, w: 56, h: 24 };
      if (t._animImage) {
        drawButton(ctx, previewBtn.x, previewBtn.y, previewBtn.w, previewBtn.h,
          '👁 预览', { color: '#1565C0', fontSize: 10, fontWeight: '600' });
      }

      this.towerItems.push({ y, h: cardH, tower: t, animBtn, previewBtn: t._animImage ? previewBtn : null });
      y += cardH + 4;
    }

    drawButton(ctx, 12, y + 4, 80, 32, '+ 新增塔', { fontSize: 13, fontWeight: '600' });
    this.towerAddBtn = { x: 12, y: y + 4, w: 80, h: 32 };
  }

  // ========== 关卡列表 + 地图编辑器 ==========
  _renderLevelList(ctx, startY) {
    if (this.editMap) {
      this._renderMapEditor(ctx, startY);
      return;
    }

    const levels = ConfigManager.getLevels();
    let y = startY + this.scrollOffset;

    for (const lv of levels) {
      const cardH = 94;
      drawCard(ctx, 12, y, this.w - 24, cardH);

      ctx.fillStyle = Color.textPrimary;
      ctx.font = font(14, '600');
      ctx.textAlign = 'left';
      ctx.fillText(`第${lv.id}关: ${lv.name}`, 24, y + 22);

      ctx.font = Font.caption;
      ctx.fillStyle = Color.textSecondary;
      ctx.fillText(`波次:${lv.waves.length} | 血量:${lv.baseHp} | 初始金币:${lv.initGold}`, 24, y + 40);

      // 素材状态
      const status = [];
      if (lv.bgImage) status.push('背景');
      if (lv.pathImage) status.push('路径');
      if (lv.goalImage) status.push('终点');
      ctx.fillStyle = status.length > 0 ? Color.accent : Color.textMuted;
      ctx.fillText(status.length > 0 ? '素材: ' + status.join(',') : '素材: 未设', 24, y + 56);

      // 4个按钮 2x2
      const btnW = 64, btnH = 24, btnX1 = this.w - 140, btnX2 = this.w - 72;
      // Row1: 编辑地图 | 终点图
      drawButton(ctx, btnX1, y + 6, btnW, btnH, '编辑地图',
        { color: Color.accent, fontSize: 10, fontWeight: '600' });
      drawButton(ctx, btnX2, y + 6, btnW, btnH, '🏁 终点图',
        { color: lv.goalImage ? Color.accent : Color.purple, fontSize: 9, fontWeight: '600' });

      // Row2: 背景图 | 路径图
      drawButton(ctx, btnX1, y + 34, btnW, btnH, '🖼 背景图',
        { color: lv.bgImage ? Color.accent : Color.purple, fontSize: 9, fontWeight: '600' });
      drawButton(ctx, btnX2, y + 34, btnW, btnH, '🛤 路径图',
        { color: lv.pathImage ? Color.accent : Color.purple, fontSize: 9, fontWeight: '600' });

      y += cardH + 6;
    }

    // 开始页背景
    const hasBg = !!(ConfigManager.homeBgUrl || StorageUtil.get('__home_bg_dataUrl'));
    const bgLabel = ConfigManager.homeBgUrl
      ? '开始页背景: ' + ConfigManager.homeBgUrl.split('/').pop()
      : (hasBg ? '开始页背景: 已设置（旧）' : '开始页背景: 未设置');
    drawCard(ctx, 12, y, this.w - 24, 44);
    ctx.fillStyle = Color.textPrimary;
    ctx.font = Font.body;
    ctx.textAlign = 'left';
    ctx.fillText(bgLabel, 24, y + 28);

    drawButton(ctx, this.w - 76, y + 8, 56, 28,
      hasBg ? '✓ 更换' : '上传背景',
      { color: hasBg ? Color.accent : Color.purple, fontSize: 10, fontWeight: '600' });
    this.homeBgBtn = { x: this.w - 76, y: y + 8, w: 56, h: 28 };

    y += 48;

    // 新增关卡
    drawButton(ctx, 12, y + 4, 80, 32, '+ 新增关卡', { fontSize: 13, fontWeight: '600' });

    const scrollY = this.scrollOffset || 0;
    this.levelItems = levels.map((lv, i) => ({
      y: startY + i * 100 + scrollY, h: 94, level: lv,
      editBtn:    { x: this.w - 140, y: startY + i * 100 + 6 + scrollY,  w: 64, h: 24 },
      goalImgBtn: { x: this.w - 72,  y: startY + i * 100 + 6 + scrollY,  w: 64, h: 24 },
      bgImgBtn:   { x: this.w - 140, y: startY + i * 100 + 34 + scrollY, w: 64, h: 24 },
      pathImgBtn: { x: this.w - 72,  y: startY + i * 100 + 34 + scrollY, w: 64, h: 24 }
    }));
    this.levelAddBtn = { x: 12, y: y + 4, w: 80, h: 32 };
  }

  /**
   * 上传终点贴图
   */
  /**
   * 上传图片到服务器 assets/ 文件夹
   * @param {File} file - 浏览器 File 对象
   * @param {string} folder - 目标子目录 ('monsters'|'towers'|'levels'|'general')
   * @returns {Promise<string>} 服务器图片路径，如 '/assets/monsters/abc123.png'
   */
  _uploadToServer(file, folder) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('password', 'admin888');
      formData.append('image', file);
      formData.append('folder', folder);
      fetch('/api/upload', { method: 'POST', body: formData })
        .then(r => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(data => {
          if (data.ok) resolve(data.url);
          else reject(new Error(data.error || '上传失败'));
        })
        .catch(e => reject(e));
    });
  }

  /**
   * 自动将当前配置同步到服务器 config.json
   */
  _autoSyncConfig() {
    const config = ConfigManager.exportConfig();
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin888', config })
    })
    .then(r => r.json())
    .then(data => {
      if (data.ok) showToast('配置已同步', 1500);
      else showToast('同步失败: ' + (data.error || '未知错误'), 2500);
    })
    .catch(e => showToast('同步失败: ' + e.message, 2500));
  }

  _uploadGoalImage(levelData, levelIdx) {
    // 抖音小游戏环境
    if (typeof tt !== 'undefined' && tt.chooseImage) {
      tt.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        success: (res) => {
          const path = res.tempFilePaths[0];
          // 创建图片对象
          const img = tt.createImage();
          img.onload = () => {
            levelData.goalImage = path;
            levelData._goalImage = img;
            ConfigManager.saveLevels(ConfigManager.getLevels());
            this.render();
          };
          img.onerror = () => { showToast('关卡目标图加载失败', 1500); };
          img.src = path;
        }
      });
      return;
    }

    // 浏览器环境：上传到服务器
    showToast('上传中...', 60000);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) { showToast('', 0); return; }
      this._uploadToServer(file, 'levels').then(url => {
        const img = new Image();
        img.onload = () => {
          levelData.goalImage = url;
          levelData._goalImage = img;
          ConfigManager.saveLevels(ConfigManager.getLevels());
          showToast('终点图上传成功', 1500);
          this._autoSyncConfig();
          this.render();
        };
        img.onerror = () => { showToast('关卡目标图加载失败', 1500); };
        img.src = url;
      }).catch(e => {
        showToast('上传失败: ' + e.message, 2000);
      });
    };
    input.click();
  }

  /**
   * 上传关卡背景图
   */
  _uploadLevelBg(levelData) {
    if (typeof tt !== 'undefined' && tt.chooseImage) {
      tt.chooseImage({
        count: 1, sizeType: ['compressed'],
        success: (res) => {
          const path = res.tempFilePaths[0];
          const img = tt.createImage();
          img.onload = () => {
            levelData.bgImage = path;
            levelData._bgImage = img;
            ConfigManager.saveLevels(ConfigManager.getLevels());
            this.render();
          };
          img.onerror = () => { showToast('关卡背景图加载失败', 1500); };
          img.src = path;
        }
      });
      return;
    }
    showToast('上传中...', 60000);
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0]; if (!file) { showToast('', 0); return; }
      this._uploadToServer(file, 'levels').then(url => {
        const img = new Image();
        img.onload = () => {
          levelData.bgImage = url;
          levelData._bgImage = img;
          ConfigManager.saveLevels(ConfigManager.getLevels());
          showToast('背景图上传成功', 1500);
          this._autoSyncConfig();
          this.render();
        };
        img.onerror = () => { showToast('关卡背景图加载失败', 1500); };
        img.src = url;
      }).catch(e => { showToast('上传失败: ' + e.message, 2000); });
    };
    input.click();
  }

  /**
   * 上传关卡路径图
   */
  _uploadLevelPath(levelData) {
    if (typeof tt !== 'undefined' && tt.chooseImage) {
      tt.chooseImage({
        count: 1, sizeType: ['compressed'],
        success: (res) => {
          const path = res.tempFilePaths[0];
          const img = tt.createImage();
          img.onload = () => {
            levelData.pathImage = path;
            levelData._pathImage = img;
            ConfigManager.saveLevels(ConfigManager.getLevels());
            this.render();
          };
          img.onerror = () => { showToast('关卡路径图加载失败', 1500); };
          img.src = path;
        }
      });
      return;
    }
    showToast('上传中...', 60000);
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0]; if (!file) { showToast('', 0); return; }
      this._uploadToServer(file, 'levels').then(url => {
        const img = new Image();
        img.onload = () => {
          levelData.pathImage = url;
          levelData._pathImage = img;
          ConfigManager.saveLevels(ConfigManager.getLevels());
          showToast('路径图上传成功', 1500);
          this._autoSyncConfig();
          this.render();
        };
        img.onerror = () => { showToast('关卡路径图加载失败', 1500); };
        img.src = url;
      }).catch(e => { showToast('上传失败: ' + e.message, 2000); });
    };
    input.click();
  }

  /**
   * 上传动画图（塔或怪物）- 支持 Sprite Sheet
   *
   * 流程：先选图 → 选图后弹配置框 → 确认保存
   * 这样 input.click() / chooseImage 在用户手势同步调用栈中执行，不会被浏览器拦截
   */
  _uploadAnimImage(itemData, type) {
    // 选图完成后：智能推测帧参数并弹出配置对话框
    const finishWithConfig = (imageData) => {
      const img = imageData.img;
      const iw = img.width || img.naturalWidth || 1;
      const ih = img.height || img.naturalHeight || 1;

      // Step1: 智能推测单行帧参数
      let hintFW = ih, hintFH = ih, hintFC = 1, hintFR = 8;
      if (iw > ih && iw % ih < 4 && iw / ih >= 2) {
        hintFW = ih;
        hintFH = ih;
        hintFC = Math.round(iw / ih);
      }

      // Step2: 检测是否为4方向 Sprite Sheet（4行）
      const hintRows = Math.round(ih / hintFH);
      const isMultiRow = hintFC > 1 && hintRows >= 4 && hintRows <= 6;

      let modalTitle, modalBody, modalPrefill;
      if (isMultiRow) {
        // 4方向模式：弹窗展示方向布局并让用户确认
        modalTitle = '4方向动画配置';
        modalBody =
          '图片尺寸: ' + iw + '×' + ih + ' px\n' +
          '检测到 ' + hintRows + ' 行 Sprite Sheet（4方向动画）\n' +
          '每帧 ' + hintFW + '×' + hintFH + ' px，每行 ' + hintFC + ' 帧\n\n' +
          '请确认每行对应的方向:\n' +
          '(填写格式: 下行,左行,上行,右行 对应的行号)\n' +
          '例如 "0,1,2,3" 表示第0行=下,第1行=左,第2行=上,第3行=右';
        modalPrefill = '0,1,2,3,' + hintFW + ',' + hintFH + ',' + hintFC + ',' + hintFR;
      } else if (hintFC > 1) {
        // 单行多帧模式（原有逻辑）
        modalTitle = '上传动画图配置';
        modalBody =
          '图片尺寸: ' + iw + '×' + ih + ' px\n' +
          '检测到约 ' + hintFC + ' 帧 Sprite Sheet，已预填参数\n可直接确认或手动修改';
        modalPrefill = hintFW + ',' + hintFH + ',' + hintFC + ',' + hintFR;
      } else {
        // 单图模式
        modalTitle = '上传动画图配置';
        modalBody =
          '图片尺寸: ' + iw + '×' + ih + ' px\n' +
          '未检测到多帧，按单图处理\n如需序列帧请手动填写: ' + hintFW + ',' + hintFH + ',帧数,帧率';
        modalPrefill = '0,0,1,0';
      }

      showModal(modalTitle, modalBody, modalPrefill).then(configRes => {
        if (!configRes.confirm) return;

        let anim = null;
        const content = (configRes.content || '').trim();
        if (!content || content === '0,0,1,0') {
          showToast('未填写帧参数，按单图处理', 2000);
        } else {
          const parts = content.split(',').map(Number);
          if (isMultiRow) {
            // 4方向模式: "downRow,leftRow,upRow,rightRow, fw, fh, fc, fr"
            if (parts.length >= 8 && parts.every(n => !isNaN(n) && n >= 0)) {
              const [dRow, lRow, uRow, rRow, fw, fh, fc, fr] = parts;
              if (fw > 0 && fh > 0 && fc > 1 && fr > 0) {
                anim = {
                  frameWidth: fw,
                  frameHeight: fh,
                  frameRate: fr || 8,
                  directions: {
                    down:  { row: dRow, frameCount: fc },
                    left:  { row: lRow, frameCount: fc },
                    up:    { row: uRow, frameCount: fc },
                    right: { row: rRow, frameCount: fc }
                  }
                };
              }
            } else {
              showToast('格式错误。4方向: 下行,左行,上行,右行, 帧宽,帧高,帧数,帧率', 2500);
              return;
            }
          } else {
            // 单行模式: "fw, fh, fc, fr"
            if (parts.length >= 4 && parts.every(n => !isNaN(n) && n >= 0)) {
              const [fw, fh, fc, fr] = parts;
              if (fw > 0 && fh > 0 && fc > 1) {
                anim = { frameWidth: fw, frameHeight: fh, frameCount: fc, frameRate: fr || 8 };
              }
            } else {
              showToast('格式错误。请用: 帧宽,帧高,帧数,帧率', 2000);
              return;
            }
          }
        }

        itemData.animDataUrl = imageData.url;
        itemData._animImage = img;
        itemData.image = imageData.url;
        if (anim) {
          itemData.anim = anim;
        } else {
          delete itemData.anim;
        }
        if (type === 'tower') ConfigManager.saveTowers(ConfigManager.getTowers());
        else ConfigManager.saveMonsters(ConfigManager.getMonsters());
        showToast('动画图已保存', 1500);
        this._autoSyncConfig();
        this.render();
      });
    };

    // 抖音小游戏环境
    if (typeof tt !== 'undefined' && tt.chooseImage) {
      tt.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        success: (res) => {
          const path = res.tempFilePaths[0];
          const img = tt.createImage();
          img.onload = () => {
            finishWithConfig({ url: path, img: img });
          };
          img.onerror = () => {
            showToast('图片加载失败，请检查文件格式', 1500);
          };
          img.src = path;
        }
      });
      return;
    }

    showToast('上传中...', 60000);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) { showToast('', 0); return; }
      const folder = type === 'tower' ? 'towers' : 'monsters';
      this._uploadToServer(file, folder).then(url => {
        const img = new Image();
        img.onload = () => {
          finishWithConfig({ url: url, img: img });
        };
        img.onerror = () => {
          showToast('图片加载失败，请检查文件格式', 1500);
        };
        img.src = url;
      }).catch(e => {
        showToast('上传失败: ' + e.message, 2000);
      });
    };
    input.click();
  }

  /**
   * 预览动画图
   */
  _previewAnimImage(itemData) {
    this._previewTarget = itemData;
    this._previewing = true;
    this._previewAnimFrame = 0;
    this._previewAnimTimer = 0;
    this.render();
  }

  /**
   * 关闭预览
   */
  _closePreview() {
    if (this._previewRafId != null) {
      _caf(this._previewRafId);
      this._previewRafId = null;
    }
    this._previewing = false;
    this._previewTarget = null;
    this.render();
  }

  /**
   * 上传开始页面背景图
   */
  _uploadHomeBg() {
    // 抖音小游戏环境
    if (typeof tt !== 'undefined' && tt.chooseImage) {
      tt.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        success: (res) => {
          const path = res.tempFilePaths[0];
          ConfigManager.saveHomeBgUrl(path);
          StorageUtil.set('__home_bg_dataUrl', path); // 兼容旧逻辑
          this._autoSyncConfig();
          this.render();
        }
      });
      return;
    }

    // 浏览器环境：上传到服务器
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      showToast('上传中...', 60000);
      const file = e.target.files[0];
      if (!file) { showToast('', 0); return; }
      this._uploadToServer(file, 'general').then(url => {
        ConfigManager.saveHomeBgUrl(url);
        StorageUtil.set('__home_bg_dataUrl', url); // 兼容旧逻辑
        showToast('主页背景图已上传', 1500);
        this._autoSyncConfig();
        this.render();
      }).catch(e => {
        showToast('上传失败: ' + e.message, 2000);
      });
    };
    input.click();
  }

  // ========== 地图编辑器 ==========
  _renderMapEditor(ctx, startY) {
    if (!this.editMapData) {
      const grid = [];
      for (let r = 0; r < GRID_ROWS; r++) {
        grid.push(new Array(GRID_COLS).fill(0));
      }
      this.editMapData = { grid, path: [], spawn: { col: 0, row: 0 }, goal: { col: 15, row: 11 } };
    }

    const md = this.editMapData;
    const mapX = 0;
    const mapY = 94;

    // 地图网格
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const x = mapX + c * TILE_SIZE;
        const y = mapY + r * TILE_SIZE;
        const cell = md.grid[r][c];

        ctx.fillStyle = cell === 0 ? Color.gridEmpty : cell === 1 ? Color.gridPath : Color.gridBlocked;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }

    // 工具栏
    const toolY = 44;
    const tools = [
      { label: '空地(0)', brush: 0 },
      { label: '路径(1)', brush: 1 },
      { label: '障碍(2)', brush: 2 }
    ];
    const toolColors = [Color.gridEmpty, Color.gridPath, Color.gridBlocked];

    for (let i = 0; i < tools.length; i++) {
      const tx = 10 + i * 80;
      const isSel = this.editBrush === tools[i].brush;
      ctx.fillStyle = toolColors[i];
      ctx.fillRect(tx, toolY, 74, 30);
      if (isSel) {
        ctx.strokeStyle = Color.gold;
        ctx.lineWidth = 2;
        ctx.strokeRect(tx, toolY, 74, 30);
        ctx.lineWidth = 1;
      }
      ctx.fillStyle = Color.textPrimary;
      ctx.font = font(11, '600');
      ctx.textAlign = 'center';
      ctx.fillText(tools[i].label, tx + 37, toolY + 20);
      this[`tool${tools[i].brush}Btn`] = { x: tx, y: toolY, w: 74, h: 30 };
    }

    // 取消 / 导出
    drawButton(ctx, this.w - 140, toolY, 56, 30, '取消', { color: Color.danger, fontSize: 11, fontWeight: '600' });
    drawButton(ctx, this.w - 66, toolY, 56, 30, '导出', { color: Color.accent, fontSize: 11, fontWeight: '600' });

    this.cancelEditBtn = { x: this.w - 140, y: toolY, w: 56, h: 30 };
    this.exportBtn = { x: this.w - 66, y: toolY, w: 56, h: 30 };

    ctx.fillStyle = Color.warning;
    ctx.font = font(11, '600');
    ctx.textAlign = 'left';
    ctx.fillText('提示: 点选画布区域进行绘制，导出时自动生成路径坐标', 10, mapY - 8);
  }

  // ========== 触摸事件 ==========
  onTouchStart(e) {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (t) {
      this._scrollDragging = true;
      this._scrollLastY = t.clientY;
      this._scrollStartY = t.clientY;
    }
  }
  onTouchMove(e) {
    if (!this._scrollDragging) return;
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!t) return;
    const dy = t.clientY - this._scrollLastY;
    this._scrollLastY = t.clientY;
    if (this.tab === 'levels' && !this.editMap) {
      this.scrollOffset += dy;
      if (this.scrollOffset > 0) this.scrollOffset = 0;
      const totalMoved = Math.abs(t.clientY - this._scrollStartY);
      if (totalMoved > 8) this._scrollMoved = true;
      this.render();
    }
  }

  onTouchEnd(e) {
    const t = e.changedTouches[0];
    const x = t.clientX;
    const y = t.clientY;

    // 授权阶段
    if (this._pendingAuth) {
      if (this.authPromptRect && this._hit(this.authPromptRect, x, y)) {
        this._doAuth();
      }
      return;
    }

    if (this._hit(this.backBtn, x, y)) { this.onBack(); return; }

    // 预览弹窗拦截
    if (this._previewing) {
      if (this._previewCloseBtn && this._hit(this._previewCloseBtn, x, y)) {
        this._closePreview();
        return;
      }
      if (this._previewDelBtn && this._hit(this._previewDelBtn, x, y)) {
        // 删除已上传的动图
        const item = this._previewTarget;
        if (item) {
          item.animDataUrl = null;
          item._animImage = null;
          item.image = null;
          delete item.anim;
          // 保存配置
          if (this.tab === 'monsters') ConfigManager.saveMonsters(ConfigManager.getMonsters());
          else if (this.tab === 'towers') ConfigManager.saveTowers(ConfigManager.getTowers());
          showToast('已删除动图', 600);
        }
        this._closePreview();
        return;
      }
      return; // 弹窗模式下不穿透
    }

    if (this.editMap) {
      this._handleMapEditorTouch(x, y);
      return;
    }

    // Tab切换
    if (this.tabButtons) {
      for (const tb of this.tabButtons) {
        if (this._hit(tb, x, y)) {
          this.tab = tb.key;
          this.render();
          return;
        }
      }
    }

    // 关卡编辑
    if (this.tab === 'levels') {
      // 如果是滚动操作，不触发按钮点击
      if (this._scrollMoved) {
        this._scrollDragging = false;
        return;
      }
      if (this._hit(this.levelAddBtn, x, y)) {
        this.editMap = true;
        this.editMapData = null;
        this.render();
        return;
      }
      if (this.levelItems) {
        for (let i = 0; i < this.levelItems.length; i++) {
          const li = this.levelItems[i];
          if (this._hit(li.editBtn, x, y)) {
            // 编辑已有关卡的地图
            this.editMap = true;
            this.editMapData = {
              grid: JSON.parse(JSON.stringify(li.level.grid)),
              path: [...li.level.path],
              spawn: { ...li.level.spawn },
              goal: { ...li.level.goal }
            };
            this.editLevel = li.level;
            this.render();
            return;
          }
          // 终点图上传
          if (this._hit(li.goalImgBtn, x, y)) {
            this._uploadGoalImage(li.level, i);
            return;
          }
          // 背景图上传
          if (this._hit(li.bgImgBtn, x, y)) {
            this._uploadLevelBg(li.level);
            return;
          }
          // 路径图上传
          if (this._hit(li.pathImgBtn, x, y)) {
            this._uploadLevelPath(li.level);
            return;
          }
        }
      }

      // 开始页背景按钮
      if (this.homeBgBtn && this._hit(this.homeBgBtn, x, y)) {
        this._uploadHomeBg();
        return;
      }
    }

    // 怪物动画图上传 + 数值编辑
    if (this.tab === 'monsters' && this.monsterItems) {
      // 数值编辑按钮
      if (this.monsterEditBtns) {
        for (const btn of this.monsterEditBtns) {
          if (this._hit(btn, x, y)) { this._editMonsterField(btn.monsterIdx, btn.field, btn.value); return; }
        }
      }
      for (const mi of this.monsterItems) {
        if (mi.animBtn && this._hit(mi.animBtn, x, y)) {
          this._uploadAnimImage(mi.monster, 'monster');
          return;
        }
        if (mi.previewBtn && this._hit(mi.previewBtn, x, y)) {
          this._previewAnimImage(mi.monster);
          return;
        }
      }
    }

    // 塔动画图上传 + 数值编辑
    if (this.tab === 'towers' && this.towerItems) {
      // 基础属性编辑
      if (this.towerEditBtns) {
        for (const btn of this.towerEditBtns) {
          if (this._hit(btn, x, y)) { this._editTowerField(btn.towerIdx, btn.field, btn.value); return; }
        }
      }
      // 等级属性编辑
      if (this.towerLevelEditBtns) {
        for (const btn of this.towerLevelEditBtns) {
          if (this._hit(btn, x, y)) { this._editTowerLevelField(btn.towerIdx, btn.levelIdx, btn.field, btn.value); return; }
        }
      }
      for (const ti of this.towerItems) {
        if (ti.animBtn && this._hit(ti.animBtn, x, y)) {
          this._uploadAnimImage(ti.tower, 'tower');
          return;
        }
        if (ti.previewBtn && this._hit(ti.previewBtn, x, y)) {
          this._previewAnimImage(ti.tower);
          return;
        }
      }
    }

    // 音频上传
    if (this.tab === 'audio') {
      if (this.bgmUploadBtn && this._hit(this.bgmUploadBtn, x, y)) {
        showAudioUploadModal('bgm'); return;
      }
      if (this.sfxButtons) {
        for (const sb of this.sfxButtons) {
          if (this._hit(sb, x, y)) { showAudioUploadModal('sfx', sb.key); return; }
        }
      }
      if (this.killSfxBtn && this._hit(this.killSfxBtn, x, y)) {
        showAudioUploadModal('sfx', 'kill'); return;
      }
    }

    // 抽卡编辑
    if (this.tab === 'gacha') {
      if (this.gachaEditBtns) {
        for (const btn of this.gachaEditBtns) {
          if (this._hit(btn, x, y)) { this._editGachaField(btn.field, btn.value); return; }
        }
      }
      if (this.weightEditBtns) {
        for (const btn of this.weightEditBtns) {
          if (this._hit(btn, x, y)) { this._editWeightField(btn.field, btn.value); return; }
        }
      }
      if (this.resetAllBtn && this._hit(this.resetAllBtn, x, y)) {
        this._resetAll(); return;
      }
    }

    // 技能卡编辑
    if (this.tab === 'spells' && this.spellEditBtns) {
      for (const btn of this.spellEditBtns) {
        if (this._hit(btn, x, y)) { this._editSpellField(btn.spellIdx, btn.field, btn.value); return; }
      }
    }

    // 同步 Tab —— 本地服务器
    if (this.tab === 'sync') {
      // 分类选择
      if (this._uploadFolderBtns) {
        for (const btn of this._uploadFolderBtns) {
          if (this._hit(btn, x, y)) {
            this._uploadFolder = btn.folder;
            this.render(); return;
          }
        }
      }
      // 保存配置
      if (this._syncBtn && this._hit(this._syncBtn, x, y)) {
        this._syncToLocalServer(); return;
      }
      // 上传图片
      if (this._uploadBtn && this._hit(this._uploadBtn, x, y)) {
        this._triggerImageUpload(); return;
      }
    }
  }

  _handleMapEditorTouch(x, y) {
    if (this._hit(this.cancelEditBtn, x, y)) {
      this.editMap = false;
      this.editMapData = null;
      this.editLevel = null;
      this.render();
      return;
    }

    if (this._hit(this.exportBtn, x, y)) {
      this._exportMap();
      return;
    }

    // 工具箱切换
    for (let b = 0; b <= 2; b++) {
      const btn = this[`tool${b}Btn`];
      if (btn && this._hit(btn, x, y)) {
        this.editBrush = b;
        this.render();
        return;
      }
    }

    // 地图绘制
    const grid = pixelToGrid(x, y);
    if (grid.col >= 0 && grid.col < GRID_COLS && grid.row >= 0 && grid.row < GRID_ROWS) {
      this.editMapData.grid[grid.row][grid.col] = this.editBrush;
      this.render();
    }
  }

  _exportMap() {
    const md = this.editMapData;
    const grid = md.grid;

    // 自动计算路径：扫描全部 path(1) 格，从spawn用BFS构建
    const path = this._autoBuildPath(grid, md.spawn, md.goal);

    const mapJSON = {
      grid,
      path,
      spawn: md.spawn,
      goal: md.goal
    };

    // 丢到storage里临时存着
    StorageUtil.set('__exported_map', mapJSON);

    // 简单提示
    this.editMap = false;
    this.editMapData = null;
    this.editLevel = null;
    this.render();
  }

  /**
   * BFS自动构建路径：从spawn到goal，仅经过值为1的格子
   */
  _autoBuildPath(grid, spawn, goal) {
    const rows = grid.length;
    const cols = grid[0].length;
    const visited = new Set();
    const queue = [[spawn.col, spawn.row]];
    const parent = {};

    const key = (c, r) => `${c},${r}`;
    visited.add(key(spawn.col, spawn.row));

    const dirs = [[0,-1],[0,1],[-1,0],[1,0]];

    while (queue.length > 0) {
      const [cx, cr] = queue.shift();
      if (cx === goal.col && cr === goal.row) {
        // 回溯构建路径
        const path = [];
        let ck = key(cx, cr);
        while (ck) {
          const [pc, pr] = ck.split(',').map(Number);
          path.unshift({ col: pc, row: pr });
          ck = parent[ck];
        }
        return path;
      }

      for (const [dc, dr] of dirs) {
        const nc = cx + dc;
        const nr = cr + dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        if (grid[nr][nc] !== 1) continue;
        const nk = key(nc, nr);
        if (visited.has(nk)) continue;
        visited.add(nk);
        parent[nk] = key(cx, cr);
        queue.push([nc, nr]);
      }
    }

    // 没找到路径，返回起点到终点的直线
    return [{ col: spawn.col, row: spawn.row }, { col: goal.col, row: goal.row }];
  }

  // ========== ☁️ 同步 Tab（本地服务器） ==========
  _renderSyncTab(ctx, y) {
    const w = this.w;
    let cy = y + 10;

    ctx.fillStyle = Color.textPrimary;
    ctx.font = Font.subtitle;
    ctx.textAlign = 'left';
    ctx.fillText('☁️ 配置同步', 12, cy + 24); cy += 36;

    ctx.fillStyle = Color.textSecondary;
    ctx.font = '11px ' + Font.family;
    ctx.fillText('将当前配置保存到本地 config.json，所有玩家下次进入游戏自动生效。', 12, cy + 16); cy += 28;
    ctx.fillText('服务器地址：localhost:3000 | 同步密码：admin888', 12, cy + 16); cy += 28;

    // 同步按钮
    cy += 10;
    drawButton(ctx, 12, cy, w - 24, 40, '📤 保存配置到 config.json', {
      color: Color.accent,
      fontSize: 14,
      fontWeight: '600'
    });
    this._syncBtn = { x: 12, y: cy, w: w - 24, h: 40 };
    cy += 50;

    // 状态提示
    if (this.syncStatus) {
      ctx.fillStyle = this.syncStatus.includes('成功') ? Color.accent : Color.warning;
      ctx.font = '12px ' + Font.family;
      ctx.textAlign = 'center';
      ctx.fillText(this.syncStatus, w / 2, cy); cy += 24;
    }

    // ==== 图片上传区 ====
    cy += 12;
    ctx.fillStyle = Color.textPrimary;
    ctx.font = Font.subtitle;
    ctx.textAlign = 'left';
    ctx.fillText('🖼️ 图片上传', 12, cy + 24); cy += 36;

    ctx.fillStyle = Color.textSecondary;
    ctx.font = '11px ' + Font.family;
    ctx.fillText('支持 PNG/JPG/SVG/WebP/GIF，上传后保存到 public/assets/ 目录。', 12, cy + 16); cy += 28;

    // 分类选择
    const folders = ['towers', 'monsters', 'spells', 'general'];
    const folderLabels = ['塔', '怪物', '技能', '通用'];
    const btnW = (w - 24 - 12) / 4;
    this._uploadFolderBtns = [];
    for (let i = 0; i < folders.length; i++) {
      const bx = 12 + i * (btnW + 4);
      const sel = this._uploadFolder === folders[i];
      drawButton(ctx, bx, cy, btnW, 28, folderLabels[i], {
        color: sel ? Color.accent : Color.card,
        fontSize: 11,
        fontWeight: sel ? '600' : '400'
      });
      this._uploadFolderBtns.push({ x: bx, y: cy, w: btnW, h: 28, folder: folders[i] });
    }
    cy += 38;

    // 上传按钮
    drawButton(ctx, 12, cy, w - 24, 36, '📎 选择图片上传', {
      color: Color.card,
      fontSize: 13,
      fontWeight: '500'
    });
    this._uploadBtn = { x: 12, y: cy, w: w - 24, h: 36 };
    cy += 44;

    // 上传结果
    if (this.uploadResult) {
      ctx.fillStyle = Color.accent;
      ctx.font = '11px ' + Font.family;
      ctx.textAlign = 'center';
      ctx.fillText('✅ ' + this.uploadResult, w / 2, cy);
    }

    cy += 30;
    ctx.fillStyle = Color.textSecondary;
    ctx.font = '10px ' + Font.family;
    ctx.textAlign = 'left';
    ctx.fillText('服务器端运行 node server.js | 部署时 config.json + public/assets 打包上传', 12, cy);
  }

  async _syncToLocalServer() {
    this.syncStatus = '正在保存...';
    this.render();

    try {
      const config = ConfigManager.exportConfig();
      const resp = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'admin888', config })
      });
      const data = await resp.json();
      if (data.ok) {
        this.syncStatus = '✅ 保存成功！config.json 已更新';
        showToast('配置已保存到服务器', 1500);
      } else {
        throw new Error(data.error || '未知错误');
      }
    } catch (e) {
      this.syncStatus = '❌ 保存失败: ' + e.message + '（请确认 server.js 已启动）';
      showToast('同步失败，检查服务器', 2000);
    }
    this.render();
  }

  _triggerImageUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/svg+xml,image/webp,image/gif';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;

      const form = new FormData();
      form.append('password', 'admin888');
      form.append('image', file);
      form.append('folder', this._uploadFolder || 'general');

      this.syncStatus = '正在上传图片...';
      this.render();

      try {
        const resp = await fetch('/api/upload', { method: 'POST', body: form });
        const data = await resp.json();
        if (data.ok) {
          this.uploadResult = data.url + ' (' + (data.size / 1024).toFixed(1) + 'KB)';
          showToast('图片上传成功', 1200);
        } else {
          throw new Error(data.error);
        }
      } catch (e) {
        this.uploadResult = '';
        this.syncStatus = '❌ 上传失败: ' + e.message;
        showToast('上传失败', 1500);
      }
      this.render();
    };
    input.click();
  }

  // ========== 开发者授权 ==========
  _isAuthorized() {
    return StorageUtil.get('__dev_authorized') === true;
  }

  _showAuthPrompt() {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = Color.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = Color.warning;
    ctx.font = Font.title;
    ctx.textAlign = 'center';
    ctx.fillText('开发者验证', w / 2, h / 3);

    ctx.fillStyle = Color.textSecondary;
    ctx.font = Font.body;
    ctx.fillText('请输入开发者密码', w / 2, h / 3 + 40);

    ctx.fillStyle = Color.card;
    ctx.fillRect(w / 2 - 80, h / 3 + 60, 160, 36);
    ctx.fillStyle = Color.textSecondary;
    ctx.textAlign = 'center';
    ctx.fillText('点击输入密码', w / 2, h / 3 + 84);

    this.authPromptRect = { x: w / 2 - 80, y: h / 3 + 60, w: 160, h: 36 };
    this._pendingAuth = true;
  }

  _doAuth() {
    showModal('开发者验证', 'admin888').then(res => {
      if (res.confirm && res.content === DEV_PASSWORD) {
        StorageUtil.set('__dev_authorized', true);
        this._pendingAuth = false;
        showToast('验证成功', 1000);
        setTimeout(() => { this.render(); }, 600);
      } else {
        showToast('密码错误', 1000);
        this._pendingAuth = false;
        if (this.onBack) setTimeout(() => this.onBack(), 600);
      }
    });
  }

  // ========== 字段编辑 ==========
  _editGachaField(field, value) {
    const gacha = ConfigManager.getGachaConfig();
    showModal(`编辑抽卡: ${field}`, String(value)).then(res => {
      if (!res.confirm) return;
      if (field === 'pityMinRarity') gacha[field] = res.content;
      else gacha[field] = parseFloat(res.content) || 0;
      gacha.pityResetOnRarePlus = true;
      ConfigManager.saveGachaConfig(gacha);
      showToast('已保存', 600);
      this.render();
    });
  }

  _editWeightField(field, value) {
    showModal(`编辑权重: ${field}`, String(value)).then(res => {
      if (!res.confirm) return;
      const weights = ConfigManager.getRarityWeights();
      weights[field] = parseFloat(res.content) || 0;
      ConfigManager.saveRarityWeights(weights);
      showToast('已保存', 600);
      this.render();
    });
  }

  _resetAll() {
    showModal('⚠️ 确认恢复默认', '输入 yes 确认。注意：所有手动修改的配置将丢失！').then(res => {
      if (res.confirm && res.content === 'yes') {
        // 清除 localStorage 中所有配置缓存
        StorageUtil.remove('__cfg_monsters');
        StorageUtil.remove('__cfg_towers');
        StorageUtil.remove('__cfg_levels');
        StorageUtil.remove('__cfg_spells');
        StorageUtil.remove('__cfg_gacha');
        StorageUtil.remove('__cfg_rarity_weights');
        // 重置初始化标记，重新从默认 JS 文件加载
        const CM = ConfigManager.constructor.prototype ? Object.getPrototypeOf(ConfigManager) : ConfigManager;
        // 直接设置 initialized = false 让下次 init 生效
        ConfigManager.initialized = false;
        ConfigManager.init().then(() => {
          showToast('已恢复默认', 800);
          this.render();
        });
      }
    });
  }

  // ========== 字段编辑 ==========
  _editMonsterField(idx, field, value) {
    showModal(`编辑怪物 ${field}`, String(value)).then(res => {
      if (!res.confirm) return;
      const monsters = ConfigManager.getMonsters();
      if (field === 'speed') monsters[idx][field] = parseFloat(res.content) || 0;
      else monsters[idx][field] = parseInt(res.content) || 0;
      ConfigManager.saveMonsters(monsters);
      showToast('已保存', 600);
      this.render();
    });
  }

  _editTowerField(idx, field, value) {
    showModal(`编辑塔 ${field}`, String(value)).then(res => {
      if (!res.confirm) return;
      const towers = ConfigManager.getTowers();
      if (field === 'cd' || field === 'range') towers[idx][field] = parseFloat(res.content) || 0;
      else towers[idx][field] = parseInt(res.content) || 0;
      ConfigManager.saveTowers(towers);
      showToast('已保存', 600);
      this.render();
    });
  }

  _editTowerLevelField(idx, lvIdx, field, value) {
    showModal(`编辑塔 Lv.${lvIdx + 1} ${field}`, String(value)).then(res => {
      if (!res.confirm) return;
      const towers = ConfigManager.getTowers();
      if (field === 'cd' || field === 'range') towers[idx].levelStats[lvIdx][field] = parseFloat(res.content) || 0;
      else towers[idx].levelStats[lvIdx][field] = parseInt(res.content) || 0;
      ConfigManager.saveTowers(towers);
      showToast('已保存', 600);
      this.render();
    });
  }

  _editSpellField(idx, field, value) {
    showModal(`编辑技能 ${field}`, String(value)).then(res => {
      if (!res.confirm) return;
      const spells = ConfigManager.getSpells();
      if (field === 'value') spells[idx][field] = parseFloat(res.content) || 0;
      else spells[idx][field] = parseInt(res.content) || 0;
      ConfigManager.saveSpells(spells);
      showToast('已保存', 600);
      this.render();
    });
  }

  // ========== 工具 ==========
  _hit(rect, x, y) {
    if (!rect) return false;
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }
}
