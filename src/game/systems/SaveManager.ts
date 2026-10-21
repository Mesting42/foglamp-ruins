import type { SaveData } from '../data/types';
import { SettingsManager } from './SettingsManager';

export const SAVE_VERSION = 1;
const STORAGE_KEY = 'foglamp-save-v1';

function emptySave(settings: SettingsManager): SaveData {
  return {
    version: SAVE_VERSION, started: false, unlockedLevel: 0, currentLevel: 0, checkpointLevel: 0,
    checkpoint: 'start', fragments: 0, collected: [], settings: settings.toJSON(), tutorialComplete: false,
    worldState: {}, journal: [], journey: {}, lanternMemory: '',
  };
}

export class SaveManager {
  private data: SaveData;
  constructor(private settings: SettingsManager) { this.data = emptySave(settings); }

  load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { this.data = emptySave(this.settings); this.flush(); return this.value; }
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (parsed.version !== SAVE_VERSION || !Array.isArray(parsed.collected) || !parsed.settings) throw new Error('旧版本或损坏存档');
      this.data = {
        version: SAVE_VERSION,
        started: parsed.started === true || integerIn(parsed.unlockedLevel, 0, 0, 4) > 0 ||
          integerIn(parsed.currentLevel, 0, 0, 4) > 0 || integerIn(parsed.fragments, 0, 0, 5) > 0 ||
          (typeof parsed.checkpoint === 'string' && parsed.checkpoint !== 'start'),
        unlockedLevel: integerIn(parsed.unlockedLevel, 0, 0, 4),
        currentLevel: integerIn(parsed.currentLevel, 0, 0, 4),
        checkpointLevel: integerIn(parsed.checkpointLevel, 0, 0, 4),
        checkpoint: typeof parsed.checkpoint === 'string' ? parsed.checkpoint : 'start',
        fragments: integerIn(parsed.fragments, 0, 0, 5),
        collected: parsed.collected.filter((item): item is string => typeof item === 'string'),
        settings: parsed.settings,
        tutorialComplete: parsed.tutorialComplete === true,
        worldState: cleanWorldState(parsed.worldState),
        journal: Array.isArray(parsed.journal) ? parsed.journal.filter((id): id is string => typeof id === 'string') : [],
        journey: cleanJourney(parsed.journey),
        lanternMemory: typeof parsed.lanternMemory === 'string' ? parsed.lanternMemory : '',
      };
      this.settings.replace(this.data.settings);
    } catch {
      this.data = emptySave(this.settings);
      this.flush();
    }
    return this.value;
  }

  get value(): SaveData { return structuredClone(this.data); }
  get canContinue(): boolean { return this.data.started; }

  newGame(): void {
    this.data = { ...emptySave(this.settings), settings: this.settings.toJSON() };
    this.flush();
  }

  startLevel(level: number): void {
    this.data.started = true;
    this.data.currentLevel = integerIn(level, 0, 0, this.data.unlockedLevel);
    if (this.data.checkpointLevel !== level) {
      this.data.checkpointLevel = level;
      this.data.checkpoint = 'start';
    }
    this.flush();
  }

  setCheckpoint(level: number, id: string): void {
    this.data.currentLevel = level;
    this.data.checkpointLevel = level;
    this.data.checkpoint = id;
    this.flush();
  }

  completeTutorial(): void {
    if (this.data.tutorialComplete) return;
    this.data.tutorialComplete = true;
    this.flush();
  }

  hasCollected(id: string): boolean { return this.data.collected.includes(id); }

  worldFlags(level: string): string[] { return [...(this.data.worldState[level] ?? [])]; }

  rememberWorld(level: string, flag: string): void {
    const flags = this.data.worldState[level] ??= [];
    if (!flags.includes(flag)) { flags.push(flag); this.flush(); }
  }

  discover(id: string): boolean {
    if (this.data.journal.includes(id)) return false;
    this.data.journal.push(id); this.data.lanternMemory = id; this.flush(); return true;
  }

  selectLantern(id: string): void {
    if (!id || this.data.journal.includes(id)) { this.data.lanternMemory = id; this.flush(); }
  }

  recordJourney(level: string, seconds: number, pulses: number, deaths: number, complete = false): void {
    const row = this.data.journey[level] ??= { seconds: 0, pulses: 0, deaths: 0, completions: 0, bestSeconds: 0 };
    row.seconds += seconds; row.pulses += pulses; row.deaths += deaths;
    if (complete) row.completions++;
    this.flush();
  }

  recordCompletionTime(level: string, seconds: number): void {
    const row = this.data.journey[level];
    if (row && seconds > 0 && (!row.bestSeconds || seconds < row.bestSeconds)) { row.bestSeconds = seconds; this.flush(); }
  }

  collect(id: string, fragment: boolean): void {
    if (this.data.collected.includes(id)) return;
    this.data.collected.push(id);
    if (fragment) this.data.fragments = Math.min(5, this.data.fragments + 1);
    this.flush();
  }

  completeLevel(level: number): void {
    this.data.started = true;
    this.data.unlockedLevel = Math.max(this.data.unlockedLevel, Math.min(4, level + 1));
    this.data.currentLevel = Math.min(4, level + 1);
    this.data.checkpointLevel = this.data.currentLevel;
    this.data.checkpoint = 'start';
    if (level === 0) this.data.tutorialComplete = true;
    this.flush();
  }

  flush(): void {
    this.data.settings = this.settings.toJSON();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch { /* storage may be disabled */ }
  }
}

function integerIn(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function cleanWorldState(value: unknown): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, flags] of Object.entries(value)) {
      if (['mist-grassland', 'echo-forest', 'sunken-ruins', 'old-mine', 'lighthouse-core'].includes(key) && Array.isArray(flags)) {
        result[key] = flags.filter((flag): flag is string => typeof flag === 'string');
      }
    }
  }
  return result;
}

function cleanJourney(value: unknown): SaveData['journey'] {
  const result: SaveData['journey'] = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, row] of Object.entries(value)) {
      if (!row || typeof row !== 'object') continue;
      const clean = (name: string) => integerIn((row as Record<string, unknown>)[name], 0, 0, 1e8);
      result[key] = { seconds: clean('seconds'), pulses: clean('pulses'), deaths: clean('deaths'), completions: clean('completions'), bestSeconds: clean('bestSeconds') };
    }
  }
  return result;
}
