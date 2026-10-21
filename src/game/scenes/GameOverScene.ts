import Phaser from 'phaser';
import { GameUI } from '../ui/GameUI';
import type { SettingsManager } from '../systems/SettingsManager';
import type { SaveManager } from '../systems/SaveManager';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }
  create(data: { index?: number }): void {
    const settings = this.registry.get('settingsManager') as SettingsManager;
    const save = this.registry.get('saveManager') as SaveManager;
    const index = data.index ?? save.value.currentLevel;
    const ui = new GameUI(document.getElementById('ui-root')!, settings, save);
    ui.showGameOver({
      retry: () => this.scene.start('LevelScene', { index, checkpoint: true }),
      menu: () => this.scene.start('MainMenuScene'),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => ui.destroy());
  }
}
