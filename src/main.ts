import Phaser from 'phaser';
import './styles/main.css';
import { BootScene } from './game/scenes/BootScene';
import { PreloadScene } from './game/scenes/PreloadScene';
import { MainMenuScene } from './game/scenes/MainMenuScene';
import { LevelSelectScene } from './game/scenes/LevelSelectScene';
import { LevelScene } from './game/scenes/LevelScene';
import { PauseScene } from './game/scenes/PauseScene';
import { GameOverScene } from './game/scenes/GameOverScene';
import { EndingScene } from './game/scenes/EndingScene';
import { SettingsManager } from './game/systems/SettingsManager';
import { SaveManager } from './game/systems/SaveManager';
import { LevelManager } from './game/systems/LevelManager';
import { observeDeviceLayout } from './game/systems/DeviceLayout';

observeDeviceLayout();

const settings = new SettingsManager();
const saves = new SaveManager(settings);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#081a24',
  transparent: true,
  width: 960,
  height: 540,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: true,
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: true,
    powerPreference: 'high-performance',
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false, gravity: { x: 0, y: 0 } },
  },
  input: {
    activePointers: 4,
    gamepad: true,
  },
  fps: { target: 60, forceSetTimeOut: false },
  scene: [BootScene, PreloadScene, MainMenuScene, LevelSelectScene, LevelScene, PauseScene, GameOverScene, EndingScene],
};

const game = new Phaser.Game(config);
settings.attachGame(game);
saves.load();
game.registry.set('settingsManager', settings);
game.registry.set('saveManager', saves);
game.registry.set('levelManager', new LevelManager(saves));

window.addEventListener('beforeunload', () => saves.flush());
window.addEventListener('contextmenu', (event) => event.preventDefault());

declare global {
  interface Window {
    foglampGame?: Phaser.Game;
  }
}
window.foglampGame = game;
