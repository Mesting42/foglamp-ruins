import type Phaser from 'phaser';

/** Bounded reusable effects. Reduced motion keeps the semantic flash without travel. */
export class WorldFeedback {
  private rings: Phaser.GameObjects.Arc[];
  private cursor = 0;
  private links: Phaser.GameObjects.Graphics;
  private linkAge = 0;
  constructor(private scene: Phaser.Scene, private reduceMotion: () => boolean) {
    this.rings = Array.from({ length: 8 }, () => scene.add.circle(0, 0, 20, 0xffd477, .12).setStrokeStyle(3, 0xffd477, .9).setDepth(24).setVisible(false));
    this.links = scene.add.graphics().setDepth(11);
  }
  ring(x: number, y: number, color: number, radius = 100): void {
    const ring = this.rings[this.cursor++ % this.rings.length];
    this.scene.tweens.killTweensOf(ring);
    ring.setPosition(x, y).setRadius(this.reduceMotion() ? radius : 20).setScale(1).setAlpha(1).setStrokeStyle(3, color, .9).setFillStyle(color, .1).setVisible(true);
    this.scene.tweens.add({ targets: ring, scale: this.reduceMotion() ? 1 : radius / 20, alpha: 0, duration: this.reduceMotion() ? 180 : 500, onComplete: () => ring.setVisible(false) });
  }
  connect(a: { x: number; y: number }, b: { x: number; y: number }): void {
    this.links.clear().lineStyle(9, 0xffd477, .17).lineBetween(a.x, a.y, b.x, b.y);
    this.links.lineStyle(2, 0xffdf96, .9).lineBetween(a.x, a.y, b.x, b.y);
    this.linkAge = this.reduceMotion() ? .3 : 1;
  }
  update(dt: number): void {
    if (this.linkAge <= 0) return;
    this.linkAge -= dt; this.links.setAlpha(Math.max(0, this.linkAge));
    if (this.linkAge <= 0) this.links.clear();
  }
  destroy(): void { this.rings.forEach(r => r.destroy()); this.links.destroy(); }
}
