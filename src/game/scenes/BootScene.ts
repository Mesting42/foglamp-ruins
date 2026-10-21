import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';
import type { SettingsManager } from '../systems/SettingsManager';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }
  create(): void {
    if (!this.registry.get('audioManager')) {
      this.registry.set('audioManager', new AudioManager());
    }
    const audio = this.registry.get('audioManager') as AudioManager;
    const settings = this.registry.get('settingsManager') as SettingsManager;
    audio.setVolume(settings.value.volume);
    settings.subscribe((value) => audio.setVolume(value.volume));
    this.scene.start('PreloadScene');
  }
}
