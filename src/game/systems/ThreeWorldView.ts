import * as THREE from 'three';
import type Phaser from 'phaser';
import type { GameSettings, LevelDefinition } from '../data/types';
import type { WorldLayout } from './WorldLayout';
import { MEMORIES } from '../data/adventure';

interface WorldProp {
  group: THREE.Group;
  glow: THREE.Object3D[];
  lit: boolean;
  active: boolean;
}

interface ViewportState {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One retained Three.js scene for the complete level environment. Physics remains in Phaser. */
export class ThreeWorldView {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  private readonly materials = new Map<string, THREE.Material>();
  private readonly props = new Map<string, WorldProp>();
  private readonly gates: THREE.Group[] = [];
  private readonly canvas: HTMLCanvasElement;
  private renderer?: THREE.WebGLRenderer;
  private fallback?: CanvasRenderingContext2D;
  private dpr = 1;
  private cssWidth = 0;
  private cssHeight = 0;
  private viewport?: ViewportState;
  private disposed = false;
  private needsRender = true;
  private quality: GameSettings['quality'];
  private lastPixelRatioSetting: GameSettings['pixelRatio'] = 'auto';
  private platform?: THREE.Group;
  private platformState?: { x: number; y: number; alpha: number };

  constructor(
    private readonly host: HTMLElement,
    private readonly level: LevelDefinition,
    private readonly layout: WorldLayout,
    quality: GameSettings['quality'],
  ) {
    this.quality = quality;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'three-world-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.style.visibility = 'hidden';

    this.scene.add(new THREE.HemisphereLight(0xf0f2dc, 0x26352c, 1.65));
    const keyLight = new THREE.DirectionalLight(0xffe3ad, 1.6);
    keyLight.position.set(-180, 280, 420);
    this.scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x91d3c5, .58);
    fillLight.position.set(240, -120, 220);
    this.scene.add(fillLight);

    this.buildLevel();
    this.host.insertBefore(this.canvas, this.host.firstChild);
    this.createRenderer();
  }

  update(camera: { worldView: { x: number; y: number; width: number; height: number } }, settings: GameSettings): void {
    if (this.disposed) return;
    const bounds = camera.worldView;
    const viewport = {
      x: bounds.x,
      y: bounds.y,
      width: Math.max(1, bounds.width),
      height: Math.max(1, bounds.height),
    };
    const changed = !this.viewport
      || Math.abs(viewport.x - this.viewport.x) > .08
      || Math.abs(viewport.y - this.viewport.y) > .08
      || Math.abs(viewport.width - this.viewport.width) > .08
      || Math.abs(viewport.height - this.viewport.height) > .08;
    this.viewport = viewport;
    this.setQuality(settings.quality, settings.pixelRatio);
    const hostRect = this.host.getBoundingClientRect();
    const width = Math.max(1, Math.round(hostRect.width));
    const height = Math.max(1, Math.round(hostRect.height));
    if (width !== this.cssWidth || height !== this.cssHeight) {
      this.cssWidth = width;
      this.cssHeight = height;
      this.resizeRenderer();
    }
    if (changed || this.needsRender) this.renderScene();
  }

  setInteractable(id: string, lit: boolean, active: boolean): void {
    const prop = this.props.get(id);
    if (!prop || (prop.lit === lit && prop.active === active)) return;
    prop.lit = lit;
    prop.active = active;
    prop.group.visible = active;
    prop.glow.forEach((object) => { object.visible = lit; });
    this.renderScene();
  }

  setGateOpen(index: number, open: boolean): void {
    const gate = this.gates[index];
    if (!gate || gate.visible === !open) return;
    gate.visible = !open;
    this.renderScene();
  }

  setCheckpoint(index: number, lit: boolean): void { this.setInteractable('checkpoint-' + index, lit, true); }

  setPlatform(x: number, y: number, alpha: number): void {
    if (!this.platform) return;
    if (this.platformState && this.platformState.x === x && this.platformState.y === y && this.platformState.alpha === alpha) return;
    this.platformState = { x, y, alpha };
    this.platform.position.set(x, this.mapY(y), 2);
    this.platform.visible = alpha > .05;
    this.renderScene();
  }

