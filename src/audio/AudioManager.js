/**
 * AudioManager.js - 音频管理器
 * BGM/SFX 合成播放、自定义上传、音量控制
 */
import { StorageUtil } from '../utils/StorageUtil.js';

let _audioCtx = null;
let _showToast = null; // 由外部注入，避免循环引用

class _AudioManager {
  constructor() {
    this.initialized = false;
    this.sfxVolume = this._loadVol('sfx', 0.7);
    this.bgmVolume = this._loadVol('bgm', 0.4);
    this.muted = StorageUtil.get('__vol_muted') === true;
    this.bgmPlaying = false;
    this._bgmOscs = [];
    this._bgmSrc = null;
    this._uploadedBGM = null;
    this._uploadedSFX = {}; // { type: audioBuffer }
  }

  /** 注入全局 toast 函数（避免循环引用） */
  static setToast(fn) { _showToast = fn; }

  _loadVol(key, def) { const v = StorageUtil.get('__vol_' + key); return (v !== null && v !== undefined) ? v : def; }
  _saveVol(key, v) { StorageUtil.set('__vol_' + key, v); }

  get audioCtx() {
    if (!_audioCtx) {
      try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return null; }
    }
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    if (!this.initialized && _audioCtx) this._initNodes();
    return _audioCtx;
  }

  _initNodes() {
    const ctx = _audioCtx;
    this.masterGain = ctx.createGain(); this.masterGain.connect(ctx.destination);
    this.sfxGain = ctx.createGain(); this.sfxGain.connect(this.masterGain);
    this.bgmGain = ctx.createGain(); this.bgmGain.connect(this.masterGain);
    this.initialized = true; this._applyVolumes();
  }

  _applyVolumes() {
    if (!this.initialized) return;
    const t = this.audioCtx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.03);
    this.sfxGain.gain.setTargetAtTime(this.muted ? 0 : this.sfxVolume, t, 0.03);
    this.bgmGain.gain.setTargetAtTime(this.muted ? 0 : this.bgmVolume, t, 0.03);
  }

  getSFXVolume() { return this.sfxVolume; }
  getBGMVolume() { return this.bgmVolume; }
  isMuted() { return this.muted; }
  setSFXVolume(v) { this.sfxVolume = Math.max(0, Math.min(1, v)); this._saveVol('sfx', this.sfxVolume); this._applyVolumes(); }
  setBGMVolume(v) { this.bgmVolume = Math.max(0, Math.min(1, v)); this._saveVol('bgm', this.bgmVolume); this._applyVolumes(); }
  toggleMute() { this.muted = !this.muted; StorageUtil.set('__vol_muted', this.muted); this._applyVolumes(); return this.muted; }

  // BGM — uploaded file or ambient drone
  startBGM() {
    const ctx = this.audioCtx; if (!ctx || this.bgmPlaying) return;
    this.bgmPlaying = true;
    if (this._uploadedBGM) {
      this._bgmSrc = ctx.createBufferSource();
      this._bgmSrc.buffer = this._uploadedBGM;
      this._bgmSrc.loop = true;
      this._bgmSrc.connect(this.bgmGain);
      this._bgmSrc.start(ctx.currentTime);
    } else {
      this._bgmLoop();
    }
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this._bgmSrc) { try { this._bgmSrc.stop(); } catch(e) {} this._bgmSrc = null; }
    for (const o of this._bgmOscs) { try { o.stop(); } catch(e) {} }
    this._bgmOscs = [];
  }

  _bgmLoop() {
    if (!this.bgmPlaying) return;
    const ctx = this.audioCtx; if (!ctx) return;
    const now = ctx.currentTime;
    // Deep drone pad
    const d = ctx.createOscillator(); d.type = 'sine';
    const dg = ctx.createGain(); d.frequency.setValueAtTime(55, now);
    d.frequency.linearRampToValueAtTime(58, now + 4);
    d.frequency.linearRampToValueAtTime(55, now + 8);
    dg.gain.setValueAtTime(0, now); dg.gain.linearRampToValueAtTime(0.13, now + 1.5);
    dg.gain.linearRampToValueAtTime(0.13, now + 7.5); dg.gain.linearRampToValueAtTime(0, now + 8);
    d.connect(dg); dg.connect(this.bgmGain); d.start(now); d.stop(now + 8);
    this._bgmOscs.push(d, dg);
    // Beat ticks
    for (let i = 0; i < 4; i++) {
      const t = ctx.createOscillator(); t.type = 'triangle';
      const tg = ctx.createGain(); t.frequency.setValueAtTime(220, now + i * 2);
      tg.gain.setValueAtTime(0, now + i * 2); tg.gain.linearRampToValueAtTime(0.06, now + i * 2 + 0.03);
      tg.gain.linearRampToValueAtTime(0, now + i * 2 + 0.25);
      t.connect(tg); tg.connect(this.bgmGain); t.start(now + i * 2); t.stop(now + i * 2 + 0.25);
      this._bgmOscs.push(t, tg);
    }
    // Shimmer
    const s = ctx.createOscillator(); s.type = 'sine';
    const sg = ctx.createGain(); s.frequency.setValueAtTime(330, now);
    s.frequency.linearRampToValueAtTime(440, now + 4);
    s.frequency.linearRampToValueAtTime(330, now + 8);
    sg.gain.setValueAtTime(0.03, now); sg.gain.linearRampToValueAtTime(0.04, now + 4);
    sg.gain.linearRampToValueAtTime(0.01, now + 7); sg.gain.linearRampToValueAtTime(0, now + 8);
    s.connect(sg); sg.connect(this.bgmGain); s.start(now); s.stop(now + 8);
    this._bgmOscs.push(s, sg);
    // Loop — 用 AudioContext.currentTime 精确调度，避免后台标签页节流
    const loopDelay = 8000;
    const checkLoop = () => {
      if (!this.bgmPlaying) return;
      if (ctx.currentTime >= now + loopDelay / 1000 - 0.1) {
        this._bgmOscs = this._bgmOscs.filter(o => { try { o.stop(); } catch(e){} return false; });
        this._bgmLoop();
      } else {
        setTimeout(checkLoop, 200);
      }
    };
    setTimeout(checkLoop, loopDelay - 500);
  }

  // SFX — attack sounds
  playAttack(type) {
    if (this.muted) return;
    const ctx = this.audioCtx; if (!ctx) return;
    if (this._uploadedSFX[type]) { this._playBuffer(ctx, this._uploadedSFX[type]); return; }
    const now = ctx.currentTime;
    switch (type) {
      case 'arrow': this._tone(ctx, now, 800, 400, 0.06, 'sawtooth', 0.25); break;
      case 'cannonball': this._noise(ctx, now, 0.12, 0.35); this._tone(ctx, now, 80, 40, 0.15, 'sine', 0.5); break;
      case 'magic': this._sweep(ctx, now, 600, 1200, 0.1, 0.3); this._tone(ctx, now + 0.04, 800, 200, 0.06, 'sine', 0.15); break;
      case 'ice': this._tone(ctx, now, 1400, 1100, 0.08, 'sine', 0.2); this._tone(ctx, now + 0.03, 1800, 1300, 0.06, 'sine', 0.15); break;
      case 'bullet': this._noise(ctx, now, 0.03, 0.12); this._tone(ctx, now, 2200, 500, 0.025, 'square', 0.1); break;
      case 'fire': this._noise(ctx, now, 0.18, 0.45); this._sweep(ctx, now, 250, 60, 0.2, 0.3); break;
      default: this._tone(ctx, now, 500, 300, 0.04, 'triangle', 0.2);
    }
  }

  playKill() {
    if (this.muted) return;
    const ctx = this.audioCtx; if (!ctx) return;
    if (this._uploadedSFX['kill']) { this._playBuffer(ctx, this._uploadedSFX['kill']); return; }
    const now = ctx.currentTime;
    [523, 659, 784].forEach((f, i) => { this._tone(ctx, now + i * 0.05, f, f * 0.7, 0.07, 'sine', 0.15); });
  }

  playClick() {
    if (this.muted) return;
    const ctx = this.audioCtx; if (!ctx) return;
    this._tone(ctx, ctx.currentTime, 700, 500, 0.025, 'sine', 0.12);
  }

  _playBuffer(ctx, buffer) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.sfxGain);
    src.start(ctx.currentTime);
  }

  async uploadBGM(file) {
    const ctx = this.audioCtx; if (!ctx) return false;
    try {
      const buf = await file.arrayBuffer();
      const ab = await ctx.decodeAudioData(buf);
      this._uploadedBGM = ab;
      StorageUtil.set('__upload_bgm_name', file.name);
      if (_showToast) _showToast('BGM已上传', 1200);
      this.stopBGM(); this.startBGM();
      return true;
    } catch(e) { 
      if (_showToast) _showToast('BGM上传失败', 1200);
      return false; 
    }
  }

  async uploadSFX(type, file) {
    const ctx = this.audioCtx; if (!ctx) return false;
    try {
      const buf = await file.arrayBuffer();
      const ab = await ctx.decodeAudioData(buf);
      this._uploadedSFX[type] = ab;
      StorageUtil.set('__upload_sfx_' + type, file.name);
      if (_showToast) _showToast(`${type}音效已上传`, 1200);
      return true;
    } catch(e) { 
      if (_showToast) _showToast('音效上传失败', 1200);
      return false; 
    }
  }

  static _getUploadedSFXName() {
    return StorageUtil.get('__upload_sfx_generic');
  }

  // Internal sound generators
  _tone(ctx, time, fStart, fEnd, dur, type, vol) {
    const o = ctx.createOscillator(); o.type = type || 'sine';
    const g = ctx.createGain();
    o.frequency.setValueAtTime(fStart, time);
    if (fEnd !== fStart) o.frequency.linearRampToValueAtTime(fEnd, time + dur);
    g.gain.setValueAtTime(vol || 0.3, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(g); g.connect(this.sfxGain); o.start(time); o.stop(time + dur);
  }

  _noise(ctx, time, dur, vol) {
    const len = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol * 0.5, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.setValueAtTime(400, time);
    src.connect(flt); flt.connect(g); g.connect(this.sfxGain); src.start(time); src.stop(time + dur);
  }

  _sweep(ctx, time, fStart, fEnd, dur, vol) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const g = ctx.createGain();
    o.frequency.setValueAtTime(fStart, time);
    o.frequency.exponentialRampToValueAtTime(Math.max(fEnd, 20), time + dur);
    g.gain.setValueAtTime(vol || 0.2, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(g); g.connect(this.sfxGain); o.start(time); o.stop(time + dur);
  }
}

export const AudioManager = new _AudioManager();
