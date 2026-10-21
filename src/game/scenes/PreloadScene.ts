import Phaser from 'phaser';
import { ensureGlowTexture, ensureTextures } from '../entities/textureFactory';
import { LEVELS } from '../data/levels';
import { ThreeModelTextureFactory } from '../systems/ThreeModelTextureFactory';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }
  create(): void {
    ensureTextures(this);
    ThreeModelTextureFactory.ensure(this);
    ensureTextures(this);
    ensureGlowTexture(this);
    this.registry.set('levels', LEVELS);
    this.scene.start('MainMenuScene');
  }
}
