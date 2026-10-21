export type Quality = 'low' | 'medium' | 'high';
export type FpsMode = 'unlimited' | '60' | '30';

export interface KeyBindings {
  moveUp: string;
  moveDown: string;
  moveLeft: string;
  moveRight: string;
  dash: string;
  interact: string;
  lamp: string;
  pause: string;
}

export interface GameSettings {
  quality: Quality;
  particles: boolean;
  screenShake: boolean;
  shadows: boolean;
  postFx: boolean;
  pixelRatio: 'auto' | '1' | '2';
  dynamicScale: boolean;
  fps: FpsMode;
  keyBindings: KeyBindings;
  joystickSize: number;
  joystickOpacity: number;
  buttonOpacity: number;
  mouseSensitivity: number;
  gamepad: boolean;
  volume: number;
  subtitles: boolean;
  highContrast: boolean;
  colorAssist: boolean;
  reduceMotion: boolean;
  fontSize: number;
}

export interface SaveData {
  version: number;
  started: boolean;
  unlockedLevel: number;
  currentLevel: number;
  checkpointLevel: number;
  checkpoint: string;
  fragments: number;
  collected: string[];
  settings: GameSettings;
  tutorialComplete: boolean;
  worldState: Record<string, string[]>;
  journal: string[];
  lanternMemory: string;
  journey: Record<string, { seconds: number; pulses: number; deaths: number; completions: number; bestSeconds: number }>;
}

export interface LevelDefinition {
  id: string;
  name: string;
  subtitle: string;
  objective: string;
  duration: string;
  palette: { floor: number; wall: number; accent: number; fog: number };
  start: { x: number; y: number };
  exitX: number;
  gateXs: number[];
  checkpointXs: number[];
  enemies: Array<{ x: number; y: number; type: 'moth' | 'wisp' | 'sentinel'; label: string }>;
  collectibles: Array<{ id: string; x: number; y: number; kind: 'fragment' | 'shard'; label: string }>;
  interactables: Array<{ id: string; x: number; y: number; kind: 'switch' | 'rune' | 'valve' | 'chest' | 'npc' | 'platform'; label: string }>;
  puzzleHint: string;
  mapHeight: number;
  chase?: boolean;
  boss?: boolean;
}