  setQuality(quality: GameSettings['quality'], pixelRatio: GameSettings['pixelRatio']): void {
    const preferred = pixelRatio === 'auto' ? window.devicePixelRatio || 1 : Number(pixelRatio);
    const qualityCap = quality === 'low' ? 1 : quality === 'medium' ? 1.25 : 1.6;
    const nextDpr = Math.max(1, Math.min(preferred, qualityCap));
    if (quality === this.quality && pixelRatio === this.lastPixelRatioSetting && Math.abs(nextDpr - this.dpr) < .01) return;
    this.quality = quality;
    this.lastPixelRatioSetting = pixelRatio;
    this.dpr = nextDpr;
    this.resizeRenderer();
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer?.dispose();
    this.canvas.remove();
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.geometries.clear();
    this.materials.clear();
    this.props.clear();
    this.gates.length = 0;
  }

  private createRenderer(): void {
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: this.quality !== 'low',
        powerPreference: 'high-performance',
        depth: true,
        stencil: false,
      });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.14;
      this.renderer.shadowMap.enabled = false;
      this.resizeRenderer();
      this.canvas.style.visibility = 'visible';
      this.renderScene();
    } catch {
      this.renderer?.dispose();
      this.renderer = undefined;
      this.fallback = this.canvas.getContext('2d') ?? undefined;
      this.resizeRenderer();
      this.canvas.style.visibility = this.fallback ? 'visible' : 'hidden';
      this.renderFallback();
    }
  }

  private resizeRenderer(): void {
    // Resizing clears the drawing buffer even when the camera's world bounds stay unchanged.
    this.needsRender = true;
    if (this.renderer) {
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(this.cssWidth || 1, this.cssHeight || 1, false);
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
    } else if (this.fallback) {
      this.canvas.width = Math.max(1, Math.round((this.cssWidth || 1) * this.dpr));
      this.canvas.height = Math.max(1, Math.round((this.cssHeight || 1) * this.dpr));
      this.fallback.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    if (this.viewport) this.updateCamera(this.viewport);
  }

  private renderScene(): void {
    if (!this.viewport) return;
    if (this.renderer && this.viewport) {
      this.updateCamera(this.viewport);
      this.renderer.render(this.scene, this.camera);
    } else this.renderFallback();
    this.needsRender = false;
  }

  private updateCamera(view: ViewportState): void {
    const centerX = view.x + view.width / 2;
    const centerY = this.mapY(view.y + view.height / 2);
    this.camera.left = -view.width / 2;
    this.camera.right = view.width / 2;
    this.camera.top = view.height / 2;
    this.camera.bottom = -view.height / 2;
    this.camera.position.set(centerX, centerY, 460);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(centerX, centerY, 0);
    this.camera.updateProjectionMatrix();
  }

  private buildLevel(): void {
    const { width, height } = this.layout;
    const floor = new THREE.Mesh(
      this.geometry('plane', () => new THREE.PlaneGeometry(width, height)),
      this.material(this.level.palette.floor, { roughness: 1 }),
    );
    floor.position.set(width / 2, height / 2, 0);
    this.scene.add(floor);

    const detail = this.createFloorTexture();
    const tileMaterial = new THREE.MeshBasicMaterial({ map: detail, transparent: false, toneMapped: true });
    this.trackMaterial('floor-detail', tileMaterial);
    const detailFloor = new THREE.Mesh(
      this.geometry('detail-plane', () => new THREE.PlaneGeometry(width, height)), tileMaterial,
    );
    detailFloor.position.set(width / 2, height / 2, .35);
    this.scene.add(detailFloor);

    this.addCenterTrail();
    this.addBoundaryWalls();
    this.addRocks();
    this.addLandmarks();
    this.addWater();
    this.addGates();
    this.addInteractables();
    this.addExit();
    this.addPlatform();
  }

  private createFloorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    const [r, g, b] = hexRgb(this.level.palette.floor);
    const [wr, wg, wb] = hexRgb(this.level.palette.wall);
    const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
    gradient.addColorStop(0, rgb(r + 10, g + 11, b + 8));
    gradient.addColorStop(1, rgb(wr + 15, wg + 15, wb + 12));
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1024, 1024);
    let state = 0x9e3779b9 ^ hashString(this.level.id);
    const random = () => {
      state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
      return (state >>> 0) / 0x1_0000_0000;
    };
    const grassland = this.level.id === 'mist-grassland';
    const stepX = grassland ? 42 : 116;
    const stepY = grassland ? 42 : 112;
    for (let y = -stepY; y < 1080; y += stepY) {
      for (let x = -stepX; x < 1080; x += stepX) {
        const cx = x + 20 + random() * (stepX - 38), cy = y + 20 + random() * (stepY - 38);
        const width = grassland ? 12 + random() * 33 : 74 + random() * 47;
        const height = grassland ? 9 + random() * 24 : 66 + random() * 52;
        const shade = random() > .54 ? '228,239,211' : '15,31,27';
        ctx.fillStyle = grassland ? `rgba(${shade},${.025 + random() * .035})` : `rgba(${shade},${.035 + random() * .045})`;
        if (grassland) {
          ctx.beginPath(); ctx.ellipse(cx, cy, width, height, random() * Math.PI, 0, Math.PI * 2); ctx.fill();
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(cx - width * .48, cy - height * .42);
        ctx.lineTo(cx + width * .32, cy - height * .5 + random() * 8);
        ctx.lineTo(cx + width * .5, cy - height * .16);
        ctx.lineTo(cx + width * .39, cy + height * .42);
        ctx.lineTo(cx - width * .22, cy + height * .5);
        ctx.lineTo(cx - width * .5, cy + height * .18);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(14,31,26,.09)'; ctx.lineWidth = 1.4; ctx.stroke();
        if (random() > .48) {
          ctx.strokeStyle = 'rgba(229,222,185,.07)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(cx - width * .24, cy + height * .18); ctx.lineTo(cx - width * .04, cy - height * .12); ctx.lineTo(cx + width * .12, cy - height * .04); ctx.stroke();
        }
      }
    }
    ctx.fillStyle = grassland ? 'rgba(198,219,144,.18)' : 'rgba(221,213,170,.09)';
    for (let i = 0; i < 480; i++) {
      const x = random() * 1024, y = random() * 1024;
      ctx.beginPath(); ctx.ellipse(x, y, .7 + random() * 1.6, .6 + random() * 1.2, random() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(this.layout.width / 1024, this.layout.height / 1024);
    texture.anisotropy = 4;
    this.trackMaterial('floor-texture', texture);
    return texture;
  }

  private addCenterTrail(): void {
    const points: Array<[number, number]> = [];
    const worldW = this.layout.width, h = this.layout.height;
    for (let x = 64; x <= worldW - 64; x += 80) {
      const center = h / 2 + Math.sin(x * .004 + 0) * 18;
      points.push([x, this.mapY(center - 40)]);
    }
    for (let x = worldW - 64; x >= 64; x -= 80) {
      const center = h / 2 + Math.sin(x * .004) * 18;
      points.push([x, this.mapY(center + 40)]);
    }
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
    shape.closePath();
    const path = new THREE.Mesh(this.geometry('trail', () => new THREE.ShapeGeometry(shape)), this.material(this.level.palette.accent, { opacity: .13, basic: true }));
    path.position.z = .8;
    this.scene.add(path);
  }

  private addBoundaryWalls(): void {
    const { width, height } = this.layout;
    const wall = this.material(this.level.palette.wall);
    const trim = this.material(this.level.palette.accent, { opacity: .4, basic: true });
    const pieces: Array<[number, number, number, number]> = [
      [width / 2, 48, width, 96], [width / 2, height - 48, width, 96],
      [48, height / 2, 96, height], [width - 48, height / 2, 96, height],
    ];
    pieces.forEach(([x, y, w, h]) => {
      const group = new THREE.Group(); group.position.set(x, this.mapY(y), 0); this.scene.add(group);
      this.addRect(group, 0, 0, w, h, 52, wall, 3);
      this.addRect(group, 0, 0, Math.max(6, w - 8), Math.max(6, h - 8), 3, trim, 32);
    });
    this.layout.walls.forEach(({ x, y, width: w, height: h }) => {
      const group = new THREE.Group(); group.position.set(x, this.mapY(y), 0); this.scene.add(group);
      this.addRect(group, 0, 0, w, h, 35, wall, 4);
      this.addRect(group, 0, 0, Math.max(8, w - 10), Math.max(8, h - 10), 4, trim, 24);
    });
  }

  private addRocks(): void {
    const geometry = this.geometry('rock', () => new THREE.IcosahedronGeometry(1, 0));
    this.layout.rocks.forEach(({ x, y, radius }, index) => {
      const rock = new THREE.Mesh(geometry, this.material(index % 3 === 0 ? 0x786e55 : this.level.palette.wall));
      rock.position.set(x, this.mapY(y), 16 + radius * .18);
      rock.scale.set(radius * 1.02, radius * .68, radius * .46);
      rock.rotation.z = ((index * 13) % 31) * .04;
      rock.rotation.x = .18; rock.rotation.y = -.23;
      this.scene.add(rock);
      const rim = new THREE.Mesh(
        this.geometry('rock-rim', () => new THREE.IcosahedronGeometry(1, 0)),
        this.material(this.level.palette.accent, { opacity: .16, basic: true }),
      );
      rim.position.copy(rock.position); rim.scale.set(radius * 1.06, radius * .71, radius * .48);
      rim.rotation.copy(rock.rotation); this.scene.add(rim);
    });
  }

  private addLandmarks(): void {
    const id = this.level.id;
    this.layout.landmarks.forEach(({ x, y, index }) => {
      if (id === 'echo-forest') this.addTree(x, y, index);
      else if (id === 'old-mine') this.addMineSupport(x, y, index);
      else if (id === 'lighthouse-core') this.addCorePillar(x, y, index);
      else if (id === 'mist-grassland') this.addGrass(x, y, index);
      else this.addRuneInlay(x, y);
    });
  }

  private addTree(x: number, y: number, index: number): void {
    const tree = new THREE.Group(); tree.position.set(x, this.mapY(y), 0); this.scene.add(tree);
    const trunk = new THREE.Mesh(this.geometry('tree-trunk', () => new THREE.CylinderGeometry(5.5, 8, 42, 8)), this.material(0x63472f));
    trunk.rotation.x = Math.PI / 2; trunk.position.set(0, this.mapY(31) - this.mapY(0), 10); tree.add(trunk);
    const canopyColors = [0x326c4b, 0x3c8057, 0x4b9060];
    for (let leaf = 0; leaf < 5; leaf++) {
      const offsetX = Math.sin(index * 19 + leaf * 13) * 25;
      const offsetY = Math.cos(index * 11 + leaf * 7) * 15;
      const crown = new THREE.Mesh(this.geometry('canopy', () => new THREE.SphereGeometry(1, 9, 7)), this.material(canopyColors[leaf % 3]));
      crown.position.set(offsetX, offsetY, 18 + leaf % 2 * 3); crown.scale.set(34, 24, 9); tree.add(crown);
    }
    const glint = new THREE.Mesh(this.geometry('canopy-glint', () => new THREE.SphereGeometry(3, 8, 6)), this.material(0xd6e7a0, { basic: true }));
    glint.position.set(10, 18, 29); tree.add(glint);
  }

  private addMineSupport(x: number, y: number, index: number): void {
    const wood = this.material(0x79543b);
    const glint = this.material(0xd69b5c, { opacity: .7, basic: true });
    const leftX = x - 48, rightX = x + 48, topY = y - 39, bottomY = y + 61;
    this.addRect(this.scene, leftX, y + 12, 12, 104, 14, wood, 4);
    this.addRect(this.scene, rightX, y + 12, 12, 104, 14, wood, 4);
    this.addRect(this.scene, x, topY, 108, 12, 14, wood, 4);
    this.addRect(this.scene, leftX, y + 12, 3, 100, 15, glint, 5);
    this.addRect(this.scene, rightX, y + 12, 3, 100, 15, glint, 5);
    if (index % 2 === 0) this.addRect(this.scene, x, bottomY, 90, 6, 14, glint, 4);
  }

  private addCorePillar(x: number, y: number, index: number): void {
    const base = new THREE.Mesh(this.geometry('core-pillar', () => new THREE.CylinderGeometry(22, 26, 34, 7)), this.material(0x514436));
    base.rotation.x = Math.PI / 2; base.position.set(x, this.mapY(y + 20), 15); this.scene.add(base);
    const cap = new THREE.Mesh(this.geometry('pillar-cap', () => new THREE.CylinderGeometry(29, 27, 7, 7)), this.material(this.level.palette.accent, { metalness: .22 }));
    cap.rotation.x = Math.PI / 2; cap.position.set(x, this.mapY(y + 20), 33); this.scene.add(cap);
    const gem = new THREE.Mesh(this.geometry('pillar-gem', () => new THREE.OctahedronGeometry(8, 0)), this.material(index % 2 ? 0x98dfd2 : 0xffcf66, { basic: true }));
    gem.position.set(x, this.mapY(y + 20), 39); this.scene.add(gem);
  }

  private addGrass(x: number, y: number, index: number): void {
    const color = index % 2 === 0 ? 0xa3ba70 : 0x76a967;
    for (let blade = 0; blade < 7; blade++) {
      const bladeX = x + (blade - 3) * 5;
      const bladeY = y + 14 + ((blade * 7 + index) % 8);
      const leaf = new THREE.Mesh(this.geometry('grass-blade', () => new THREE.BoxGeometry(2.5, 24, 3)), this.material(color, { basic: true }));
      leaf.position.set(bladeX, this.mapY(bladeY), 7 + (blade % 2) * 2);
      leaf.rotation.z = (blade % 2 ? 1 : -1) * .22;
      this.scene.add(leaf);
    }
    const shadow = new THREE.Mesh(this.geometry('grass-shadow', () => new THREE.CircleGeometry(24, 16)), this.material(0x203d32, { opacity: .38, basic: true }));
    shadow.position.set(x, this.mapY(y + 24), 3); this.scene.add(shadow);
  }

  private addRuneInlay(x: number, y: number): void {
    const outer = new THREE.Mesh(this.geometry('inlay-ring', () => new THREE.TorusGeometry(49, 3, 7, 48)), this.material(0x6daab0, { opacity: .35, basic: true }));
    outer.position.set(x, this.mapY(y), 5); this.scene.add(outer);
    const inner = new THREE.Mesh(this.geometry('inlay-inner', () => new THREE.TorusGeometry(32, 2, 7, 36)), this.material(0x9be1dc, { opacity: .52, basic: true }));
    inner.position.set(x, this.mapY(y), 5.5); this.scene.add(inner);
    for (let segment = 0; segment < 3; segment++) {
      const line = new THREE.Mesh(this.geometry('inlay-line', () => new THREE.BoxGeometry(50, 3, 1)), this.material(0x9be1dc, { opacity: .53, basic: true }));
      line.position.set(x, this.mapY(y), 6); line.rotation.z = segment * Math.PI / 3; this.scene.add(line);
    }
  }

  private addWater(): void {
    if (this.level.id !== 'sunken-ruins') return;
    const waterMat = this.material(0x317b8d, { opacity: .24, basic: true });
    [[1230, 635], [2980, 635]].forEach(([x, y], index) => {
      const pool = new THREE.Mesh(this.geometry(`water-${index}`, () => new THREE.PlaneGeometry(320, 450)), waterMat);
      pool.position.set(x, this.mapY(y), 1.2); this.scene.add(pool);
      for (let ripple = 0; ripple < 3; ripple++) {
        const line = new THREE.Mesh(this.geometry('water-ripple', () => new THREE.BoxGeometry(270, 2, 1)), this.material(0x88dbe1, { opacity: .3, basic: true }));
        line.position.set(x, this.mapY(y - 110 + ripple * 105), 1.8); this.scene.add(line);
      }
    });
    const river = new THREE.Mesh(this.geometry('river', () => new THREE.PlaneGeometry(280, this.layout.height - 192)), this.material(0x24677b, { basic: true }));
    river.position.set(2320, this.mapY(this.layout.height / 2), 1.4); this.scene.add(river);
    for (let i = 0; i < 9; i++) {
      const ripple = new THREE.Mesh(this.geometry('river-line', () => new THREE.BoxGeometry(220, 3, 1)), this.material(0x88dbe1, { basic: true, opacity: .35 }));
      ripple.position.set(2320, this.mapY(180 + i * 125), 2); this.scene.add(ripple);
    }
  }

  private addGates(): void {
    const gateHeight = 200;
    this.level.gateXs.forEach((x, index) => {
      const gate = new THREE.Group(); gate.position.set(x, this.mapY(this.layout.height / 2), 0); this.scene.add(gate);
      this.addRect(gate, 0, 0, 72, gateHeight, 66, this.material(this.level.palette.wall), 5);
      this.addRect(gate, 0, 0, 60, gateHeight - 18, 67, this.material(0x283e36), 6);
      const border = this.material(this.level.palette.accent, { metalness: .26 });
      this.addRect(gate, -28, 0, 5, gateHeight - 38, 72, border, 8);
      this.addRect(gate, 28, 0, 5, gateHeight - 38, 72, border, 8);
      this.addRect(gate, 0, -gateHeight / 2 + 25, 56, 9, 72, border, 8);
      this.addRect(gate, 0, gateHeight / 2 - 25, 56, 9, 72, border, 8);

      const ring = new THREE.Mesh(this.geometry('gate-ring', () => new THREE.TorusGeometry(51, 6, 10, 56)), this.material(this.level.palette.accent, { metalness: .42, roughness: .34 }));
      ring.position.set(0, 0, 78); gate.add(ring);
      const innerRing = new THREE.Mesh(this.geometry('gate-inner-ring', () => new THREE.TorusGeometry(29, 4, 9, 48)), this.material(0xf3d078, { metalness: .36, roughness: .3 }));
      innerRing.position.set(0, 0, 80); gate.add(innerRing);
      const center = new THREE.Mesh(this.geometry('gate-core', () => new THREE.SphereGeometry(11, 16, 10)), this.material(0xffe8a1, { basic: true }));
      center.position.set(0, 0, 82); center.scale.set(1, 1, .55); gate.add(center);
      const seal = new THREE.Mesh(this.geometry('gate-seal', () => new THREE.CircleGeometry(18, 32)), this.material(0x102923, { basic: true }));
      seal.position.set(0, 0, 75); gate.add(seal);
      // The gate group is the visible face; keep its collision width at 72 world units.
      this.gates[index] = gate;
    });
  }

  private addInteractables(): void {
    const specs = [...this.level.interactables];
    this.level.gateXs.forEach((x, index) => {
      if (index > 0) specs.push({ id: `gate-control-${index}`, x: x - 128, y: this.layout.height / 2 + 145, kind: 'switch', label: '石门控制台' });
    });
    specs.forEach((spec) => this.props.set(spec.id, this.buildProp(spec.id, spec.kind, spec.x, spec.y)));
    this.level.checkpointXs.forEach((x, index) => this.props.set('checkpoint-' + index, this.buildProp('checkpoint-' + index, 'switch', x, this.level.start.y + 105)));
    MEMORIES.filter(m => this.level.id === ['mist-grassland', 'echo-forest', 'sunken-ruins', 'old-mine', 'lighthouse-core'][m.level]).forEach(m => {
      const prop = this.buildProp(m.id, 'rune', m.x, m.y); prop.group.visible = false; this.props.set(m.id, prop);
    });
  }

  private buildProp(id: string, kind: LevelDefinition['interactables'][number]['kind'], x: number, y: number): WorldProp {
    const group = new THREE.Group(); group.position.set(x, this.mapY(y), 0); this.scene.add(group);
    const glow: THREE.Object3D[] = [];
    const set = (geometryKey: string, geometry: () => THREE.BufferGeometry, color: number, px: number, py: number, pz: number, sx = 1, sy = 1, sz = 1, basic = false): THREE.Mesh => {
      const mesh = new THREE.Mesh(this.geometry(geometryKey, geometry), this.material(color, basic ? { basic: true } : {}));
      mesh.position.set(px, -py, pz); mesh.scale.set(sx, sy, sz); group.add(mesh); return mesh;
    };
    const disk = set('prop-glow-disk', () => new THREE.CircleGeometry(24, 32), colorFor(kind), 0, 0, 1, 1, 1, 1, true);
    disk.material = this.material(colorFor(kind), { basic: true, opacity: .18 }); disk.visible = false; glow.push(disk);

    if (kind === 'npc') {
      const hash = hashString(id);
      const robeColor = [0x327a78, 0x665d87, 0x885b42, 0x48687a][hash % 4];
      const body = set('npc-body', () => new THREE.SphereGeometry(1, 12, 9), robeColor, 0, 0, 16, 14, 18, 9);
      body.rotation.x = 0;
      set('npc-scarf', () => new THREE.SphereGeometry(1, 12, 8), 0xe6bb63, 0, -3, 23, 11, 5, 6);
      set('npc-head', () => new THREE.SphereGeometry(1, 12, 10), 0xe6c29b, 0, -1, 32, 8.5, 8.5, 7);
      const hat = set('npc-hat', () => new THREE.ConeGeometry(8, 14, 8), 0x164c5a, 0, -1, 42, 1, 1, 1); hat.rotation.x = Math.PI / 2;
      const brim = set('npc-brim', () => new THREE.CylinderGeometry(12, 13, 3, 10), 0xd9ae5d, 0, -1, 37, 1, 1, 1); brim.rotation.x = Math.PI / 2;
    } else if (kind === 'chest') {
      set('chest-box', () => new THREE.BoxGeometry(34, 25, 16), 0x825531, 0, 0, 12);
      set('chest-lid', () => new THREE.BoxGeometry(36, 11, 17), 0xb77a3b, 0, -16, 20);
      set('chest-band', () => new THREE.BoxGeometry(5, 28, 18), 0xe4b35c, -10, 0, 21, 1, 1, 1, true);
      set('chest-band', () => new THREE.BoxGeometry(5, 28, 18), 0xe4b35c, 10, 0, 21, 1, 1, 1, true);
      set('chest-lock', () => new THREE.OctahedronGeometry(4, 0), 0xffd87a, 0, -4, 24, 1, 1, 1, true);
    } else if (kind === 'valve') {
      const base = set('valve-base', () => new THREE.CylinderGeometry(17, 20, 12, 10), 0x475b57, 0, 0, 9); base.rotation.x = Math.PI / 2;
      const wheel = set('valve-wheel', () => new THREE.TorusGeometry(15, 3.5, 8, 32), 0x78cfd0, 0, 0, 21);
      glow.push(wheel);
      for (let spoke = 0; spoke < 4; spoke++) {
        const arm = set('valve-spoke', () => new THREE.BoxGeometry(27, 3.5, 4), 0xc7dbbf, 0, 0, 22);
        arm.rotation.z = spoke * Math.PI / 4;
      }
      set('valve-hub', () => new THREE.SphereGeometry(4, 9, 7), 0xffda84, 0, 0, 24, 1, 1, 1, true);
    } else if (kind === 'rune') {
      const base = set('rune-base', () => new THREE.CylinderGeometry(20, 23, 11, 8), 0x4d6862, 0, 0, 8); base.rotation.x = Math.PI / 2;
      const ring = set('rune-ring', () => new THREE.TorusGeometry(15, 2.5, 8, 32), 0x82c8b5, 0, 0, 16);
      glow.push(ring);
      set('rune-mark', () => new THREE.OctahedronGeometry(6, 0), 0xb7e7cc, 0, 0, 18, 1, 1, 1, true);
    } else if (kind === 'platform') {
      set('marker-base', () => new THREE.BoxGeometry(36, 28, 9), 0x527c7e, 0, 0, 7);
      set('marker-top', () => new THREE.BoxGeometry(25, 19, 4), 0x83d3d1, 0, 0, 13, 1, 1, 1, true);
      glow.push(group.children[group.children.length - 1]);
    } else {
      const base = set('switch-base', () => new THREE.CylinderGeometry(19, 21, 12, 8), 0x594f38, 0, 0, 8); base.rotation.x = Math.PI / 2;
      const column = set('switch-column', () => new THREE.CylinderGeometry(4, 6, 18, 8), 0xb88b46, 0, 0, 18); column.rotation.x = Math.PI / 2;
      const lamp = set('switch-light', () => new THREE.SphereGeometry(8, 10, 8), kind === 'switch' ? 0xffcf66 : 0xf5db86, 0, 0, 29, 1, 1, .8, true);
      glow.push(lamp);
      set('switch-ring', () => new THREE.TorusGeometry(12, 2.2, 7, 28), colorFor(kind), 0, 0, 25);
    }
    return { group, glow, lit: false, active: true };
  }

  private addExit(): void {
    const x = this.layout.width - 76, y = this.layout.height / 2;
    const exit = new THREE.Group(); exit.position.set(x, this.mapY(y), 0); this.scene.add(exit);
    const base = new THREE.Mesh(this.geometry('exit-outer', () => new THREE.TorusGeometry(62, 8, 10, 56)), this.material(this.level.palette.accent, { metalness: .24 }));
    base.position.z = 14; exit.add(base);
    const inner = new THREE.Mesh(this.geometry('exit-inner', () => new THREE.TorusGeometry(49, 4, 8, 48)), this.material(0xb3e0d1, { opacity: .74, basic: true }));
    inner.position.z = 16; exit.add(inner);
    const dark = new THREE.Mesh(this.geometry('exit-dark', () => new THREE.CircleGeometry(42, 42)), this.material(0x071820, { basic: true }));
    dark.position.z = 12; exit.add(dark);
  }

  private addPlatform(): void {
    if (this.level.id !== 'sunken-ruins') return;
    const group = new THREE.Group(); group.position.set(2380, this.mapY(640), 0); group.visible = false; this.scene.add(group);
    this.addRect(group, 0, 0, 168, 132, 24, this.material(0x5a8790), 5);
    for (let plank = -2; plank <= 2; plank++) this.addRect(group, 0, plank * 24, 154, 3, 26, this.material(0xa7e1dc, { opacity: .7, basic: true }), 6);
    this.platform = group;
  }

  private addRect(target: THREE.Object3D, x: number, y: number, width: number, height: number, depth: number, material: THREE.Material, z: number): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(`box-${width}-${height}-${depth}`, () => new THREE.BoxGeometry(width, height, depth)), material);
    mesh.position.set(x, -y, z); target.add(mesh); return mesh;
  }

  private geometry(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
    const existing = this.geometries.get(key);
    if (existing) return existing;
    const created = factory(); this.geometries.set(key, created); return created;
  }

  private material(color: number, options: { opacity?: number; basic?: boolean; roughness?: number; metalness?: number } = {}): THREE.Material {
    const key = `${color}-${options.opacity ?? 1}-${options.basic ? 'basic' : 'lit'}-${options.roughness ?? .76}-${options.metalness ?? 0}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    const created = options.basic
      ? new THREE.MeshBasicMaterial({ color, transparent: (options.opacity ?? 1) < 1, opacity: options.opacity ?? 1, depthWrite: (options.opacity ?? 1) >= 1, toneMapped: (options.opacity ?? 1) >= 1 })
      : new THREE.MeshStandardMaterial({ color, roughness: options.roughness ?? .76, metalness: options.metalness ?? .02, flatShading: true, transparent: (options.opacity ?? 1) < 1, opacity: options.opacity ?? 1, depthWrite: (options.opacity ?? 1) >= 1 });
    this.materials.set(key, created); return created;
  }

  private trackMaterial(key: string, material: THREE.Material | THREE.Texture): void {
    if ('dispose' in material) this.materials.set(key, material as THREE.Material);
  }

  private mapY(gameY: number): number { return this.layout.height - gameY; }

  private renderFallback(): void {
    const ctx = this.fallback;
    const view = this.viewport;
    if (!ctx || !view || !this.cssWidth || !this.cssHeight) return;
    const sx = this.cssWidth / view.width, sy = this.cssHeight / view.height;
    const point = (x: number, y: number) => [(x - view.x) * sx, (y - view.y) * sy] as const;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = `#${this.level.palette.floor.toString(16).padStart(6, '0')}`; ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.strokeStyle = `#${this.level.palette.accent.toString(16).padStart(6, '0')}`; ctx.globalAlpha = .12;
    for (let x = 0; x < this.layout.width; x += 76) for (let y = 0; y < this.layout.height; y += 76) {
      const [px, py] = point(x, y); ctx.strokeRect(px, py, 66 * sx, 66 * sy);
    }
    ctx.globalAlpha = 1;
    if (this.level.id === 'sunken-ruins') {
      const [rx, ry] = point(2180, 96); ctx.fillStyle = '#24677b'; ctx.fillRect(rx, ry, 280 * sx, (this.layout.height - 192) * sy);
      if (this.platform?.visible) { const [px, py] = point(this.platform.position.x, this.layout.height - this.platform.position.y); ctx.fillStyle = '#a7e1dc'; ctx.fillRect(px - 84 * sx, py - 66 * sy, 168 * sx, 132 * sy); }
    }
    const walls = [...this.layout.walls, ...this.layout.solids.slice(0, 4)];
    walls.forEach(wall => { const [x,y] = point(wall.x-wall.width/2,wall.y-wall.height/2); ctx.fillStyle = '#3c5844'; ctx.fillRect(x,y,wall.width*sx,wall.height*sy); });
    this.props.forEach(prop => {
      if (!prop.group.visible) return;
      const [x,y] = point(prop.group.position.x, this.layout.height - prop.group.position.y);
      ctx.fillStyle = prop.lit ? '#ffdf96' : '#84b9aa'; ctx.strokeStyle = '#e1eee2'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x,y,18*sx,21*sy,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    });
    this.layout.rocks.forEach(({ x, y, radius }) => { const [px, py] = point(x, y); ctx.fillStyle = '#756a52'; ctx.beginPath(); ctx.ellipse(px, py, radius * sx, radius * sy * .68, 0, 0, Math.PI * 2); ctx.fill(); });
    this.gates.forEach((gate, index) => {
      if (!gate.visible) return;
      const [px, py] = point(this.level.gateXs[index], this.layout.height / 2);
      ctx.fillStyle = `#${this.level.palette.wall.toString(16).padStart(6, '0')}`; ctx.fillRect(px - 36 * sx, py - 100 * sy, 72 * sx, 200 * sy);
      ctx.strokeStyle = `#${this.level.palette.accent.toString(16).padStart(6, '0')}`; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(px, py, 51 * sx, 51 * sy, 0, 0, Math.PI * 2); ctx.stroke();
    });
  }
}

function colorFor(kind: LevelDefinition['interactables'][number]['kind']): number {
  return { switch: 0xe8b75b, rune: 0x82c8b5, valve: 0x73c9d0, chest: 0xd39956, npc: 0x9cc7ac, platform: 0x70c2ca }[kind];
}

function hexRgb(color: number): [number, number, number] {
  return [(color >> 16) & 255, (color >> 8) & 255, color & 255];
}

function rgb(r: number, g: number, b: number): string {
  return `rgb(${clampColor(r)},${clampColor(g)},${clampColor(b)})`;
}

function clampColor(value: number): number { return Math.max(0, Math.min(255, Math.round(value))); }

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + width - r, y); ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r); ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height); ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

function hashString(text: string): number {
  let hash = 0;
  for (let index = 0; index < text.length; index++) hash = (hash * 31 + text.charCodeAt(index)) | 0;
  return Math.abs(hash);
}
