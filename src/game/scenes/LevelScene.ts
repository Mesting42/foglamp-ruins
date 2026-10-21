import Phaser from 'phaser';
import { Boss } from '../entities/Boss';
import { Enemy } from '../entities/Enemy';
import { Interactable } from '../entities/Interactable';
import type { Player } from '../entities/Player';
import { Player as PlayerEntity } from '../entities/Player';
import type { LevelDefinition } from '../data/types';
import { LEVELS } from '../data/levels';
import { BEACONS, FRAGMENT_STORIES, MEMORIES } from '../data/adventure';
import { WorldFeedback } from '../systems/WorldFeedback';
import { GameUI } from '../ui/GameUI';
import { InputManager } from '../systems/InputManager';
import { TouchControls } from '../systems/TouchControls';
import { syncDeviceLayout, usesTouchLayout } from '../systems/DeviceLayout';
import { PerformanceManager } from '../systems/PerformanceManager';
import { AudioManager } from '../systems/AudioManager';
import { CharacterModel3D } from '../systems/CharacterModel3D';
import { ThreeWorldView } from '../systems/ThreeWorldView';
import { buildWorldLayout, type WorldLayout } from '../systems/WorldLayout';
import type { SaveManager } from '../systems/SaveManager';
import type { SettingsManager } from '../systems/SettingsManager';

interface GateState {
  x: number;
  opened: boolean;
  pieces: Phaser.GameObjects.Rectangle[];
}

interface PickupVisual {
  id: string;
  x: number;
  y: number;
  fragment: boolean;
  shape: Phaser.GameObjects.Container;
  collected: boolean;
}

export class LevelScene extends Phaser.Scene {
  private level!: LevelDefinition;
  private levelIndex = 0;
  private player!: Player;
  private ui!: GameUI;
  private inputManager!: InputManager;
  private touch!: TouchControls;
  private settings!: SettingsManager;
  private save!: SaveManager;
  private audio!: AudioManager;
  private interactables: Interactable[] = [];
  private enemies: Enemy[] = [];
  private pickups: PickupVisual[] = [];
  private gates: GateState[] = [];
  private staticRects: Phaser.GameObjects.Rectangle[] = [];
  private fogPuffs: Phaser.GameObjects.Arc[] = [];
  private lampHalo!: Phaser.GameObjects.Image;
  private boss?: Boss;
  private platform?: Phaser.GameObjects.Container;
  private chaseMarker?: Phaser.GameObjects.Container;
  private chaseElapsed = 0;
  private chaseStarted = false;
  private runeStep = 0;
  private valves = new Set<string>();
  private timedDoorRemaining = 0;
  private checkpoints = new Set<string>();
  private collectedWick = false;
  private stageFinished = false;
  private lastLamp = false;
  private lastInteract = false;
  private lastDash = false;
  private hudTimer = 0;
  private elapsed = 0;
  private pulseCooldown = 0;
  private pauseOpen = false;
  private bossDefeated = false;
  private playerShadow?: Phaser.GameObjects.Ellipse;
  private enemyShadows: Phaser.GameObjects.Ellipse[] = [];
  private unsubscribeSettings?: () => void;
  private heroModel?: CharacterModel3D;
  private worldView?: ThreeWorldView;
  private worldLayout!: WorldLayout;
  private groundTextureKeys: string[] = [];
  private fogVisualTimer = 0;
  private tutorialStep = -1;
  private tutorialStart = { x: 0, y: 0 };
  private tutorialActions = { moved: false, dashed: false, lamp: false };
  private feedback!: WorldFeedback;
  private worldFlags = new Set<string>();
  private discovered = new Set<string>();
  private pulseCount = 0;
  private recordedSeconds = 0;
  private recordedPulses = 0;
  private riding = false;
  private lastHealth = 5;
  private completionRecorded = false;
  private fromCheckpoint = false;
  private secretHints: Phaser.GameObjects.Text[] = [];
  private hazard?: Phaser.GameObjects.Arc;
  private hazardTimer = 2;
  private hazardPoint = { x: 0, y: 0 };

  constructor() { super('LevelScene'); }

