/**
 * UIManager.js - 全局 UI 辅助
 * Toast 提示、Modal 弹窗、音量控件
 */
import { AudioManager } from '../audio/AudioManager.js';

// ---- DOM 引用（由 browser-entry 初始化） ----
let $toast, $modalOverlay, $modalTitle, $modalInput, $modalConfirm, $modalCancel;

export function initUIDOM() {
  $toast = document.getElementById('toast');
  $modalOverlay = document.getElementById('modalOverlay');
  $modalTitle = document.getElementById('modalTitle');
  $modalInput = document.getElementById('modalInput');
  $modalConfirm = document.getElementById('modalConfirm');
  $modalCancel = document.getElementById('modalCancel');
}

// ---- Toast ----
let _toastTimer = null;
export function showToast(msg, duration) {
  if (!$toast) { console.log('[Toast]', msg); return; }
  $toast.textContent = msg;
  $toast.classList.add('show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => $toast.classList.remove('show'), duration || 1500);
}

// ---- Modal ----
let _modalResolve = null;

export function showModal(title, placeholder) {
  if (!$modalOverlay) return Promise.resolve({ confirm: false });
  return new Promise(resolve => {
    _modalResolve = resolve;
    $modalTitle.textContent = title;
    $modalInput.placeholder = placeholder || '';
    $modalInput.value = '';
    $modalOverlay.classList.add('active');
    $modalInput.focus();
  });
}

function _initModalEvents() {
  if (!$modalCancel || !$modalConfirm) return;
  $modalCancel.addEventListener('click', () => {
    $modalOverlay.classList.remove('active');
    if (_modalResolve) _modalResolve({ confirm: false });
  });
  $modalConfirm.addEventListener('click', () => {
    $modalOverlay.classList.remove('active');
    if (_modalResolve) _modalResolve({ confirm: true, content: $modalInput.value });
  });
}

// ---- 音量控件 ----
let _volumeWidgetInitialized = false;

export function initVolumeWidget() {
  if (_volumeWidgetInitialized) return;
  _volumeWidgetInitialized = true;

  const panel = document.getElementById('volPanel');
  const toggle = document.getElementById('volToggle');
  if (!panel || !toggle) return;

  const tracks = panel.querySelectorAll('.vol-track');
  let dragging = null, open = false;

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    open = !open;
    panel.classList.toggle('open', open);
    AudioManager.playClick();
  });

  document.addEventListener('click', (e) => {
    if (open && !panel.contains(e.target) && e.target !== toggle) {
      open = false;
      panel.classList.remove('open');
    }
  });

  function updateTrack(track) {
    const key = track.dataset.key;
    const vol = key === 'bgm' ? AudioManager.getBGMVolume() : AudioManager.getSFXVolume();
    const fill = track.querySelector('.vol-fill');
    const handle = track.querySelector('.vol-handle');
    const valEl = track.parentElement.querySelector('.vol-val');
    const pct = vol * 100;
    if (fill) fill.style.width = pct + '%';
    if (handle) handle.style.left = pct + '%';
    if (valEl) valEl.textContent = Math.round(pct);
    if (fill) {
      fill.style.background = AudioManager.isMuted() ? '#666'
        : key === 'bgm' ? '#4CAF50' : '#FF9800';
    }
  }

  function getVolFromTrack(track, clientX) {
    const rect = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  tracks.forEach(track => {
    track.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      dragging = track;
      const v = getVolFromTrack(track, e.clientX);
      track.dataset.key === 'bgm' ? AudioManager.setBGMVolume(v) : AudioManager.setSFXVolume(v);
      updateTrack(track);
    });
    track.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      dragging = track;
      const t = e.touches[0];
      const v = getVolFromTrack(track, t.clientX);
      track.dataset.key === 'bgm' ? AudioManager.setBGMVolume(v) : AudioManager.setSFXVolume(v);
      updateTrack(track);
    }, { passive: false });
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const v = getVolFromTrack(dragging, e.clientX);
    dragging.dataset.key === 'bgm' ? AudioManager.setBGMVolume(v) : AudioManager.setSFXVolume(v);
    updateTrack(dragging);
  });
  document.addEventListener('mouseup', () => { dragging = null; });
  document.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    const t = e.touches[0];
    const v = getVolFromTrack(dragging, t.clientX);
    dragging.dataset.key === 'bgm' ? AudioManager.setBGMVolume(v) : AudioManager.setSFXVolume(v);
    updateTrack(dragging);
  }, { passive: false });
  document.addEventListener('touchend', () => { dragging = null; });

  // Initial display
  tracks.forEach(t => updateTrack(t));
  updateVolToggleIcon();
}

export function updateVolToggleIcon() {
  const t = document.getElementById('volToggle');
  if (t) t.textContent = AudioManager.isMuted() ? '🔇' : '♫';
}

/** 音量控件显隐 */
export function setVolumeWidgetVisible(visible) {
  const widget = document.getElementById('volWidget');
  if (widget) widget.style.display = visible ? '' : 'none';
}

// ---- 音频上传弹窗 ----
export function showAudioUploadModal(type, sfxType) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (type === 'bgm') {
      input.accept = 'audio/mp3,audio/wav,audio/ogg';
    } else {
      input.accept = 'audio/wav,audio/mp3,audio/ogg';
    }
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) { resolve(false); return; }
      let ok = false;
      if (type === 'bgm') {
        ok = await AudioManager.uploadBGM(file);
      } else {
        ok = await AudioManager.uploadSFX(sfxType, file);
      }
      resolve(ok);
    };
    input.click();
  });
}

// ---- 初始化事件 ----
export function bootstrapUI() {
  initUIDOM();
  _initModalEvents();
  initVolumeWidget();
  // 注入 toast 给 AudioManager
  AudioManager.constructor.setToast(showToast);
}
