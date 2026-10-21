import Phaser from 'phaser';

export class Player extends Phaser.Physics.Arcade.Sprite {
  health = 5;
  maxHealth = 5;
  invulnerable = 0;
  dashCooldown = 0;
  lampCooldown = 0;
  isDashing = false;
  private dashTime = 0;
  private dashDirection = { x: 1, y: 0 };
  private flashTime = 0;
  private audioPulse = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'hero');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(20);
    this.setCollideWorldBounds(true, .2, .2);
    const body = this.body as Phaser.Physics.Arcade.Body;
    // Match the visible Three.js body and lantern footprint so the model cannot visibly enter a wall.
    body.setSize(64, 54).setOffset(-9, 14);
    body.setMaxVelocity(460, 460);
  }

  updateTimers(deltaSeconds: number): void {
    this.invulnerable = Math.max(0, this.invulnerable - deltaSeconds);
    this.dashCooldown = Math.max(0, this.dashCooldown - deltaSeconds);
    this.lampCooldown = Math.max(0, this.lampCooldown - deltaSeconds);
    this.dashTime = Math.max(0, this.dashTime - deltaSeconds);
    this.flashTime += deltaSeconds;
    this.isDashing = this.dashTime > 0;
    this.setAlpha(this.invulnerable > 0 && Math.floor(this.flashTime * 15) % 2 === 0 ? .46 : 1);
  }

  move(x: number, y: number, deltaSeconds: number, dashPressed: boolean): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) { x /= magnitude; y /= magnitude; }
    if (dashPressed && this.dashCooldown <= 0) {
      const length = Math.max(Math.hypot(x, y), .001);
      const dx = magnitude > .1 ? x / length : (this.flipX ? -1 : 1);
      const dy = magnitude > .1 ? y / length : 0;
      this.dashDirection = { x: dx, y: dy };
      body.setVelocity(dx * 420, dy * 420);
      this.dashTime = .18; this.isDashing = true; this.dashCooldown = .8; this.invulnerable = Math.max(this.invulnerable, .22);
      return;
    }
    if (this.isDashing) {
      body.setVelocity(this.dashDirection.x * 420, this.dashDirection.y * 420);
      return;
    }
    body.setVelocity(x * 158, y * 158);
    if (Math.abs(x) > .1) this.flipX = x < 0;
    if (this.isDashing) return;
    this.setAngle(Math.sin(this.scene.time.now / 190) * Math.min(3, magnitude * 3));
    void deltaSeconds;
  }

  takeDamage(amount = 1): boolean {
    if (this.invulnerable > 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.invulnerable = 1.15;
    const settings = this.scene.registry.get('settingsManager') as { value?: { screenShake?: boolean; reduceMotion?: boolean } } | undefined;
    if (settings?.value?.screenShake !== false && settings?.value?.reduceMotion !== true) {
      this.scene.cameras.main.shake(120, .004);
    }
    this.audioPulse += 1;
    return true;
  }

  heal(amount = 1): void { this.health = Math.min(this.maxHealth, this.health + amount); }
}
