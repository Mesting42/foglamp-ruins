import Phaser from 'phaser';
import type { GameSettings, KeyBindings } from '../data/types';
import type { TouchControls } from './TouchControls';

export interface InputFrame {
  x: number;
  y: number;
  dashPressed: boolean;
  lampPressed: boolean;
  interactPressed: boolean;
  pausePressed: boolean;
  target: Phaser.Math.Vector2 | null;
}

export class InputManager {
  private keys: Record<keyof KeyBindings, Phaser.Input.Keyboard.Key> | null = null;
  private arrows?: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private target: Phaser.Math.Vector2 | null = null;
  private unsubscribe?: () => void;
  private settings: GameSettings;
  private pointerLamp = false;
  private requested = new Set<'dash' | 'lamp' | 'interact'>();
  private lampHandler: () => void;

  constructor(
    private scene: Phaser.Scene,
    private touch: TouchControls,
    initial: GameSettings,
    private readonly getPlayerPosition: () => { x: number; y: number },
  ) {
    this.settings = initial;
    this.rebind(initial.keyBindings);
    this.unsubscribe = (scene.registry.get('settingsManager') as { subscribe?: (fn: (s: GameSettings) => void) => () => void } | undefined)
      ?.subscribe?.((settings) => { this.settings = settings; this.rebind(settings.keyBindings); });
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() || pointer.middleButtonDown()) {
        this.pointerLamp = true;
      } else if (pointer.leftButtonDown()) {
        const player = this.getPlayerPosition();
        const sensitivity = this.settings.mouseSensitivity / 100;
        const originX = player.x;
        const originY = player.y;
        this.target = new Phaser.Math.Vector2(
          originX + (pointer.worldX - originX) * sensitivity,
          originY + (pointer.worldY - originY) * sensitivity,
        );
      }
    });
    this.lampHandler = () => { this.pointerLamp = true; };
    window.addEventListener('contextmenu', this.lampHandler);
  }

  getFrame(): InputFrame {
    const touch = this.touch.state;
    let x = touch.x, y = touch.y;
    if (Math.hypot(x, y) > .08) this.target = null;
    let dashPressed = touch.dash || this.requested.has('dash'), lampPressed = touch.lamp || this.requested.has('lamp'), interactPressed = touch.interact || this.requested.has('interact'), pausePressed = false;
    this.requested.clear();
    if (this.keys && this.scene.input.keyboard) {
      const key = this.keys;
      const up = key.moveUp.isDown || !!this.arrows?.up.isDown;
      const down = key.moveDown.isDown || !!this.arrows?.down.isDown;
      const left = key.moveLeft.isDown || !!this.arrows?.left.isDown;
      const right = key.moveRight.isDown || !!this.arrows?.right.isDown;
      const keyboardX = Number(right) - Number(left);
      const keyboardY = Number(down) - Number(up);
      if (keyboardX || keyboardY) { x = keyboardX; y = keyboardY; this.target = null; }
      dashPressed ||= Phaser.Input.Keyboard.JustDown(key.dash);
      lampPressed ||= Phaser.Input.Keyboard.JustDown(key.lamp);
      interactPressed ||= Phaser.Input.Keyboard.JustDown(key.interact);
      pausePressed ||= Phaser.Input.Keyboard.JustDown(key.pause);
    }
    if (this.settings.gamepad && this.scene.input.gamepad?.pad1?.connected) {
      const pad = this.scene.input.gamepad.pad1;
      const gx = pad.axes[0]?.getValue() ?? 0, gy = pad.axes[1]?.getValue() ?? 0;
      if (Math.hypot(gx, gy) > .2) { x = gx; y = gy; this.target = null; }
      dashPressed ||= !!pad.buttons[0]?.pressed;
      interactPressed ||= !!pad.buttons[2]?.pressed;
      lampPressed ||= !!pad.buttons[1]?.pressed;
    }
    if (!x && !y && this.target) {
      const pos = this.getPlayerPosition();
      const dx = this.target.x - pos.x;
      const dy = this.target.y - pos.y;
      if (Math.hypot(dx, dy) < 26) { x = 0; y = 0; }
      else { const n = Math.hypot(dx, dy); x = dx / n; y = dy / n; }
    }
    lampPressed ||= this.pointerLamp;
    this.pointerLamp = false;
    return { x, y, dashPressed, lampPressed, interactPressed, pausePressed, target: this.target };
  }

  requestAction(action: 'dash' | 'lamp' | 'interact'): void { this.requested.add(action); }
  clearTarget(): void { this.target = null; this.pointerLamp = false; this.requested.clear(); }
  setTarget(x: number, y: number): void { this.target = new Phaser.Math.Vector2(x, y); }
  destroy(): void {
    this.unsubscribe?.();
    window.removeEventListener('contextmenu', this.lampHandler);
    this.target = null;
  }

  private rebind(bindings: KeyBindings): void {
    if (!this.scene.input.keyboard) return;
    const resolve = (name: string): number => {
      const upper = name.toUpperCase();
      if (upper === 'SPACE') return Phaser.Input.Keyboard.KeyCodes.SPACE;
      if (upper === 'ESC' || upper === 'ESCAPE') return Phaser.Input.Keyboard.KeyCodes.ESC;
      if (upper === 'ARROWUP') return Phaser.Input.Keyboard.KeyCodes.UP;
      if (upper === 'ARROWDOWN') return Phaser.Input.Keyboard.KeyCodes.DOWN;
      if (upper === 'ARROWLEFT') return Phaser.Input.Keyboard.KeyCodes.LEFT;
      if (upper === 'ARROWRIGHT') return Phaser.Input.Keyboard.KeyCodes.RIGHT;
      return upper.length === 1 ? upper.charCodeAt(0) : Phaser.Input.Keyboard.KeyCodes.E;
    };
    const keyboard = this.scene.input.keyboard;
    this.keys = {
      moveUp: keyboard.addKey(resolve(bindings.moveUp), true, false),
      moveDown: keyboard.addKey(resolve(bindings.moveDown), true, false),
      moveLeft: keyboard.addKey(resolve(bindings.moveLeft), true, false),
      moveRight: keyboard.addKey(resolve(bindings.moveRight), true, false),
      dash: keyboard.addKey(resolve(bindings.dash), true, false),
      interact: keyboard.addKey(resolve(bindings.interact), true, false),
      lamp: keyboard.addKey(resolve(bindings.lamp), true, false),
      pause: keyboard.addKey(resolve(bindings.pause), true, false),
    };
    this.arrows = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP, true, false),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN, true, false),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT, true, false),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT, true, false),
    };
  }
}
