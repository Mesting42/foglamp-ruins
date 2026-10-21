import Phaser from 'phaser';
import type { Player } from './Player';

export type EnemyType = 'moth' | 'wisp' | 'sentinel';
type BrainState = 'idle' | 'alert' | 'windup' | 'cooldown' | 'stunned';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  readonly type: EnemyType;
  readonly label: string;
  readonly home: Phaser.Math.Vector2;
  health = 2;
  alive = true;
  private brain: BrainState = 'idle';
  private timer = 0;
  private stunTime = 0;
  private warning: Phaser.GameObjects.Arc;
  private bodyRef: Phaser.Physics.Arcade.Body;
  private readonly speed: number;
  private readonly alertRange: number;
  private readonly attackRange: number;
  private visualTint: number | null = null;
  private warningVisible = false;
  private target = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, x: number, y: number, type: EnemyType, label: string) {
    super(scene, x, y, 'enemy-' + type);
    this.type = type; this.label = label; this.home = new Phaser.Math.Vector2(x, y);
    this.speed = type === 'moth' ? 118 : type === 'wisp' ? 78 : 64;
    this.alertRange = type === 'sentinel' ? 250 : 190;
    this.attackRange = type === 'wisp' ? 300 : type === 'sentinel' ? 76 : 54;
    scene.add.existing(this); scene.physics.add.existing(this);
    const highResolutionModel = this.frame.width >= 128;
    this.setDepth(14);
    if (highResolutionModel) this.setDisplaySize(64 * 1.32, 64 * 1.32);
    else this.setScale(1.32);
    this.bodyRef = this.body as Phaser.Physics.Arcade.Body;
    const collisionScale = highResolutionModel ? 2 : 1;
    this.bodyRef.setCircle((type === 'sentinel' ? 19 : 15) * collisionScale).setOffset(8 * collisionScale, 8 * collisionScale);
    this.warning = scene.add.circle(x, y, this.damageRadius, 0xe35449, .14).setStrokeStyle(3, 0xf07057, .9).setDepth(15);
    this.health = type === 'sentinel' ? 3 : 2;
    this.warning.setVisible(false);
  }

  updateBrain(player: Player, dt: number): boolean {
    if (!this.alive) return false;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    this.timer = Math.max(0, this.timer - dt);
    this.stunTime = Math.max(0, this.stunTime - dt);
    if (this.stunTime > 0) {
      this.brain = 'stunned';
      const drag = Math.exp(-dt * 18);
      this.bodyRef.setVelocity(this.bodyRef.velocity.x * drag, this.bodyRef.velocity.y * drag);
      this.applyTint(0x8ed5d0); this.setWarningVisible(false); return false;
    }
    this.clearVisualTint();
    if (distance <= this.alertRange) this.brain = this.brain === 'windup' || this.brain === 'cooldown' ? this.brain : 'alert';
    if (this.brain === 'windup') {
      this.bodyRef.setVelocity(0, 0);
      this.setWarningVisible(true);
      this.warning.setPosition(this.target.x, this.target.y).setAlpha(.55 + Math.sin(this.scene.time.now / 90) * .2);
      if (this.timer <= 0) {
        this.brain = 'cooldown'; this.timer = this.type === 'sentinel' ? 1.35 : 1.05;
        this.setWarningVisible(false);
        if (Phaser.Math.Distance.Between(player.x, player.y, this.target.x, this.target.y) <= this.damageRadius) {
          const hit = player.takeDamage(1);
          if (hit) {
            const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            (player.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(angle) * 220, Math.sin(angle) * 220);
          }
          return hit;
        }
      }
      return false;
    }
    this.setWarningVisible(false);
    if ((this.brain === 'idle' && distance > this.alertRange) || distance > this.alertRange * 1.5) {
      this.brain = 'idle';
      const homeDistance = Phaser.Math.Distance.Between(this.x, this.y, this.home.x, this.home.y);
      if (homeDistance > 8) {
        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.home.x, this.home.y);
        this.bodyRef.setVelocity(Math.cos(angle) * this.speed * .55, Math.sin(angle) * this.speed * .55);
      }
      else this.bodyRef.setVelocity(0, 0);
      return false;
    }
    if (distance <= this.attackRange && this.brain !== 'cooldown') {
      this.brain = 'windup'; this.timer = this.type === 'wisp' ? 1.1 : this.type === 'sentinel' ? .95 : .75;
      this.target = this.type === 'wisp' ? { x: player.x, y: player.y } : { x: this.x, y: this.y };
      this.warning.setPosition(this.target.x, this.target.y).setRadius(this.damageRadius);
      this.setWarningVisible(true);
      return false;
    }
    if (this.brain === 'cooldown') {
      if (this.timer <= 0) this.brain = 'alert';
      else { this.bodyRef.setVelocity(0, 0); return false; }
    }
    const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    if (this.type === 'wisp' && distance < this.attackRange) {
      this.bodyRef.setVelocity(-Math.cos(angle) * this.speed * .48, -Math.sin(angle) * this.speed * .48);
    } else {
      this.bodyRef.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
    }
    this.rotation = Math.sin(this.scene.time.now / 130) * .08;
    return false;
  }

  private get damageRadius(): number { return this.type === 'wisp' ? 58 : this.type === 'sentinel' ? 76 : 54; }

  retreat(): void {
    if (!this.alive) return;
    this.brain = 'idle'; this.timer = 0; this.setWarningVisible(false);
    const distance = Phaser.Math.Distance.Between(this.x, this.y, this.home.x, this.home.y);
    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.home.x, this.home.y);
    this.bodyRef.setVelocity(distance > 8 ? Math.cos(angle) * this.speed * .55 : 0, distance > 8 ? Math.sin(angle) * this.speed * .55 : 0);
  }

  hitByPulse(source?: { x: number; y: number }): void {
    if (!this.alive) return;
    this.health -= 1;
    this.stunTime = this.type === 'sentinel' ? .45 : .7;
    this.brain = 'stunned'; this.timer = 0; this.setWarningVisible(false);
    if (source) {
      const angle = Phaser.Math.Angle.Between(source.x, source.y, this.x, this.y);
      this.bodyRef.setVelocity(Math.cos(angle) * 160, Math.sin(angle) * 160);
    }
    this.applyTint(0xd4f3d5);
    if (this.health <= 0) {
      this.alive = false; this.bodyRef.stop(); this.bodyRef.enable = false;
      this.warning.destroy();
      this.scene.tweens.add({ targets: this, alpha: 0, scale: .25, duration: 300, onComplete: () => this.destroy() });
    }
  }

  destroy(fromScene?: boolean): void {
    if (this.warning?.active) this.warning.destroy();
    super.destroy(fromScene);
  }

  private applyTint(color: number): void {
    if (this.visualTint === color) return;
    this.visualTint = color;
    this.setTint(color);
  }

  private clearVisualTint(): void {
    if (this.visualTint === null) return;
    this.visualTint = null;
    this.clearTint();
  }

  private setWarningVisible(visible: boolean): void {
    if (this.warningVisible === visible) return;
    this.warningVisible = visible;
    this.warning.setVisible(visible);
  }
}
