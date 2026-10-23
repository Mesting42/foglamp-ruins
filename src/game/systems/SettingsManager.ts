import Phaser from 'phaser';
import type { GameSettings, KeyBindings } from '../data/types';

export const DEFAULT_KEYS: KeyBindings = {
  moveUp: 'W', moveDown: 'S', moveLeft: 'A', moveRight: 'D',
  dash: 'SPACE', interact: 'E', lamp: 'F', pause: 'ESC',
};

export const DEFAULT_SETTINGS: GameSettings = {
  quality: 'high', particles: true, screenShake: true, shadows: true, postFx: true,
  pixelRatio: 'auto', dynamicScale: true, fps: 'unlimited',
  keyBindings: { ...DEFAULT_KEYS }, joystickSize: 100, joystickOpacity: 68,
  buttonOpacity: 82, mouseSensitivity: 100, gamepad: true, volume: 65,
  subtitles: true, highContrast: false, colorAssist: false, reduceMotion: false, fontSize: 100,
};

const STORAGE_KEY = 'foglamp-settings-v1';

export class SettingsManager {
  private current: GameSettings = { ...DEFAULT_SETTINGS, keyBindings: { ...DEFAULT_KEYS } };
  private game?: Phaser.Game;
  private listeners = new Set<(settings: GameSettings) => void>();

  constructor() { this.load(); }

  attachGame(game: Phaser.Game): void { this.game = game; this.apply(); }

  get value(): GameSettings { return structuredClone(this.current); }

  subscribe(listener: (settings: GameSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  set<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
    this.current = { ...this.current, [key]: value };
    this.persist();
    this.apply();
    this.emit();
  }

  setKey(action: keyof KeyBindings, key: string): void {
    this.current.keyBindings = { ...this.current.keyBindings, [action]: key.toUpperCase() };
    this.persist();
    this.emit();
  }

  replace(settings: Partial<GameSettings>): void {
    this.current = normalizeSettings(settings);
    this.persist();
    this.apply();
    this.emit();
  }

  restoreDefaults(): void {
    this.current = structuredClone(DEFAULT_SETTINGS);
    this.persist();
    this.apply();
    this.emit();
  }

  toJSON(): GameSettings { return this.value; }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.current = normalizeSettings(JSON.parse(raw) as Partial<GameSettings>);
    } catch {
      this.current = structuredClone(DEFAULT_SETTINGS);
    }
  }

  private persist(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.current)); } catch { /* storage may be disabled */ }
  }

  private apply(): void {
    if (!this.game) return;
    const target = this.current.fps === '30' ? 30 : this.current.fps === '60' ? 60 : 0;
    this.game.loop.targetFps = target;
    const ratio = this.current.pixelRatio === 'auto' ? Math.min(window.devicePixelRatio || 1, 2) : Number(this.current.pixelRatio);
    const pixelCap = this.current.quality === 'low' ? 1.1 : this.current.quality === 'medium' ? 1.5 : 2;
    if (this.game.renderer && 'resolution' in this.game.renderer) {
      // Retain the runtime guard: this extension is absent from Phaser's types.
      (this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer & { resolution: number }).resolution = Math.min(ratio, pixelCap);
    }
    this.game.registry.set('renderResolution', Math.min(ratio, pixelCap));
    this.game.registry.set('settings', this.value);
  }

  private emit(): void { this.listeners.forEach((listener) => listener(this.value)); }
}

function normalizeSettings(input: Partial<GameSettings>): GameSettings {
  const merged = { ...DEFAULT_SETTINGS, ...input, keyBindings: { ...DEFAULT_KEYS, ...(input.keyBindings ?? {}) } };
  const finite = (value: number, fallback: number, min: number, max: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  return {
    ...merged,
    quality: ['low', 'medium', 'high'].includes(String(merged.quality)) ? merged.quality : 'high',
    fps: ['unlimited', '60', '30'].includes(String(merged.fps)) ? merged.fps : 'unlimited',
    pixelRatio: ['auto', '1', '2'].includes(String(merged.pixelRatio)) ? merged.pixelRatio : 'auto',
    joystickSize: finite(merged.joystickSize, 100, 70, 140),
    joystickOpacity: finite(merged.joystickOpacity, 68, 20, 100),
    buttonOpacity: finite(merged.buttonOpacity, 82, 20, 100),
    mouseSensitivity: finite(merged.mouseSensitivity, 100, 30, 200),
    volume: finite(merged.volume, 65, 0, 100),
    fontSize: finite(merged.fontSize, 100, 80, 150),
  };
}
