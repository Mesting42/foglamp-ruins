import Phaser from 'phaser';
import { GameUI } from '../ui/GameUI';
import type { SettingsManager } from '../systems/SettingsManager';
import type { SaveManager } from '../systems/SaveManager';

export class MainMenuScene extends Phaser.Scene {
  private backdrop?: Phaser.GameObjects.Container;
  constructor() { super('MainMenuScene'); }

  create(): void {
    this.drawBackdrop();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.drawBackdrop, this);
    const settings = this.registry.get('settingsManager') as SettingsManager;
    const save = this.registry.get('saveManager') as SaveManager;
    const ui = new GameUI(document.getElementById('ui-root')!, settings, save);
    const actions = {
      continue: () => this.scene.start('LevelScene', { index: save.value.currentLevel }),
      newGame: () => { save.newGame(); this.scene.start('LevelScene', { index: 0 }); },
      levels: () => this.scene.start('LevelSelectScene'),
      credits: () => ui.showCredits(() => ui.showMainMenu(actions)),
    };
    ui.showMainMenu(actions);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.drawBackdrop, this);
      this.backdrop = undefined;
      ui.destroy();
    });
  }

  private drawBackdrop(): void {
    if (this.backdrop) {
      this.tweens.killTweensOf(this.backdrop.list);
      this.backdrop.destroy(true);
    }
    const backdrop = this.add.container(0, 0).setDepth(-10) as Phaser.GameObjects.Container;
    this.backdrop = backdrop;
    const { width, height } = this.scale;
    const bg = this.add.graphics().setScrollFactor(0).setDepth(-10);
    bg.fillGradientStyle(0x0d2930, 0x0d2930, 0x071820, 0x071820, 1);
    bg.fillRect(0, 0, width, height);
    backdrop.add(bg);
    for (let i = 0; i < 38; i++) {
      const x = Math.random() * width, y = Math.random() * height;
      const r = 22 + Math.random() * 95;
      const fog = this.add.circle(x, y, r, i % 3 === 0 ? 0x527f78 : 0x355b58, .035 + Math.random() * .035).setScrollFactor(0);
      backdrop.add(fog);
      this.tweens.add({ targets: fog, x: x + Phaser.Math.Between(-30, 30), y: y + Phaser.Math.Between(-16, 16), alpha: fog.alpha + .025, duration: 3500 + Math.random() * 4000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const seal = this.add.graphics().setScrollFactor(0).setAlpha(.12);
    backdrop.add(seal);
    seal.lineStyle(1, 0x9ac9bc);
    seal.strokeCircle(width * .78, height * .51, Math.min(width, height) * .26);
    seal.strokeCircle(width * .78, height * .51, Math.min(width, height) * .2);
    seal.lineBetween(width * .78, height * .23, width * .78, height * .79);
    seal.lineBetween(width * .5, height * .51, width * 1.06, height * .51);
    for (let i = 0; i < 8; i++) {
      const angle = Math.PI * i / 4;
      seal.strokeCircle(width * .78 + Math.cos(angle) * Math.min(width, height) * .14, height * .51 + Math.sin(angle) * Math.min(width, height) * .14, 6);
    }
    const fragments = (this.registry.get('saveManager') as SaveManager | undefined)?.value.fragments ?? 0;
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / 5;
      const x = width * .78 + Math.cos(angle) * Math.min(width, height) * .2;
      const y = height * .51 + Math.sin(angle) * Math.min(width, height) * .2;
      backdrop.add(this.add.circle(x, y, i < fragments ? 8 : 5, i < fragments ? 0xffce7b : 0x527f78, i < fragments ? .9 : .35));
      if (i < fragments) backdrop.add(this.add.circle(x, y, 22, 0xffce7b, .09));
    }
  }
}
