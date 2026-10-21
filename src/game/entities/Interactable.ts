import Phaser from 'phaser';
import type { LevelDefinition } from '../data/types';
import { ThreeModelTextureFactory } from '../systems/ThreeModelTextureFactory';

export type InteractableKind = LevelDefinition['interactables'][number]['kind'];

const COLOR: Record<InteractableKind, number> = {
  switch: 0xe8b75b, rune: 0x82c8b5, valve: 0x73c9d0, chest: 0xd39956, npc: 0x9cc7ac, platform: 0x70c2ca,
};

export class Interactable extends Phaser.GameObjects.Container {
  readonly id: string;
  readonly kind: InteractableKind;
  readonly label: string;
  active = true;
  lit = false;
  private icon: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Arc;
  private age = Math.random() * 6;
  private worldRendered = false;

  constructor(scene: Phaser.Scene, spec: { id: string; x: number; y: number; kind: InteractableKind; label: string }) {
    super(scene, spec.x, spec.y);
    this.id = spec.id; this.kind = spec.kind; this.label = spec.label;
    this.halo = scene.add.circle(0, 0, 26, COLOR[this.kind], 0).setStrokeStyle(1, COLOR[this.kind], .27);
    const modelKey = ThreeModelTextureFactory.interactableKey(this.kind, false, ThreeModelTextureFactory.npcVariant(spec.id));
    if (scene.textures.exists(modelKey)) {
      const dimensions = this.kind === 'npc' ? [60, 74] : this.kind === 'platform' ? [62, 50] : [48, 56];
      this.icon = scene.add.image(0, 0, modelKey).setDisplaySize(dimensions[0], dimensions[1]);
    } else {
      this.icon = scene.add.graphics();
      this.drawIcon(COLOR[this.kind]);
    }
    this.add([this.halo, this.icon]);
    this.setDepth(12);
    scene.add.existing(this);
  }

  setLit(value: boolean): void {
    this.lit = value;
    if (this.icon instanceof Phaser.GameObjects.Image) {
      const key = ThreeModelTextureFactory.interactableKey(this.kind, value, ThreeModelTextureFactory.npcVariant(this.id));
      if (this.scene.textures.exists(key)) this.icon.setTexture(key);
      return;
    }
    this.drawIcon(value ? 0xffe29a : COLOR[this.kind]);
  }
  setWorldRendered(): void { this.worldRendered = true; this.setAlpha(0); }
  deactivate(): void { this.active = false; this.setAlpha(this.worldRendered ? 0 : .28); this.setScale(.88); }

  updateVisual(dt: number): void {
    this.age += dt;
    this.halo.setAlpha(this.lit ? .14 + Math.sin(this.age * 4) * .05 : .04 + Math.sin(this.age * 2) * .025);
    this.halo.setScale(1 + Math.sin(this.age * 2.5) * .04);
    this.icon.setY(Math.sin(this.age * 2) * 2);
  }

  private drawIcon(color: number): void {
    if (!(this.icon instanceof Phaser.GameObjects.Graphics)) return;
    this.icon.clear(); this.icon.lineStyle(3, color, 1); this.icon.fillStyle(color, .14);
    if (this.kind === 'chest') {
      this.icon.fillRoundedRect(-16, -10, 32, 22, 4); this.icon.strokeRoundedRect(-16, -10, 32, 22, 4);
      this.icon.lineBetween(-16, -2, 16, -2); this.icon.fillCircle(0, 2, 2.5);
    } else if (this.kind === 'npc') {
      this.icon.fillCircle(0, -7, 9); this.icon.strokeCircle(0, -7, 9); this.icon.strokeRoundedRect(-13, 3, 26, 20, 7);
    } else if (this.kind === 'valve') {
      this.icon.strokeCircle(0, 0, 14); this.icon.lineBetween(-13, 0, 13, 0); this.icon.lineBetween(0, -13, 0, 13);
      this.icon.fillCircle(0, 0, 4);
    } else if (this.kind === 'rune') {
      this.icon.strokeCircle(0, 0, 15); this.icon.strokeCircle(0, 0, 7); this.icon.lineBetween(0, -13, 0, 13); this.icon.lineBetween(-11, 7, 11, -7);
    } else {
      this.icon.strokeRoundedRect(-12, -17, 24, 34, 5); this.icon.lineBetween(-12, 0, 12, 0);
      this.icon.fillCircle(0, -9, 4); this.icon.fillCircle(0, 9, 4);
    }
  }
}
