/**
 * SceneManager.js - 场景管理器
 * 管理页面切换和触摸事件分发
 */
import { HomePage } from '../../pages/home/HomePage.js';
import { LevelSelectPage } from '../../pages/levelSelect/LevelSelectPage.js';
import { GamePage } from '../../pages/game/GamePage.js';
import { SCENE } from './SceneTypes.js';

export class SceneManager {
  constructor(canvas, ctx, screenW, screenH) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.screenW = screenW;
    this.screenH = screenH;
    this.currentScene = null;
    this.currentPage = null;

    this.pages = {
      [SCENE.HOME]: new HomePage(ctx, screenW, screenH, () => this.goto(SCENE.LEVEL_SELECT)),
      [SCENE.LEVEL_SELECT]: new LevelSelectPage(ctx, screenW, screenH, (levelId) => this.goto(SCENE.GAME, levelId), () => this.goto(SCENE.HOME)),
      [SCENE.GAME]: new GamePage(ctx, screenW, screenH, (scene) => this.goto(scene))
    };
  }

  goto(scene, data) {
    if (this.currentPage && this.currentPage.onLeave) {
      this.currentPage.onLeave();
    }

    this.currentScene = scene;
    this.currentPage = this.pages[scene];

    if (this.currentPage && this.currentPage.onEnter) {
      this.currentPage.onEnter(data);
    }

    if (this.currentPage && this.currentPage.render) {
      this.currentPage.render(data);
    }
  }

  onTouchStart(e) { if (this.currentPage) this.currentPage.onTouchStart(e); }
  onTouchMove(e) { if (this.currentPage) this.currentPage.onTouchMove(e); }
  onTouchEnd(e) { if (this.currentPage) this.currentPage.onTouchEnd(e); }
}
