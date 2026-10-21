import Phaser from 'phaser';
import { GameUI } from '../ui/GameUI';
import type { SettingsManager } from '../systems/SettingsManager';
import type { SaveManager } from '../systems/SaveManager';

export class LevelSelectScene extends Phaser.Scene {
  constructor() { super('LevelSelectScene'); }
  create(): void {
    const settings = this.registry.get('settingsManager') as SettingsManager;
    const save = this.registry.get('saveManager') as SaveManager;
    const ui = new GameUI(document.getElementById('ui-root')!, settings, save);
    ui.showLevelSelect(save.value.unlockedLevel, (index) => this.scene.start('LevelScene', { index }), () => this.scene.start('MainMenuScene'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => ui.destroy());
  }
}
