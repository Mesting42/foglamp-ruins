import Phaser from 'phaser';
import type { Player } from './Player';

/** Every warning shares geometry with its deterministic damage test. No per-frame dice rolls. */
export class Boss extends Phaser.Physics.Arcade.Sprite {
  health = 12;
  readonly maxHealth = 12;
  phase = 1;
  alive = true;
  private timer = 1.3;
  private mode: 'wake' | 'warn' | 'attack' | 'rest' = 'wake';
  private ring: Phaser.GameObjects.Arc;
  private corridor: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private bodyRef: Phaser.Physics.Arcade.Body;
  private origin = { x: 0, y: 0 };
  private target = { x: 0, y: 0 };
  private waveRadius = 0;
  private attackHit = false;
  private visualPhase = 1;
  private previous = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'boss');
    scene.add.existing(this); scene.physics.add.existing(this);
    this.setDepth(19);
    if (this.frame.width >= 224) this.setDisplaySize(168, 168); else this.setScale(1.5);
    this.bodyRef = this.body as Phaser.Physics.Arcade.Body;
    const scale = this.frame.width >= 224 ? 2 : 1;
    this.bodyRef.setCircle(28 * scale).setOffset(8 * scale, 8 * scale).setImmovable(true);
    this.ring = scene.add.circle(x, y, 118, 0xe96850, .16).setStrokeStyle(3, 0xff9574, .95).setDepth(18).setVisible(false);
    this.corridor = scene.add.graphics().setDepth(18);
    this.label = scene.add.text(x, y - 90, '', { fontFamily: 'sans-serif', fontSize: '13px', color: '#ffe8b0', backgroundColor: '#381f21', padding: { x: 8, y: 5 } }).setOrigin(.5).setDepth(25).setVisible(false);
  }

  get cue(): string {
    if (this.mode === 'rest') return '破绽出现 · 雾灯可命中';
    if (this.mode === 'warn' && this.timer <= .55) return '灯芯暴露 · 现在可打断';
    return this.phase === 1 ? '避开圆形脉冲' : this.phase === 2 ? '冲刺穿过火浪' : '离开冲锋路线';
  }

  updateBoss(player: Player, dt: number): boolean {
    if (!this.alive) return false;
    this.phase = this.health > 8 ? 1 : this.health > 4 ? 2 : 3;
    if (this.visualPhase !== this.phase) {
      this.visualPhase = this.phase;
      const key = 'boss-phase-' + this.phase;
      if (this.scene.textures.exists(key)) this.setTexture(key);
    }
    this.timer -= dt;
    this.label.setPosition(this.x, this.y - 90);
    if (this.mode === 'wake') {
      this.bodyRef.setVelocity(0, 0);
      if (this.timer <= 0) {
        this.mode = 'warn'; this.timer = this.phase === 3 ? 1.1 : 1.4;
        this.origin = { x: this.x, y: this.y };
        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        this.target = { x: this.x + Math.cos(angle) * 230, y: this.y + Math.sin(angle) * 230 };
      }
      return false;
    }
    if (this.mode === 'warn') {
      this.label.setVisible(true).setText(this.cue);
      const color = this.timer <= .55 ? 0xffdc83 : 0xf47d68;
      this.ring.setPosition(this.x, this.y).setRadius(this.phase === 1 ? 118 : 205).setStrokeStyle(3, color, .95).setVisible(this.phase !== 3);
      this.corridor.clear();
      if (this.phase === 3) {
        this.corridor.lineStyle(104, color, .22).lineBetween(this.origin.x, this.origin.y, this.target.x, this.target.y);
        this.corridor.lineStyle(3, color, 1).lineBetween(this.origin.x, this.origin.y, this.target.x, this.target.y);
        this.corridor.strokeCircle(this.target.x, this.target.y, 52);
      }
      if (this.timer <= 0) {
        this.mode = 'attack'; this.timer = this.phase === 2 ? 1.05 : this.phase === 3 ? .72 : .25;
        this.waveRadius = 0; this.attackHit = false; this.previous = { x: this.x, y: this.y };
        if (this.phase === 3) {
          const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
          this.bodyRef.setVelocity(Math.cos(angle) * 320, Math.sin(angle) * 320);
        }
      }
      return false;
    }
    if (this.mode === 'attack') {
      this.label.setVisible(false);
      let danger = false;
      if (this.phase === 1) {
        this.ring.setRadius(118).setFillStyle(0xf47d68, .38);
        danger = Phaser.Math.Distance.Between(this.origin.x, this.origin.y, player.x, player.y) <= 118;
      } else if (this.phase === 2) {
        const priorRadius = this.waveRadius;
        this.waveRadius = Math.min(205, this.waveRadius + dt * 205);
        this.ring.setRadius(Math.max(1, this.waveRadius)).setFillStyle(0xf47d68, 0).setStrokeStyle(16, 0xffa164, .9);
        const distance = Phaser.Math.Distance.Between(this.origin.x, this.origin.y, player.x, player.y);
        danger = distance >= priorRadius - 8 && distance <= this.waveRadius + 8;
      } else {
        this.ring.setVisible(false);
        danger = pointSegmentDistance(player, this.previous, this) <= 52;
        this.previous = { x: this.x, y: this.y };
      }
      let hit = false;
      if (danger && !this.attackHit) { hit = player.takeDamage(1); this.attackHit = true; }
      if (this.timer <= 0) {
        this.mode = 'rest'; this.timer = 1.15;
        this.bodyRef.setVelocity(0, 0); this.hideWarning();
      }
      return hit;
    }
    this.hideWarning(); this.bodyRef.setVelocity(0, 0);
    this.label.setVisible(true).setText(this.cue);
    if (this.timer <= 0) { this.mode = 'wake'; this.timer = .6; this.label.setVisible(false); }
    return false;
  }

  hitByPulse(): boolean {
    if (!this.alive || !(this.mode === 'rest' || this.mode === 'warn' && this.timer <= .55)) return false;
    this.health = Math.max(0, this.health - 1);
    this.mode = 'wake'; this.timer = .9; this.bodyRef.setVelocity(0, 0); this.hideWarning();
    this.setTint(0xffe69d);
    this.scene.time.delayedCall(180, () => { if (this.active) this.clearTint(); });
    if (this.health === 0) {
      this.alive = false; this.hideWarning(); this.label.setVisible(false); this.bodyRef.enable = false;
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 800, onComplete: () => this.destroy() });
    }
    return true;
  }

  private hideWarning(): void { this.ring.setVisible(false).setFillStyle(0xe96850, .16); this.corridor.clear(); this.label.setVisible(false); }
  destroy(fromScene?: boolean): void {
    this.ring?.destroy(); this.corridor?.destroy(); this.label?.destroy(); super.destroy(fromScene);
  }
}

function pointSegmentDistance(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(1, dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
