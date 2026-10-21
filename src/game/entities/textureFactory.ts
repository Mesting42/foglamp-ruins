import Phaser from 'phaser';

export function ensureTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('hero')) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x142a2d); g.fillCircle(22, 27, 18);
    g.fillStyle(0x9bc5b6); g.fillEllipse(22, 24, 25, 29);
    g.fillStyle(0x243e3a); g.fillRoundedRect(12, 29, 20, 20, 5);
    g.fillStyle(0xf3bd62); g.fillCircle(34, 31, 7);
    g.fillStyle(0xffefb5); g.fillCircle(35, 30, 3);
    g.lineStyle(2, 0x38574f); g.strokeCircle(22, 27, 18);
    g.generateTexture('hero', 46, 54); g.destroy();
  }
  const specs: Array<[string, number, number]> = [
    ['enemy-moth', 0xd27963, 0x6d4542], ['enemy-wisp', 0x6cb8bd, 0x326b70],
    ['enemy-sentinel', 0xa99572, 0x625748], ['boss', 0xa15a52, 0x522f37],
  ];
  specs.forEach(([key, core, edge]) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    if (key === 'enemy-moth') {
      g.fillStyle(edge); g.fillEllipse(21, 19, 38, 22); g.fillStyle(core); g.fillEllipse(21, 19, 15, 24);
      g.fillStyle(0xf3bd62); g.fillCircle(18, 15, 2); g.fillCircle(24, 15, 2);
    } else if (key === 'enemy-wisp') {
      g.fillStyle(core, .26); g.fillCircle(22, 22, 22); g.fillStyle(core); g.fillCircle(22, 22, 14);
      g.fillStyle(0xe7f6e6); g.fillCircle(18, 19, 3); g.fillCircle(26, 19, 3);
    } else if (key === 'boss') {
      g.fillStyle(edge); g.fillCircle(36, 36, 33); g.fillStyle(core); g.fillCircle(36, 36, 25);
      g.fillStyle(0xf3bd62); g.fillCircle(27, 29, 4); g.fillCircle(45, 29, 4);
      g.lineStyle(4, 0xead7aa); g.strokeCircle(36, 36, 31);
    } else {
      g.fillStyle(edge); g.fillRoundedRect(5, 7, 36, 36, 8); g.fillStyle(core); g.fillRoundedRect(9, 9, 28, 32, 6);
      g.fillStyle(0x342f28); g.fillRect(12, 18, 22, 5); g.fillStyle(0xf3bd62); g.fillCircle(23, 20, 3);
      g.lineStyle(2, 0xc8b48a); g.strokeRoundedRect(5, 7, 36, 36, 8);
    }
    g.generateTexture(key, key === 'boss' ? 72 : 46, key === 'boss' ? 72 : 48); g.destroy();
  });
}

export function ensureGlowTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('lamp-glow')) return;
  const canvas = scene.textures.createCanvas('lamp-glow', 256, 256);
  if (!canvas) return;
  const ctx = canvas.context;
  const grad = ctx.createRadialGradient(128, 128, 6, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,220,145,0.24)');
  grad.addColorStop(.22, 'rgba(248,196,106,0.14)');
  grad.addColorStop(.58, 'rgba(115,193,176,0.08)');
  grad.addColorStop(1, 'rgba(80,145,138,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256); canvas.refresh();
}
