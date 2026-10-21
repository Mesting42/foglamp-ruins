import Phaser from 'phaser';
import { GameUI } from '../ui/GameUI';
import type { SettingsManager } from '../systems/SettingsManager';
import type { SaveManager } from '../systems/SaveManager';

export class PauseScene extends Phaser.Scene {
  private ui!: GameUI;
  constructor() { super('PauseScene'); }

  create(): void {
    const settings = this.registry.get('settingsManager') as SettingsManager;
    const save = this.registry.get('saveManager') as SaveManager;
    this.ui = new GameUI(document.getElementById('ui-root')!, settings, save);
    this.showMenu();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.ui.destroy(false));
  }

  private showMenu(): void {
    const level = this.scene.get('LevelScene') as { restoreHUD?: () => void };
    level.restoreHUD?.();
    this.ui.showPause({
      resume: () => {
        this.scene.resume('LevelScene'); this.scene.stop('PauseScene');
      },
      restart: () => this.scene.start('LevelScene', { index: this.registry.get('currentLevelIndex'), checkpoint: true }),
      settings: () => this.ui.showSettings(() => this.showMenu()),
      journal: () => this.ui.showJournal(() => this.showMenu()),
      levels: () => this.scene.start('LevelSelectScene'),
      menu: () => this.scene.start('MainMenuScene'),
    });
  }
}