  create(data: { index?: number; checkpoint?: boolean }): void {
    this.interactables.length = 0; this.enemies.length = 0; this.pickups.length = 0;
    this.gates.length = 0; this.staticRects.length = 0; this.fogPuffs.length = 0;
    const settingsManager = this.registry.get('settingsManager') as SettingsManager;
    this.settings = settingsManager;
    this.save = this.registry.get('saveManager') as SaveManager;
    this.audio = this.registry.get('audioManager') as AudioManager;
    this.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, data.index ?? this.save.value.currentLevel));
    this.level = LEVELS[this.levelIndex];
    this.save.startLevel(this.levelIndex);
    this.registry.set('currentLevelIndex', this.levelIndex);
    this.elapsed = 0; this.chaseElapsed = 0; this.chaseStarted = false;
    this.runeStep = 0; this.valves.clear(); this.checkpoints.clear(); this.stageFinished = false;
    this.lastLamp = false; this.lastInteract = false; this.lastDash = false; this.pulseCooldown = 0; this.pauseOpen = false;
    this.bossDefeated = false;
    this.collectedWick = false; this.timedDoorRemaining = 0;
    this.boss = undefined; this.platform = undefined; this.chaseMarker = undefined;
    this.pulseCount = 0; this.recordedSeconds = 0; this.recordedPulses = 0;
    this.riding = false; this.lastHealth = 5; this.completionRecorded = false;
    this.secretHints = []; this.hazard = undefined; this.hazardTimer = 2;
    this.worldFlags = new Set(this.save.worldFlags(this.level.id));
    this.discovered = new Set(this.save.value.journal);
    this.feedback = new WorldFeedback(this, () => this.settings.value.reduceMotion);
    this.tutorialStep = -1;
    this.tutorialActions = { moved: false, dashed: false, lamp: false };
    PerformanceManager.applyScene(this, this.settings.value);
    this.createWorld();
    const gameRoot = document.getElementById('game-root');
    if (gameRoot) {
      this.worldView = new ThreeWorldView(gameRoot, this.level, this.worldLayout, this.settings.value.quality);
      this.interactables.forEach((item) => {
        item.setWorldRendered();
        this.worldView?.setInteractable(item.id, item.lit, item.active && item.visible);
      });
    }

    const saveState = this.save.value;
    const checkpoint = data.checkpoint && saveState.checkpointLevel === this.levelIndex ? saveState.checkpoint : saveState.checkpointLevel === this.levelIndex ? saveState.checkpoint : 'start';
    const checkpointMatch = /^cp(\d+)$/.exec(checkpoint);
    const checkpointIndex = checkpointMatch ? Number(checkpointMatch[1]) : -1;
    this.fromCheckpoint = checkpointIndex >= 0;
    const spawn = checkpointIndex >= 0 ? { x: this.level.checkpointXs[checkpointIndex] ?? this.level.start.x, y: this.level.start.y } : this.level.start;
    this.player = new PlayerEntity(this, spawn.x, spawn.y);
    this.restoreWorldProgress(checkpointIndex);
    this.player.setDepth(15);
    const shadowsEnabled = this.settings.value.shadows && this.settings.value.quality !== 'low';
    this.playerShadow = this.add.ellipse(spawn.x, spawn.y + 17, 34, 15, 0x020d12, .34).setDepth(13).setVisible(shadowsEnabled);
    this.physics.world.setBounds(64, 64, this.level.exitX + 180, this.level.mapHeight - 128);
    this.player.setCollideWorldBounds(true, .2, .2);
    this.staticRects.forEach((rect) => {
      this.physics.add.collider(this.player, rect);
    });
    this.enemies.forEach((enemy) => this.staticRects.forEach((rect) => this.physics.add.collider(enemy, rect)));

    this.physics.world.setBounds(64, 64, this.level.exitX + 180, this.level.mapHeight - 128);
    this.cameras.main.setBounds(0, 0, this.level.exitX + 180, this.level.mapHeight);
    this.cameras.main.startFollow(this.player, true, .1, .1);
    this.resizeCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeCamera, this);

    this.lampHalo = this.add.image(this.player.x, this.player.y, 'lamp-glow').setDepth(18).setScale(1.75).setAlpha(.86).setBlendMode(Phaser.BlendModes.SCREEN);
    this.touch = new TouchControls(document.getElementById('ui-root')!);
    this.ui = new GameUI(document.getElementById('ui-root')!, this.settings, this.save);
    this.mountHUD();
    this.inputManager = new InputManager(this, this.touch, this.settings.value, () => ({ x: this.player.x, y: this.player.y }));
    window.addEventListener('foglamp:layoutchange', this.syncControlLayout);
    if (gameRoot) {
      this.heroModel = new CharacterModel3D(gameRoot, this.settings.value.quality);
      if (this.heroModel.available) this.player.setVisible(false);
      else this.player.setScale(1.55);
    }
    this.applyLanternColor();
    this.unsubscribeSettings = this.settings.subscribe((settings) => {
      PerformanceManager.applyScene(this, settings);
      this.audio.setVolume(settings.volume);
      this.heroModel?.setQuality(settings.quality);
      this.worldView?.setQuality(settings.quality, settings.pixelRatio);
      const shadowsEnabled = settings.shadows && settings.quality !== 'low';
      this.playerShadow?.setVisible(shadowsEnabled);
      this.enemyShadows.forEach((shadow, index) => shadow.setVisible(shadowsEnabled && !!this.enemies[index]?.active && !!this.enemies[index]?.alive));
      if (!this.scene.isPaused()) this.touch.mount(settings, { pause: () => this.pauseGame() });
      this.renderTutorialStep();
    });
    this.enemyShadows = this.enemies.map((enemy) => this.add.ellipse(enemy.x, enemy.y + 16, 30, 13, 0x020d12, .3).setDepth(13).setVisible(shadowsEnabled && enemy.active && enemy.alive));

    if (this.level.chase) {
      this.createChaser();
      this.hazard = this.add.circle(0, 0, 62, 0xe96850, .2).setStrokeStyle(3, 0xff9574, .9).setDepth(18).setVisible(false);
    }
    if (this.level.boss) {
      this.boss = new Boss(this, this.level.exitX - 500, this.level.mapHeight / 2);
      this.boss.setVisible(false);
      (this.boss.body as Phaser.Physics.Arcade.Body).enable = false;
      this.staticRects.forEach((rect) => this.physics.add.collider(this.boss!, rect));
    }
    if (this.levelIndex !== 0 || this.save.value.tutorialComplete) this.ui.showToast(this.level.puzzleHint, 4600);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.on(Phaser.Scenes.Events.RESUME, this.resumeControls, this);
  }

  update(_time: number, delta: number): void {
    if (!this.player?.active || this.stageFinished) return;
    const dt = Math.min(delta / 1000, .05);
    this.elapsed += dt; this.hudTimer += dt; this.pulseCooldown = Math.max(0, this.pulseCooldown - dt);
    this.feedback.update(dt);
    if (this.elapsed - this.recordedSeconds >= 15) this.recordJourney();
    this.fogVisualTimer += dt;
    this.player.updateTimers(dt);
    const frame = this.inputManager.getFrame();
    const lamp = frame.lampPressed && !this.lastLamp;
    const interact = frame.interactPressed && !this.lastInteract;
    const dash = frame.dashPressed && !this.lastDash;
    this.lastLamp = frame.lampPressed; this.lastInteract = frame.interactPressed; this.lastDash = frame.dashPressed;

    if (frame.pausePressed) { this.pauseGame(); return; }
    if (lamp && !this.riding) this.useLamp();
    const nearby = this.findNearestInteractable();
    const interactLabel = this.touch.enabled ? '触碰「互动」' : this.settings.value.keyBindings.interact + ' / 互动';
    this.ui.showPrompt(nearby ? interactLabel + '：' + nearby.label : undefined);
    if (interact && nearby && !this.riding) { this.activate(nearby); this.inputManager.clearTarget(); }
    if (frame.target && nearby && !this.riding && Phaser.Math.Distance.Between(frame.target.x, frame.target.y, nearby.x, nearby.y) < 90) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, nearby.x, nearby.y) < 66) {
        this.activate(nearby); this.inputManager.clearTarget();
      }
    }

    let moveX = frame.x, moveY = frame.y;
    if (this.level.id === 'sunken-ruins' && this.valves.size < 2 && this.player.x > 1070 && this.player.x < 1390) {
      moveX *= .54; moveY *= .54;
    }
    if (this.shouldStartChase()) this.chaseStarted = true;
    const dashAvailable = dash && this.player.dashCooldown <= 0;
    if (!this.riding) this.player.move(moveX, moveY, dt, dash);
    this.ui.updateAbility(this.pulseCooldown / 1.1, this.player.dashCooldown / .8);
    if (this.tutorialStep >= 0 && (dashAvailable || this.player.dashCooldown > .45)) this.tutorialActions.dashed = true;
    if (this.tutorialStep >= 0 && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.tutorialStart.x, this.tutorialStart.y) >= 110) {
      this.tutorialActions.moved = true;
    }
    this.syncTutorialProgress();
    this.playerShadow?.setPosition(this.player.x, this.player.y + 17);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const camera = this.cameras.main;
    this.heroModel?.update({
      x: this.player.x, y: this.player.y, cameraX: camera.worldView.x, cameraY: camera.worldView.y,
      zoom: camera.zoom, facingLeft: this.player.flipX,
      speed: Math.hypot(playerBody.velocity.x, playerBody.velocity.y), dashing: this.player.isDashing,
      alpha: this.player.alpha,
      delta: dt,
    });
    this.worldView?.update(camera, this.settings.value);
    const shadowsEnabled = this.settings.value.shadows && this.settings.value.quality !== 'low';
    this.enemies.forEach((enemy, index) => {
      const shadow = this.enemyShadows[index];
      if (shadow) {
        shadow.setPosition(enemy.x, enemy.y + 16);
        const shouldShowShadow = shadowsEnabled && enemy.active && enemy.alive;
        if (shadow.visible !== shouldShowShadow) shadow.setVisible(shouldShowShadow);
      }
      if (!enemy.active || !enemy.alive) return;
      if (this.isMineRestZone()) enemy.retreat();
      else enemy.updateBrain(this.player, dt);
    });
    this.interactables.forEach((object) => { if (object.active) object.updateVisual(dt); });
    this.interactables.forEach((object) => this.worldView?.setInteractable(object.id, object.lit, object.active && object.visible));
    if (this.platform) this.worldView?.setPlatform(this.platform.x, this.platform.y, this.platform.alpha);
    if (this.fogVisualTimer >= 1 / 30) {
      this.fogVisualTimer %= 1 / 30;
      const view = camera.worldView;
      const margin = 180;
      const viewRight = view.x + view.width;
      const viewBottom = view.y + view.height;
      this.fogPuffs.forEach((fog, index) => {
        if (!fog.active || fog.x < view.x - margin || fog.x > viewRight + margin || fog.y < view.y - margin || fog.y > viewBottom + margin) return;
        fog.setAlpha(.035 + Math.sin(this.elapsed * .7 + index) * .018);
      });
    }
    this.updatePickups(dt);
    this.updateCheckpoints();
    this.updateTimedDoor(dt);
    this.updateBoss(dt);
    this.updateChase(dt);
    if (this.player.health < this.lastHealth) { this.audio.play('hit'); this.feedback.ring(this.player.x, this.player.y, 0xf47d68, 45); }
    this.lastHealth = this.player.health;
    this.lampHalo.setPosition(this.player.x, this.player.y).setScale(1.65 + Math.sin(this.elapsed * 1.8) * .04).setAlpha(this.pulseCooldown > .15 ? .45 : .86);
    if (this.hudTimer >= .14) { this.hudTimer = 0; this.refreshHUD(); }
    if (this.player.health <= 0) this.gameOver();
    if (this.player.x > this.level.exitX - 70 && this.player.x < this.level.exitX + 180) this.tryExit();
  }

  restoreHUD(): void {
    this.mountHUD();
  }

  private createWorld(): void {
    const worldWidth = this.level.exitX + 180;
    const height = this.level.mapHeight;
    this.worldLayout = buildWorldLayout(this.level, this.levelIndex);
    this.worldLayout.solids.forEach((solid) => this.addStaticRect(solid.x, solid.y, solid.width, solid.height, this.level.palette.wall));
    this.createGates();
    this.createInteractables();
    this.interactables.forEach((item) => {
      if (item.kind !== 'platform' && (!MEMORIES.some(m => m.id === item.id) || item.visible)) this.addStaticRect(item.x, item.y, item.kind === 'npc' ? 34 : 38, item.kind === 'npc' ? 30 : 32, this.level.palette.wall);
    });
    this.createPickups();
    this.createEnemies();
    this.createWaterAndPlatform();
  }

  /** Bake static floor detail into small textures so WebGL does not rebuild hundreds of Graphics shapes each frame. */
  private createGroundTextures(worldWidth: number, height: number, random: (seed: number) => number): void {
    const theme = this.level.palette;
    const chunkWidth = 2072; // 28 floor tiles; keeps every texture within mobile GPU limits.
    const trailColor = this.level.id === 'mist-grassland' ? 0xd7c382 : theme.accent;
    const grass = this.level.id === 'mist-grassland';
    const leafColors = [0xaac780, 0x8fb77a, 0xc8c477];

    for (let chunkIndex = 0, offsetX = 0; offsetX < worldWidth; chunkIndex++, offsetX += chunkWidth) {
      const width = Math.min(chunkWidth, worldWidth - offsetX);
      const detail = this.add.graphics();

      for (let worldX = 72; worldX < worldWidth - 72; worldX += 74) {
        if (worldX + 70 <= offsetX || worldX >= offsetX + width) continue;
        const x = worldX - offsetX;
        for (let y = 72; y < height - 72; y += 74) {
          const color = (Math.floor(worldX / 74) + Math.floor(y / 74)) % 2 === 0 ? theme.floor : theme.wall;
          const alpha = .075 + ((Math.floor(worldX / 74 * 7) + Math.floor(y / 74 * 11)) % 5) * .012;
          detail.fillStyle(color, alpha); detail.fillRoundedRect(x + 4, y + 4, 66, 66, 8);
          if ((Math.floor(worldX / 74) + Math.floor(y / 74)) % 5 === 0) {
            detail.lineStyle(1, theme.accent, .08); detail.lineBetween(x + 12, y + 58, x + 25, y + 58);
          }
        }
      }

      detail.lineStyle(5, theme.accent, .12); detail.strokeRect(48 - offsetX, 48, worldWidth - 96, height - 96);
      detail.lineStyle(1, 0xc4e4d4, .11);
      for (let x = 210; x < worldWidth; x += 300) {
        if (x + 12 < offsetX || x - 12 > offsetX + width) continue;
        const localX = x - offsetX;
        detail.lineBetween(localX, 64, localX, 150); detail.lineBetween(localX, height - 150, localX, height - 64);
        detail.strokeCircle(localX, 104, 9); detail.strokeCircle(localX, height - 104, 9);
      }

      for (let segment = 0, worldX = 78; worldX < worldWidth - 78; segment++, worldX += 94) {
        const centerY = height / 2 + Math.sin(worldX * .004 + this.levelIndex) * 18;
        const pathWidth = 58 + random(segment + 610) * 48;
        if (worldX + pathWidth < offsetX || worldX > offsetX + width) continue;
        const x = worldX - offsetX;
        detail.fillStyle(trailColor, .075 + random(segment + 660) * .045);
        detail.fillRoundedRect(x, centerY - 20 + (random(segment + 710) - .5) * 12, pathWidth, 40, 12);
        if (segment % 3 === 0) {
          detail.lineStyle(2, theme.accent, .14);
          detail.lineBetween(x + 12, centerY, x + pathWidth - 13, centerY + 2);
        }
      }

      if (grass) {
        const patchCount = Math.floor(worldWidth / 48);
        for (let index = 0; index < patchCount; index++) {
          const worldX = 104 + index * 47 + random(index + 2000) * 26;
          if (worldX + 16 < offsetX || worldX - 12 > offsetX + width) continue;
          const x = worldX - offsetX;
          const upper = index % 2 === 0;
          const y = upper
            ? 118 + random(index + 2070) * Math.max(30, height / 2 - 270)
            : height / 2 + 150 + random(index + 2070) * Math.max(30, height / 2 - 270);
          detail.lineStyle(2.6, leafColors[index % leafColors.length], .43);
          for (let blade = 0; blade < 4; blade++) {
            const offset = blade * 4 - 6;
            detail.lineBetween(x + offset, y + 8, x + offset + (blade % 2 ? 4 : -5), y - 5 - random(index + blade + 2130) * 18);
          }
          if (index % 4 === 0) {
            detail.fillStyle(index % 8 === 0 ? 0xf0cc72 : 0xe9e0a4, .7);
            detail.fillCircle(x + 9, y - 7, 2.6);
          }
        }
      }

      const key = `ground-${this.level.id}-${chunkIndex}`;
      detail.generateTexture(key, width, height);
      detail.destroy();
      this.groundTextureKeys.push(key);
      this.add.image(offsetX, 0, key).setOrigin(0).setDepth(-19);
    }
  }

  private createBiomeDecorations(worldWidth: number, height: number, random: (seed: number) => number): void {
    const g = this.level.id === 'sunken-ruins' ? this.add.graphics().setDepth(3) : undefined;
    const forest = this.level.id === 'echo-forest';
    const mine = this.level.id === 'old-mine';
    const core = this.level.id === 'lighthouse-core';
    const grass = this.level.id === 'mist-grassland';
    const landmarkCount = Math.floor(worldWidth / 430);
    for (let index = 0; index < landmarkCount; index++) {
      const x = 210 + index * 430 + random(index + 1200) * 110;
      const upper = index % 2 === 0;
      const y = upper ? height / 2 - 190 + random(index + 1340) * 70 : height / 2 + 190 + random(index + 1340) * 70;
      if (forest) {
        const trunk = this.add.rectangle(x, y + 31, 20, 108, 0x563f31, .92).setStrokeStyle(2, 0x182a26, .56).setDepth(4);
        trunk.setRotation((random(index + 1370) - .5) * .12);
        const canopy = this.add.container(x, y - 10).setDepth(5);
        const greens = [0x326c4b, 0x3c8057, 0x4b9060];
        for (let leaf = 0; leaf < 5; leaf++) {
          const offsetX = (random(index * 9 + leaf + 1410) - .5) * 70;
          const offsetY = (random(index * 7 + leaf + 1510) - .5) * 44;
          const crown = this.add.ellipse(offsetX, offsetY, 60 + random(index + leaf + 1610) * 34, 48 + random(leaf + 1710) * 26, greens[leaf % greens.length], .76).setStrokeStyle(2, 0x8dce98, .24);
          canopy.add(crown);
        }
        canopy.add(this.add.circle(10, -18, 4, 0xd6e7a0, .68));
      } else if (mine) {
        const beamColor = 0x79543b;
        const beam = this.add.graphics().setDepth(4);
        beam.lineStyle(13, beamColor, .95); beam.lineBetween(x - 52, y - 50, x - 42, y + 72);
        beam.lineBetween(x + 52, y - 50, x + 42, y + 72); beam.lineBetween(x - 61, y - 40, x + 61, y - 40);
        beam.lineStyle(3, 0xd69b5c, .52); beam.lineBetween(x - 52, y - 50, x - 42, y + 72); beam.lineBetween(x + 52, y - 50, x + 42, y + 72);
      } else if (core) {
        const pillar = this.add.container(x, y).setDepth(4);
        const base = this.add.rectangle(0, 20, 44, 108, 0x514436, .94).setStrokeStyle(3, this.level.palette.accent, .48);
        const cap = this.add.rectangle(0, -36, 64, 16, this.level.palette.accent, .82).setStrokeStyle(2, 0xffe6a6, .72);
        const eye = this.add.circle(0, -4, 8, 0xffcf66, .92).setStrokeStyle(4, 0xffdf8f, .24);
        pillar.add([base, cap, eye]);
      } else if (grass) {
        const tuft = this.add.graphics().setDepth(4);
        const color = index % 2 === 0 ? 0xa3ba70 : 0x76a967;
        for (let blade = 0; blade < 7; blade++) {
          const offset = (blade - 3) * 5;
          tuft.lineStyle(3, color, .72);
          tuft.lineBetween(x + offset, y + 26, x + offset + (blade % 2 ? 8 : -7), y - 8 - random(index + blade + 1810) * 35);
        }
        this.add.circle(x, y + 24, 24, 0x203d32, .3).setDepth(3);
      } else {
        if (!g) continue;
        g.lineStyle(8, 0x6daab0, .28);
        g.strokeCircle(x, y, 58); g.strokeCircle(x, y, 38);
        g.lineStyle(3, 0x9be1dc, .48); g.lineBetween(x - 54, y + 14, x - 22, y - 12); g.lineBetween(x - 22, y - 12, x + 6, y + 6); g.lineBetween(x + 6, y + 6, x + 46, y - 26);
      }
    }
  }

  private createGates(): void {
    this.level.gateXs.forEach((x, index) => {
      const centerY = this.level.mapHeight / 2;
      // Shared masonry seals the flanks; this 72×200 body is only the central doorway.
      const barrier = this.add.rectangle(x, centerY, 72, 200, this.level.palette.wall, 0).setDepth(8);
      this.staticize(barrier);
      this.gates.push({ x, opened: false, pieces: [barrier] });
      if (index > 0) {
        const control = new Interactable(this, {
          id: 'gate-control-' + index, x: x - 128, y: centerY + 145,
          kind: 'switch', label: index === 1 ? '次级石门闸' : '出口石门闸',
        });
        this.interactables.push(control);
      }
    });
  }

  private createInteractables(): void {
    this.level.interactables.forEach((spec) => this.interactables.push(new Interactable(this, spec)));
    MEMORIES.filter(m => m.level === this.levelIndex).forEach(memory => {
      const item = new Interactable(this, { ...memory, kind: 'rune', label: '阅读遗迹记忆：' + memory.title });
      item.setVisible(this.discovered.has(memory.id) || this.worldFlags.has('revealed-' + memory.id));
      item.setLit(this.discovered.has(memory.id)); this.interactables.push(item);
      const hint = this.add.text(memory.x, memory.y - 56, '◇ 回声 · 用雾灯照见', { fontFamily: 'sans-serif', fontSize: '13px', color: '#bce5db', backgroundColor: '#123238', padding: { x: 8, y: 5 } }).setOrigin(.5).setDepth(11);
      this.secretHints.push(hint);
    });
  }

  private createPickups(): void {
    this.level.collectibles.forEach((spec) => {
      const collected = this.save.hasCollected(spec.id);
      const fragment = spec.kind === 'fragment';
      const container = this.add.container(spec.x, spec.y).setDepth(11);
      const color = fragment ? 0xf0bd66 : 0x82c8b5;
      const halo = this.add.circle(0, 0, fragment ? 26 : 21, color, .09).setStrokeStyle(1, color, .55);
      container.add(halo);
      const modelKey = fragment ? 'three-pickup-fragment' : 'three-pickup-shard';
      if (this.textures.exists(modelKey)) {
        container.add(this.add.image(0, 0, modelKey).setDisplaySize(fragment ? 40 : 34, fragment ? 46 : 40));
      } else {
        const core = this.add.graphics();
        core.lineStyle(3, color, 1); core.fillStyle(color, .22);
        if (fragment) {
          core.fillCircle(0, 0, 12); core.strokeCircle(0, 0, 12); core.lineBetween(0, -19, 0, 19); core.lineBetween(-14, -12, 14, 12);
        } else {
          core.fillCircle(0, 0, 9); core.strokeCircle(0, 0, 14); core.strokeCircle(0, 0, 5);
        }
        container.add(core);
      }
      if (collected) container.setVisible(false);
      this.pickups.push({ id: spec.id, x: spec.x, y: spec.y, fragment, shape: container, collected });
    });
  }

  private createEnemies(): void {
    this.level.enemies.forEach((spec) => {
      const enemy = new Enemy(this, spec.x, spec.y, spec.type, spec.label);
      this.enemies.push(enemy);
    });
  }

  private createWaterAndPlatform(): void {
    if (this.level.id !== 'sunken-ruins') return;
    this.addStaticRect(2320, this.level.mapHeight / 2, 280, this.level.mapHeight - 192, this.level.palette.wall);
    const platform = this.add.container(2130, 640).setDepth(9).setAlpha(0).setVisible(false);
    this.platform = platform;
    if (this.textures.exists('three-platform')) {
      platform.add(this.add.image(0, 0, 'three-platform').setDisplaySize(168, 132));
    } else {
      platform.add([
        this.add.rectangle(0, 0, 168, 132, 0x5a8790, .8).setStrokeStyle(3, 0xa7e1dc, .7),
        this.add.text(0, 0, '浮台', { fontFamily: 'sans-serif', fontSize: '14px', color: '#e7f5e7' }).setOrigin(.5),
      ]);
    }
  }

  private createChaser(): void {
    const chaseMarker = this.add.container(0, this.level.mapHeight / 2).setDepth(21).setVisible(false);
    this.chaseMarker = chaseMarker;
    if (this.textures.exists('three-chaser-rock')) {
      chaseMarker.add(this.add.image(0, 0, 'three-chaser-rock').setDisplaySize(88, 88));
    } else {
      const rock = this.add.circle(0, 0, 44, 0x9b5945, .95).setStrokeStyle(4, 0xd5905a, .8);
      const crack = this.add.graphics(); crack.lineStyle(4, 0x261f1d, .85); crack.lineBetween(-22, -12, -4, 5); crack.lineBetween(-4, 5, -13, 24); crack.lineBetween(-4, 5, 20, -17);
      const eye = this.add.circle(12, -6, 7, 0xe99c5a, .9);
      chaseMarker.add([rock, crack, eye]);
    }
  }

  private createEnemiesAndMore(): void { /* Intentionally empty: stage entities are built by focused methods above. */ }

  private addStaticRect(x: number, y: number, width: number, height: number, color: number): Phaser.GameObjects.Rectangle {
    const rect = this.add.rectangle(x, y, width, height, color, 0).setDepth(6).setVisible(false);
    this.staticize(rect);
    return rect;
  }

  private staticize(rect: Phaser.GameObjects.Rectangle): void {
    this.physics.add.existing(rect, true);
    const body = rect.body as Phaser.Physics.Arcade.StaticBody;
    body.updateFromGameObject();
    this.staticRects.push(rect);
  }

  private drawExit(x: number, y: number): void {
    const gate = this.add.container(x, y).setDepth(9);
    if (this.textures.exists('three-exit')) {
      gate.add(this.add.image(0, 0, 'three-exit').setDisplaySize(112, 216));
    } else {
      const arch = this.add.graphics();
      arch.lineStyle(8, this.level.palette.accent, .62); arch.strokeRoundedRect(-40, -100, 80, 200, 38);
      arch.fillStyle(0x071820, .88); arch.fillEllipse(0, 0, 58, 148);
      arch.lineStyle(2, 0xb3e0d1, .45); arch.strokeEllipse(0, 0, 44, 130);
      gate.add(arch);
    }
    const label = this.add.text(0, 122, '出口', { fontFamily: 'sans-serif', fontSize: '14px', color: '#e5d4a4' }).setOrigin(.5);
    gate.add(label);
    this.tweens.add({ targets: gate, alpha: .72, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private resizeCamera = (): void => {
    syncDeviceLayout();
    const view = this.scale.gameSize;
    const baseZoom = Math.min(view.width / 720, view.height / 540);
    const portraitFill = view.height > view.width ? view.height / this.level.mapHeight : baseZoom;
    const zoom = Phaser.Math.Clamp(Math.max(baseZoom, portraitFill), .52, 2.2);
    const camera = this.cameras.main;
    camera.setZoom(zoom);
    // Rotation changes the camera viewport; snap before resuming its normal follow easing.
    if (this.player?.active) {
      camera.centerOn(this.player.x, this.player.y);
      camera.preRender();
    }
    this.heroModel?.resize();
    if (this.touch) {
      this.touch.reset();
      this.inputManager?.clearTarget();
      if (this.scene.isPaused() || this.pauseOpen) {
        this.touch.setSuspended(true);
        return;
      }
      this.syncControlLayout();
    }
  };

  private syncControlLayout = (): void => {
    if (!this.touch || this.scene.isPaused() || this.pauseOpen || this.stageFinished) return;
    if (usesTouchLayout() !== this.touch.enabled) {
      this.inputManager?.clearTarget();
      this.touch.mount(this.settings.value, { pause: () => this.pauseGame() });
      this.renderTutorialStep();
    }
  };

  private mountHUD(): void {
    this.ui.showHUD(this.level, {
      pause: () => this.pauseGame(), lamp: () => this.inputManager?.requestAction('lamp'),
      dash: () => this.inputManager?.requestAction('dash'), interact: () => this.inputManager?.requestAction('interact'),
      skipTutorial: () => this.skipTutorial(),
    });
    this.touch.mount(this.settings.value, { pause: () => this.pauseGame() });
    this.touch.setSuspended(this.scene.isPaused() || this.pauseOpen);
    if (this.levelIndex === 0 && !this.save.value.tutorialComplete) {
      if (this.tutorialStep < 0) {
        this.tutorialStep = 0;
        this.tutorialStart = { x: this.player.x, y: this.player.y };
      }
      this.renderTutorialStep();
    }
    this.refreshHUD();
    this.ui.updateAbility(this.pulseCooldown / 1.1, this.player.dashCooldown / .8);
  }

  private renderTutorialStep(): void {
    if (this.tutorialStep < 0 || this.levelIndex !== 0 || this.save.value.tutorialComplete) {
      this.ui?.hideTutorial();
      return;
    }
    const touch = this.touch?.enabled;
    const bindings = this.settings.value.keyBindings;
    const steps = [
      {
        title: '沿着微光前行',
        copy: touch
          ? '拖动左侧摇杆，向前走近金色的引路壁灯。'
          : '按 ' + [bindings.moveUp, bindings.moveLeft, bindings.moveDown, bindings.moveRight].join(' / ') + ' 或方向键移动，也可以点击地面前行。',
      },
      {
        title: '试试冲刺',
        copy: touch ? '点按右侧「冲刺」，快速穿过开阔地带并短暂避开伤害。' : '按 ' + tutorialKeyLabel(bindings.dash) + ' 冲刺，快速通过开阔地带并短暂避开伤害。',
      },
      {
        title: '唤醒雾灯',
        copy: touch ? '点按右侧「雾灯」释放冲击波，驱散薄雾并击退附近的雾中生物。' : '按 ' + tutorialKeyLabel(bindings.lamp) + '、鼠标右键或下方「雾灯」按钮释放冲击波，驱散薄雾并击退附近的雾中生物。',
      },
      {
        title: '点亮引路壁灯',
        copy: touch ? '走到金色壁灯旁，点按右侧「互动」打开雾门。' : '走到金色壁灯旁，按 ' + tutorialKeyLabel(bindings.interact) + ' 互动，打开雾门。',
      },
    ];
    const step = steps[this.tutorialStep];
    if (step) this.ui.showTutorialStep(this.tutorialStep, steps.length, step.title, step.copy);
  }

  private syncTutorialProgress(): void {
    if (this.tutorialStep < 0) return;
    const switchLit = this.interactables.find((item) => item.id === 'grass-switch')?.lit ?? false;
    const completed = [this.tutorialActions.moved, this.tutorialActions.dashed, this.tutorialActions.lamp, switchLit];
    while (this.tutorialStep >= 0 && completed[this.tutorialStep]) {
      if (this.tutorialStep === completed.length - 1) {
        this.tutorialStep = -1;
        this.save.completeTutorial();
        this.ui.hideTutorial();
        return;
      }
      this.tutorialStep++;
      this.renderTutorialStep();
    }
  }

  private skipTutorial(): void {
    if (this.tutorialStep < 0) return;
    this.tutorialStep = -1;
    this.save.completeTutorial();
    this.ui.hideTutorial();
    this.ui.showToast('新手引导已跳过，继续探索遗迹。');
  }

  private useLamp(): void {
    const pulseAvailable = this.pulseCooldown <= 0;
    this.pulseLamp();
    if (!pulseAvailable || this.tutorialStep < 0) return;
    this.tutorialActions.lamp = true;
    this.syncTutorialProgress();
  }

  private refreshHUD(): void {
    const remaining = this.level.chase && this.chaseStarted ? Math.max(0, 165 - this.chaseElapsed) : undefined;
    this.ui.updateHUD({
      health: this.player.health, maxHealth: this.player.maxHealth, fragments: this.save.value.fragments,
      stageIndex: this.levelIndex, objective: this.currentObjective(),
      timer: remaining === undefined ? undefined : String(Math.floor(remaining / 60)).padStart(2, '0') + ':' + String(Math.floor(remaining % 60)).padStart(2, '0'),
      bossHealth: this.boss?.visible && this.boss.alive ? this.boss.health : undefined,
      bossMaxHealth: this.boss?.visible && this.boss.alive ? this.boss.maxHealth : undefined,
      bossCue: this.boss?.visible && this.boss.alive ? '守塔者 · 第 ' + this.boss.phase + ' 阶段 · ' + this.boss.cue : undefined,
    });
  }

  private findNearestInteractable(): Interactable | undefined {
    let closest: Interactable | undefined;
    let distance = 78;
    this.interactables.forEach((item) => {
      if (!item.active || !item.visible) return;
      const next = Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y);
      if (next < distance) { distance = next; closest = item; }
    });
    return closest;
  }

  private activate(item: Interactable): void {
    if (!item.active) return;
    const id = item.id;
    if (id === 'sunken-door-reset') {
      if (this.valves.size < 2) { this.ui.showToast('先转动西岸的两处潮阀。'); return; }
      this.openGate(0); this.timedDoorRemaining = 12; item.setLit(true);
      this.ui.showToast('东岸回流闸已开启石门，12 秒内通过。'); return;
    }
    const memory = MEMORIES.find(m => m.id === id);
    if (memory) {
      const isNew = this.save.discover(id); this.discovered.add(id); item.setLit(true);
      this.ui.showToast(memory.title + '：' + memory.text + (isNew ? ' · ' + memory.reward : ''), 6500);
      if (isNew) { this.player.heal(1); this.feedback.ring(item.x, item.y, 0x8be0c9, 100); this.audio.play('pickup'); this.applyLanternColor(); }
      return;
    }
    if ((BEACONS[this.level.id] ?? []).includes(id)) {
      this.ui.showToast(item.lit ? '灯台已亮，光正沿着纹路流向石门。' : '这座灯台需要雾灯的光。靠近后释放冲击波。'); return;
    }
    if (id.startsWith('gate-control-')) {
      const index = Number(id.slice(-1));
      if (index === 1 && BEACONS[this.level.id] && !BEACONS[this.level.id].every(key => this.worldFlags.has(key))) {
        this.ui.showToast('南北两座引光台还未全部亮起。靠近灯台释放雾灯。'); return;
      }
      if (!this.gates[index - 1]?.opened) { this.ui.showToast('石门的前置机关还没有点亮。'); return; }
      this.openGate(index); this.audio.play('switch'); return;
    }
    if (item.kind === 'npc') { this.ui.showToast(this.npcLine(id)); return; }
    if (item.kind === 'chest') {
      const chestId = id + '-opened';
      if (this.save.hasCollected(chestId)) { this.ui.showToast('宝箱里只剩下苔藓和旧时的灰。'); return; }
      this.save.collect(chestId, false); this.player.heal(1); item.deactivate(); this.audio.play('pickup');
      this.ui.showToast('宝箱开启：生命恢复，古老碎片收入囊中。'); return;
    }
    if (id === 'grass-switch' || id === 'core-switch') {
      item.setLit(true); this.remember(id); this.feedback.connect(item, { x: this.gates[0].x, y: this.level.mapHeight / 2 }); this.openGate(0); this.audio.play('switch');
      this.ui.showToast(id === 'grass-switch' ? '引路壁灯亮起，前方雾门打开了。' : '外环火台燃起，通往灯塔的石门松动了。');
      return;
    }
    if (id.startsWith('forest-rune-')) {
      const sequence = ['forest-rune-2', 'forest-rune-1', 'forest-rune-3'];
      const expected = sequence[this.runeStep];
      if (id === expected) {
        item.setLit(true); this.runeStep++; this.audio.play('switch');
        if (this.runeStep === sequence.length) { this.remember('forest-sequence'); this.feedback.connect(item, { x: this.gates[0].x, y: this.level.mapHeight / 2 }); this.openGate(0); this.ui.showToast('三枚符文依序回应，林间雾门敞开。'); }
        else this.ui.showToast('符文回应了。再唤醒下一枚。', 1200);
      } else {
        this.runeStep = id === sequence[0] ? 1 : 0;
        this.interactables.filter((entry) => entry.id.startsWith('forest-rune-')).forEach((entry) => entry.setLit(entry.id === id && this.runeStep === 1));
        this.ui.showToast('回声错了拍子。回看旅途手记里的「树灵的石语」，或用雾灯照见林中的石碑。');
      }
      return;
    }
    if (id.startsWith('sunken-valve-')) {
      this.valves.add(id); this.remember(id); item.setLit(true); this.audio.play('switch');
      if (this.valves.size >= 2) {
        this.openGate(0); this.timedDoorRemaining = 24;
        this.platform?.setAlpha(1);
        if (this.platform) this.tweens.add({ targets: this.platform, x: 2130, y: 640, duration: 700, ease: 'Cubic.easeOut' });
        this.feedback.connect(item, { x: 2130, y: 640 });
        this.ui.showToast('浮台已靠西岸。前往渡口乘船，24 秒内通过石门！', 3500);
      } else this.ui.showToast('潮阀转动了。另一侧还需要一盏灯。');
      return;
    }
    if (id === 'sunken-platform') {
      if (this.valves.size < 2) { this.ui.showToast('水流太急，先转动两侧潮阀。'); return; }
      this.ridePlatform(); return;
    }
    if (id === 'mine-switch-1') {
      item.setLit(true); this.remember(id); this.openGate(0); this.audio.play('switch'); this.ui.showToast('升降闸抬起了。身后的轰鸣开始逼近！'); return;
    }
    if (id === 'mine-switch-2') {
      item.setLit(true); this.remember(id); this.openGate(1); this.audio.play('switch'); this.ui.showToast('支撑杆卡住塌方，第二道矿门打开了！'); return;
    }
    if (id.startsWith('gate-control-')) return;
    item.setLit(true); this.audio.play('switch'); this.ui.showToast(item.label + '发出微光。');
  }

  private npcLine(id: string): string {
    const lines: Record<string, string> = {
      'grass-guide': '旅人：庭院南北各有一座引光台。用雾灯点亮它们，光会找到石门。淡蓝的回声旁还藏着一段记忆。',
      'forest-guide': '树灵：向前寻找淡蓝的回声。照亮石碑，就能读出三枚符文的次序。',
      'sunken-guide': '守门人：两处潮阀要同时转动。门只听水位，不会等迷路的人。',
      'mine-guide': '矿工留言：闸柄在左，支撑杆在右。听见第三声落石，就不要回头。',
      'core-guide': '铭文：守塔者惧怕自己的蓄力被打断。灯光照进裂隙时，出手。',
    };
    return lines[id] ?? '石壁上刻着一行被雾水模糊的字。';
  }

  private openGate(index: number, quiet = false): void {
    const gate = this.gates[index];
    if (!gate || gate.opened) return;
    gate.opened = true;
    gate.pieces.forEach((piece) => {
      piece.setVisible(false).setActive(false);
      (piece.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    });
    this.worldView?.setGateOpen(index, true);
    if (!(this.level.id === 'sunken-ruins' && index === 0)) this.remember('gate-' + index);
    if (!quiet) {
      this.feedback.ring(gate.x, this.level.mapHeight / 2, 0xffd477, 100);
      this.ui?.showToast(index === this.gates.length - 1 ? '石门开启，出口就在前方。' : '遗迹石门打开了。');
      this.audio.play('switch');
    }
  }

  private updatePickups(dt: number): void {
    this.pickups.forEach((pickup) => {
      if (pickup.collected) return;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, pickup.x, pickup.y);
      pickup.shape.y = pickup.y + Math.sin(this.elapsed * 2 + pickup.x) * 3;
      pickup.shape.rotation += dt * .35;
      if (distance > 43) return;
      pickup.collected = true; pickup.shape.setVisible(false);
      this.save.collect(pickup.id, pickup.fragment);
      if (pickup.fragment) {
        this.collectedWick = true; this.feedback.connect(pickup, this.player);
        this.feedback.ring(this.player.x, this.player.y, 0xffd477, 230);
        this.ui.showToast('失落灯芯收入雾灯，附近的迷雾散去了。', 3800);
        this.fogPuffs.forEach(fog => { if (fog.active && Phaser.Math.Distance.Between(fog.x, fog.y, this.player.x, this.player.y) < 440) fog.destroy(); });
      } else this.ui.showToast(FRAGMENT_STORIES[this.levelIndex] + ' · 本关碎片 ' + this.level.collectibles.filter(c => c.kind === 'shard' && this.save.hasCollected(c.id)).length + '/2', 3800);
      this.audio.play('pickup');
      this.player.heal(pickup.fragment ? 1 : 0);
    });
  }

  private updateCheckpoints(): void {
    this.level.checkpointXs.forEach((x, index) => {
      const id = 'cp' + index;
      if (this.checkpoints.has(id) || this.player.x < x) return;
      this.checkpoints.add(id); this.save.setCheckpoint(this.levelIndex, id); this.player.heal(this.player.maxHealth);
      this.worldView?.setCheckpoint(index, true);
      this.ui.showToast('检查点已点亮，生命恢复。倒下后会从这里继续。');
      const beacon = this.add.circle(x, this.level.mapHeight / 2, 46, this.level.palette.accent, .1).setStrokeStyle(3, this.level.palette.accent, .7).setDepth(13);
      this.feedback.ring(x, this.level.mapHeight / 2, this.level.palette.accent, 80);
      beacon.setAlpha(.65);
    });
  }

  private updateTimedDoor(dt: number): void {
    if (this.level.id !== 'sunken-ruins' || this.timedDoorRemaining <= 0) return;
    this.timedDoorRemaining = Math.max(0, this.timedDoorRemaining - dt);
    if (this.timedDoorRemaining > 0) return;
    if (this.player.x < this.gates[0].x - 70) {
      this.gates[0].opened = false;
      this.gates[0].pieces.forEach((piece) => {
        piece.setActive(true).setVisible(true);
        (piece.body as Phaser.Physics.Arcade.StaticBody).enable = true;
        (piece.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
      });
      this.worldView?.setGateOpen(0, false);
      this.ui.showToast('限时门关闭了。再次转动潮阀可以重开。');
    }
  }

  private updateBoss(dt: number): void {
    if (!this.boss) return;
    if (!this.boss.alive) {
      if (!this.bossDefeated) {
        this.bossDefeated = true;
        this.gates.forEach((gate, index) => { if (!gate.opened) this.openGate(index); });
        this.ui.showToast('守塔者的光芒平息了。第五枚灯芯在前方。', 3800);
      }
      return;
    }
    if (!this.boss.visible && this.player.x > this.boss.x - 590 && this.gates[2]?.opened) {
      this.boss.setVisible(true);
      (this.boss.body as Phaser.Physics.Arcade.Body).enable = true;
      this.audio.play('boss'); this.ui.showToast('守塔者醒了！等待红色蓄力预警，再以雾灯冲击波打断它。', 4400);
    }
    if (!this.boss.visible || !this.boss.alive) return;
    this.boss.updateBoss(this.player, dt);
  }

  private updateChase(dt: number): void {
    if (!this.level.chase || !this.chaseMarker || !this.chaseStarted) return;
    const safe = this.isMineRestZone();
    if (safe) {
      this.chaseMarker.x = Math.min(this.chaseMarker.x, this.player.x - 330);
      this.hazard?.setVisible(false); this.hazardTimer = 2;
      return;
    }
    this.chaseElapsed += dt;
    if (!this.chaseMarker.visible) {
      this.chaseMarker.setVisible(true).setPosition(Math.max(75, this.player.x - 440), this.player.y);
      this.ui.showToast('坍塌追逐开始！冲刺穿过矿道，别被落石追上。', 3600);
    } else {
      this.chaseMarker.x += dt * 124;
      this.chaseMarker.y += (this.player.y - this.chaseMarker.y) * Math.min(1, dt * 1.2);
    }
    if (this.chaseElapsed > 165 || (this.chaseMarker.visible && this.chaseMarker.x > this.player.x - 70)) this.gameOver();
    this.hazardTimer -= dt;
    if (this.hazardTimer <= 0) {
      if (this.hazard?.visible) {
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.hazardPoint.x, this.hazardPoint.y) <= 62) this.player.takeDamage(1);
        this.feedback.ring(this.hazardPoint.x, this.hazardPoint.y, 0xe99c5a, 62);
        this.hazard.setVisible(false); this.hazardTimer = 2.8;
      } else {
        this.hazardPoint = { x: this.player.x + 110, y: this.player.y };
        this.hazard?.setPosition(this.hazardPoint.x, this.hazardPoint.y).setVisible(true); this.hazardTimer = 1.2;
      }
    }
  }

  private remember(flag: string): void {
    this.worldFlags.add(flag); this.save.rememberWorld(this.level.id, flag);
  }

  private isMineRestZone(): boolean {
    return !!this.level.chase && this.level.checkpointXs.some(x => this.player.x >= x && this.player.x <= x + 150);
  }

  private shouldStartChase(): boolean {
    // A saved open lever must not spawn a pursuer on top of an entrance respawn.
    return !!this.level.chase && ((this.worldFlags.has('mine-switch-1') && this.player.x > 600) || this.player.x > 1100);
  }

  private restoreWorldProgress(checkpointIndex: number): void {
    this.interactables.forEach(item => {
      if (this.worldFlags.has(item.id)) item.setLit(true);
      if (item.kind === 'chest' && this.save.hasCollected(item.id + '-opened')) item.deactivate();
      if (item.id.startsWith('sunken-valve-') && this.worldFlags.has(item.id)) this.valves.add(item.id);
    });
    if (this.worldFlags.has('forest-sequence')) {
      this.runeStep = 3; this.interactables.filter(i => i.id.startsWith('forest-rune-')).forEach(i => i.setLit(true));
    }
    this.gates.forEach((gate, index) => {
      // Legacy v1 saves lack mechanism flags. Gates behind their checkpoint must remain traversable.
      if (this.worldFlags.has('gate-' + index) || checkpointIndex >= 0 && gate.x < this.player.x) this.openGate(index, true);
    });
    this.level.checkpointXs.forEach((x, index) => { if (x <= this.player.x) { this.checkpoints.add('cp' + index); this.worldView?.setCheckpoint(index, true); } });
    if (this.valves.size === 2) {
      this.platform?.setAlpha(1);
      if (!this.gates[0].opened) { this.openGate(0, true); this.timedDoorRemaining = 24; }
    }
  }

  private currentObjective(): string {
    if (this.collectedWick || this.save.hasCollected(this.level.collectibles.find(c => c.kind === 'fragment')?.id ?? '')) return this.boss?.alive ? '平息守塔者，重新点亮灯塔' : '灯芯已找到 · 沿主路前往出口';
    if (this.level.chase && this.chaseStarted && this.level.checkpointXs.some(x => this.player.x >= x && this.player.x <= x + 150)) return '安全灯火 · 稍作休息，前方继续逃亡';
    const beacons = BEACONS[this.level.id];
    if (beacons && this.gates[0]?.opened && !this.gates[1]?.opened) return '雾灯点亮南北灯台 · ' + beacons.filter(id => this.worldFlags.has(id)).length + '/2';
    if (this.level.id === 'echo-forest' && !this.gates[0].opened) return this.runeStep ? '唤醒符文 · ' + this.runeStep + '/3' : '用雾灯照见回声石碑，寻找符文次序';
    if (this.level.id === 'sunken-ruins') {
      if (this.valves.size < 2) return '转动潮阀 · ' + this.valves.size + '/2';
      if (this.player.x < 2480) return '前往西岸浮台 · 互动乘船过河' + (this.timedDoorRemaining > 0 ? ' · ' + Math.ceil(this.timedDoorRemaining) + ' 秒' : '');
      if (this.timedDoorRemaining > 0 && this.player.x < this.gates[0].x) return '穿过限时门 · ' + Math.ceil(this.timedDoorRemaining) + ' 秒';
      if (!this.gates[0].opened && this.player.x >= 2480) return '门已关闭 · 用东岸回流闸重开';
    }
    if (this.gates[1]?.opened) return '沿主路寻找灯芯 · 经过前方石门后留意支路';
    return this.level.objective;
  }

  private ridePlatform(): void {
    if (this.riding) return;
    this.riding = true; this.inputManager.clearTarget(); this.player.setVelocity(0, 0);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.enable = false; this.player.setPosition(2130, 640); this.platform?.setPosition(2130, 640);
    // Traversal is an explicit boat ride. Only the passenger disables physics over the solid river.
    this.player.invulnerable = 3;
    this.ui.showToast('浮台正在渡河。抵岸后继续前往限时门。', 2300);
    this.tweens.add({ targets: [this.player, this.platform].filter(Boolean), x: 2510, y: 640, duration: 2400, ease: 'Sine.easeInOut', onComplete: () => {
      body.enable = true; body.reset(2510, 640); this.riding = false; this.touch.reset(); this.inputManager.clearTarget();
      this.feedback.ring(2510, 640, 0x7ce4ea, 70);
      // Start the return trip without moving the player, preserving a retry path if the timer elapsed.
      if (this.platform) this.tweens.add({ targets: this.platform, x: 2130, duration: 2000, delay: 600 });
    } });
  }

  private recordJourney(death = 0, completed = false): void {
    this.save.recordJourney(this.level.id, this.elapsed - this.recordedSeconds, this.pulseCount - this.recordedPulses, death, completed);
    this.recordedSeconds = this.elapsed; this.recordedPulses = this.pulseCount;
  }

  private applyLanternColor(): void {
    const memory = MEMORIES.find(m => m.id === this.save.value.lanternMemory);
    const color = memory ? Number.parseInt(memory.color.slice(1), 16) : 0xffcf66;
    this.heroModel?.setLanternColor(color); this.lampHalo?.setTint(color);
  }

  private pulseLamp(): void {
    if (this.pulseCooldown > 0 || this.stageFinished) return;
    this.pulseCooldown = 1.1; this.pulseCount++;
    this.feedback.ring(this.player.x, this.player.y, 0xffd477, 250);
    if (this.settings.value.screenShake && !this.settings.value.reduceMotion) this.cameras.main.shake(80, .0015);
    const lightRadius = 250;
    this.enemies.forEach((enemy) => {
      if (enemy.alive && Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) <= lightRadius) {
        enemy.hitByPulse(this.player); this.feedback.ring(enemy.x, enemy.y, 0x8be0c9, 45);
      }
    });
    if (this.boss?.visible && this.boss.alive) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
      if (distance <= 265) {
        const interrupted = this.boss.hitByPulse();
        if (!interrupted) this.ui.showToast('等待金色的灯芯暴露，或在攻击后的破绽中释放雾灯。', 1700);
        else { this.audio.play('hit'); this.ui.showToast('冲击波打断了守塔者的攻击！'); }
      }
    }
    this.fogPuffs.forEach((fog) => {
      if (fog.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, fog.x, fog.y) < lightRadius + 120) {
        this.tweens.add({ targets: fog, alpha: 0, duration: 700, onComplete: () => fog.destroy() });
      }
    });
    this.interactables.forEach(item => {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y) > 205) return;
      if (MEMORIES.some(m => m.id === item.id) && !item.visible) {
        item.setVisible(true); this.remember('revealed-' + item.id);
        const solid = this.addStaticRect(item.x, item.y, 38, 32, this.level.palette.wall);
        this.physics.add.collider(this.player, solid);
        this.enemies.forEach(enemy => { if (enemy.active) this.physics.add.collider(enemy, solid); });
        if (Math.abs(this.player.x - item.x) < 55 && Math.abs(this.player.y - item.y) < 54) {
          (this.player.body as Phaser.Physics.Arcade.Body).reset(item.x + (this.player.x >= item.x ? 70 : -70), this.player.y);
        }
        this.feedback.ring(item.x, item.y, 0x8be0c9, 80); this.ui.showToast('雾中显出一座记忆石碑。走近互动，可收入旅途手记。', 3000);
      }
      if ((BEACONS[this.level.id] ?? []).includes(item.id) && !item.lit && Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y) <= 145) {
        item.setLit(true); this.remember(item.id);
        this.feedback.connect(item, { x: this.gates[1].x, y: this.level.mapHeight / 2 });
        if (BEACONS[this.level.id].every(id => this.worldFlags.has(id))) this.openGate(1);
        else this.ui.showToast('一座引光台亮起。寻找庭院另一侧的灯台。');
      }
    });
    this.audio.play('pulse');
  }

  private tryExit(): void {
    if (this.level.boss && this.boss?.alive) { this.ui.showToast('守塔者仍挡在灯塔核心前。'); return; }
    const wickId = this.level.collectibles.find((item) => item.kind === 'fragment')?.id;
    if (wickId && !this.save.hasCollected(wickId)) { this.ui.showToast('还没有找到本关的灯芯。'); return; }
    this.finishLevel();
  }

  private finishLevel(): void {
    if (this.stageFinished) return;
    this.stageFinished = true;
    this.recordJourney(0, true); this.completionRecorded = true;
    if (!this.fromCheckpoint) this.save.recordCompletionTime(this.level.id, this.elapsed);
    this.physics.world.pause();
    this.touch.dispose();
    this.save.completeLevel(this.levelIndex);
    this.save.flush();
    this.ui.showLevelComplete(this.level, {
      next: () => {
        if (this.levelIndex >= LEVELS.length - 1) this.scene.start('EndingScene');
        else this.scene.start('LevelScene', { index: this.levelIndex + 1 });
      },
      levels: () => this.scene.start('LevelSelectScene'),
    });
    this.audio.play('win');
  }

  private gameOver(): void {
    if (this.stageFinished) return;
    this.stageFinished = true;
    this.recordJourney(1); this.completionRecorded = true;
    this.touch.dispose(); this.save.flush();
    this.scene.start('GameOverScene', { index: this.levelIndex });
    this.audio.play('hit');
  }

  private pauseGame(): void {
    if (this.pauseOpen || this.stageFinished) return;
    this.pauseOpen = true;
    this.recordJourney();
    this.touch.setSuspended(true);
    this.inputManager.clearTarget();
    this.player.setVelocity(0, 0);
    this.scene.pause(); this.scene.launch('PauseScene');
  }

  private resumeControls(): void {
    this.pauseOpen = false;
    this.input.keyboard?.resetKeys();
    this.inputManager.clearTarget();
    this.resizeCamera();
    this.touch.setSuspended(false);
    this.applyLanternColor();
  }

  private cleanup(): void {
    if (!this.completionRecorded) this.recordJourney();
    this.feedback?.destroy();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeCamera, this);
    window.removeEventListener('foglamp:layoutchange', this.syncControlLayout);
    this.events.off(Phaser.Scenes.Events.RESUME, this.resumeControls, this);
    this.inputManager?.destroy();
    this.unsubscribeSettings?.();
    this.heroModel?.destroy();
    this.worldView?.destroy();
    this.worldView = undefined;
    this.touch?.dispose();
    this.ui?.destroy();
    this.save?.flush();
    this.groundTextureKeys.forEach((key) => { if (this.textures.exists(key)) this.textures.remove(key); });
    this.groundTextureKeys = [];
  }
}

function tutorialKeyLabel(key: string): string {
  if (key.toUpperCase() === 'SPACE') return '空格';
  if (key.toUpperCase() === 'ESC' || key.toUpperCase() === 'ESCAPE') return 'Esc';
  return key;
}
