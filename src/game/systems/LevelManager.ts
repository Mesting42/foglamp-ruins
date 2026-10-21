import { LEVELS } from '../data/levels';
import type { LevelDefinition } from '../data/types';
import type { SaveManager } from './SaveManager';

export class LevelManager {
  constructor(private save: SaveManager) {}
  get currentIndex(): number { return this.save.value.currentLevel; }
  get current(): LevelDefinition { return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, this.currentIndex))]; }
  get(index: number): LevelDefinition | undefined { return LEVELS[index]; }
  get unlockedLevel(): number { return this.save.value.unlockedLevel; }
  get checkpoint(): string { return this.save.value.checkpoint; }
  start(index: number): void { this.save.startLevel(index); }
  checkpointAt(index: number, id: string): void { this.save.setCheckpoint(index, id); }
  complete(index: number): void { this.save.completeLevel(index); }
}
