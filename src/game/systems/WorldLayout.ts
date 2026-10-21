import type { LevelDefinition } from '../data/types';
import { MEMORIES } from '../data/adventure';

export interface WorldRock {
  x: number;
  y: number;
  radius: number;
}

export interface WorldLandmark {
  x: number;
  y: number;
  index: number;
}

export interface WorldSolid {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorldLayout {
  width: number;
  height: number;
  rocks: WorldRock[];
  landmarks: WorldLandmark[];
  solids: WorldSolid[];
  walls: WorldSolid[];
}

/** Geometry is shared by rendering and Arcade collision bodies. Keep these coordinates authoritative. */
export function buildWorldLayout(level: LevelDefinition, levelIndex: number): WorldLayout {
  const width = level.exitX + 180;
  const height = level.mapHeight;
  const random = (seed: number): number => {
    const value = Math.sin(seed * 127.1 + levelIndex * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };

  const rocks = Array.from({ length: 28 }, (_, index) => {
    const radius = 15 + random(index + 172) * 22;
    return {
      x: 160 + random(index + 1) * (width - 320),
      y: index % 2 === 0
        ? 150 + random(index + 81) * 220
        : height - 150 - random(index + 81) * 220,
      radius,
    };
  }).filter(rock => ![
    ...level.interactables, ...level.collectibles, ...MEMORIES.filter(m => m.level === levelIndex), level.start,
    ...level.checkpointXs.map(x => ({ x, y: level.start.y })),
  ].some(p => Math.hypot(p.x - rock.x, p.y - rock.y) < rock.radius + 85));

  const landmarkCount = Math.floor(width / 430);
  const landmarks = Array.from({ length: landmarkCount }, (_, index) => ({
    x: 210 + index * 430 + random(index + 1200) * 110,
    y: index % 2 === 0
      ? height / 2 - 190 + random(index + 1340) * 70
      : height / 2 + 190 + random(index + 1340) * 70,
    index,
  }));

  // Broken courtyard walls and alcoves leave authored openings wider than the player body.
  const walls: WorldSolid[] = level.id === 'mist-grassland' ? [
    { x: 1240, y: 340, width: 630, height: 38 },
    { x: 1160, y: 1030, width: 440, height: 38 },
    { x: 2300, y: 550, width: 42, height: 240 },
  ] : level.id === 'echo-forest' ? [
    { x: 1130, y: 360, width: 440, height: 32 },
    { x: 1690, y: 1010, width: 450, height: 32 },
    { x: 2810, y: 690, width: 38, height: 230 },
  ] : level.id === 'old-mine' ? [
    { x: 1170, y: 460, width: 40, height: 390 },
    { x: 2420, y: 860, width: 40, height: 300 },
    { x: 3500, y: 440, width: 40, height: 320 },
  ] : level.id === 'lighthouse-core' ? [
    { x: 1650, y: 290, width: 600, height: 40 },
    { x: 1650, y: 1040, width: 600, height: 40 },
  ] : [];
  // Permanent masonry surrounds a 200px doorway. Only its central door opens.
  const gateWingHeight = height / 2 - 196;
  level.gateXs.forEach(x => {
    walls.push({ x, y: 96 + gateWingHeight / 2, width: 72, height: gateWingHeight });
    walls.push({ x, y: height - 96 - gateWingHeight / 2, width: 72, height: gateWingHeight });
  });
  const solids: WorldSolid[] = [
    { x: width / 2, y: 48, width, height: 96 },
    { x: width / 2, y: height - 48, width, height: 96 },
    { x: 48, y: height / 2, width: 96, height },
    { x: width - 48, y: height / 2, width: 96, height },
    ...rocks.map(({ x, y, radius }) => ({ x, y, width: radius * 1.9, height: radius * 1.3 })),
    ...walls,
    ...level.checkpointXs.map(x => ({ x, y: level.start.y + 105, width: 38, height: 32 })),
  ];

  if (level.id === 'echo-forest') {
    landmarks.forEach(({ x, y }) => solids.push({ x, y: y + 31, width: 26, height: 28 }));
  }
  if (level.id === 'lighthouse-core') {
    landmarks.forEach(({ x, y }) => solids.push({ x, y: y + 20, width: 48, height: 48 }));
  }

  return { width, height, rocks, landmarks, solids, walls };
}
