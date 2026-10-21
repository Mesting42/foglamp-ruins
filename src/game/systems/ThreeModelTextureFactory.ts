import * as THREE from 'three';
import type Phaser from 'phaser';

export type InteractiveModelKind = 'switch' | 'rune' | 'valve' | 'chest' | 'npc' | 'platform';

const NPC_PALETTES: Array<[number, number, number]> = [
  [0x3d766d, 0xc79b55, 0xf1d5aa],
  [0x6a5f83, 0x7fc9bd, 0xd9c59c],
  [0x8a583f, 0xd1a35c, 0xf2d9ab],
  [0x485f72, 0xb89b73, 0xc9d7c3],
];

export class ThreeModelTextureFactory {
  private static readonly SUPERSAMPLE = 2;

  static ensure(scene: Phaser.Scene): void {
    const renderer = this.createRenderer();
    if (!renderer) return;

    const modelScene = new THREE.Scene();
    modelScene.add(new THREE.HemisphereLight(0xd8fff5, 0x293942, 2.15));
    const keyLight = new THREE.DirectionalLight(0xffdfaa, 2.4);
    keyLight.position.set(-62, 92, 115);
    modelScene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x76d5d2, 1.25);
    fillLight.position.set(80, -35, 85);
    modelScene.add(fillLight);

    const camera = new THREE.OrthographicCamera(-48, 48, 56, -56, .1, 600);
    camera.position.set(0, 0, 240);
    camera.lookAt(0, 0, 0);

    try {
      const capture = (key: string, width: number, height: number, build: () => THREE.Group): void => {
        if (scene.textures.exists(key)) scene.textures.remove(key);
        const pixelWidth = width * this.SUPERSAMPLE;
        const pixelHeight = height * this.SUPERSAMPLE;
        const canvasTexture = scene.textures.createCanvas(key, pixelWidth, pixelHeight);
        if (!canvasTexture) return;
        const target = canvasTexture.getSourceImage() as HTMLCanvasElement;
        const context = target.getContext('2d');
        if (!context) { scene.textures.remove(key); return; }

        camera.left = -width / 2;
        camera.right = width / 2;
        camera.top = height / 2;
        camera.bottom = -height / 2;
        camera.updateProjectionMatrix();
        renderer.setSize(pixelWidth, pixelHeight, false);
        const model = build();
        modelScene.add(model);
        renderer.render(modelScene, camera);
        context.clearRect(0, 0, pixelWidth, pixelHeight);
        context.drawImage(renderer.domElement, 0, 0, pixelWidth, pixelHeight);
        canvasTexture.refresh();
        modelScene.remove(model);
        this.disposeModel(model);
      };

      capture('enemy-moth', 64, 64, () => this.buildMoth());
      capture('enemy-wisp', 64, 64, () => this.buildWisp());
      capture('enemy-sentinel', 64, 64, () => this.buildSentinel());
      capture('boss', 112, 112, () => this.buildBoss(0xb65b52, 0xf1c26c, 0x7e323c));
      capture('boss-phase-2', 112, 112, () => this.buildBoss(0x6f739b, 0x89e4dc, 0x393b67));
      capture('boss-phase-3', 112, 112, () => this.buildBoss(0x9c5044, 0xffca64, 0x522d31));

      for (let variant = 0; variant < NPC_PALETTES.length; variant++) {
        capture(this.interactableKey('npc', false, variant), 96, 112, () => this.buildNpc(NPC_PALETTES[variant], false));
        capture(this.interactableKey('npc', true, variant), 96, 112, () => this.buildNpc(NPC_PALETTES[variant], true));
      }

      const kinds: InteractiveModelKind[] = ['switch', 'rune', 'valve', 'chest', 'platform'];
      for (const kind of kinds) {
        capture(this.interactableKey(kind, false), 96, 112, () => this.buildInteractable(kind, false));
        capture(this.interactableKey(kind, true), 96, 112, () => this.buildInteractable(kind, true));
      }

      capture('three-gate', 144, 196, () => this.buildGate());
      capture('three-exit', 112, 216, () => this.buildExit());
      capture('three-platform', 144, 112, () => this.buildPlatform());
      capture('three-pickup-fragment', 56, 64, () => this.buildGem(0xf3bd62, 0xffe3a0));
      capture('three-pickup-shard', 56, 64, () => this.buildGem(0x75cfc5, 0xc2fff0));
      capture('three-chaser-rock', 96, 96, () => this.buildChaserRock());
    } catch {
      // The original Phaser-generated textures remain available as a graceful WebGL fallback.
    } finally {
      renderer.dispose();
      renderer.domElement.remove();
    }
  }

  static interactableKey(kind: InteractiveModelKind, lit: boolean, variant = 0): string {
    return `three-interactable-${kind}-${lit ? 'lit' : 'idle'}${kind === 'npc' ? `-${variant % NPC_PALETTES.length}` : ''}`;
  }

  static npcVariant(id: string): number {
    let hash = 0;
    for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) | 0;
    return Math.abs(hash) % NPC_PALETTES.length;
  }

  private static createRenderer(): THREE.WebGLRenderer | undefined {
    try {
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.16;
      renderer.shadowMap.enabled = false;
      return renderer;
    } catch {
      return undefined;
    }
  }

  private static material(color: number, options: { metalness?: number; roughness?: number; emissive?: number; opacity?: number } = {}): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: options.roughness ?? .72,
      metalness: options.metalness ?? .04,
      emissive: options.emissive ?? 0x000000,
      emissiveIntensity: options.emissive ? .75 : 0,
      transparent: options.opacity !== undefined,
      opacity: options.opacity ?? 1,
      flatShading: true,
      depthWrite: options.opacity === undefined,
    });
  }

  private static basic(color: number, opacity = 1): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, toneMapped: opacity >= 1 });
  }

  private static mesh(group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rotationZ = 0): THREE.Mesh {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.scale.set(sx, sy, sz);
    object.rotation.z = rotationZ;
    group.add(object);
    return object;
  }

  private static box(group: THREE.Group, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, rotationZ = 0): THREE.Mesh {
    return this.mesh(group, new THREE.BoxGeometry(w, h, d), material, x, y, z, 1, 1, 1, rotationZ);
  }

  private static shadow(group: THREE.Group, width: number, y = -37): void {
    this.mesh(group, new THREE.SphereGeometry(1, 20, 12), this.basic(0x071416, .28), 0, y, -8, width, 5, 2);
  }

  private static orb(group: THREE.Group, color: number, x: number, y: number, z: number, radius: number, emissive = color): void {
    this.mesh(group, new THREE.SphereGeometry(radius, 12, 9), this.material(color, { roughness: .32, emissive }), x, y, z);
    this.mesh(group, new THREE.SphereGeometry(radius * 1.65, 12, 9), this.basic(color, .16), x, y, z - 1, 1, 1, .45);
  }

  private static buildMoth(): THREE.Group {
    const group = new THREE.Group();
    this.shadow(group, 19, -26);
    const wing = this.material(0x805d78, { roughness: .52, emissive: 0x231424 });
    const wingLight = this.material(0xd99079, { roughness: .45, emissive: 0x381a20 });
    this.mesh(group, new THREE.SphereGeometry(1, 14, 9), wing, -13, 0, 0, 1.4, .72, .23, -.28);
    this.mesh(group, new THREE.SphereGeometry(1, 14, 9), wingLight, 13, 0, 0, 1.4, .72, .23, .28);
    this.mesh(group, new THREE.SphereGeometry(1, 12, 8), this.material(0xb96b60), 0, -1, 8, 7.5, 13, 6);
    this.mesh(group, new THREE.SphereGeometry(1, 12, 8), this.material(0x493844), 0, 11, 8, 8, 8, 6);
    const eye = this.basic(0xffd678);
    this.mesh(group, new THREE.SphereGeometry(1, 8, 6), eye, -3, 12, 14, 1.3, 1.7, 1);
    this.mesh(group, new THREE.SphereGeometry(1, 8, 6), eye, 3, 12, 14, 1.3, 1.7, 1);
    const antenna = this.material(0x392f39);
    this.mesh(group, new THREE.CylinderGeometry(.7, 1, 11, 6), antenna, -4, 20, 7, 1, 1, 1, -.24);
    this.mesh(group, new THREE.CylinderGeometry(.7, 1, 11, 6), antenna, 4, 20, 7, 1, 1, 1, .24);
    return group;
  }

  private static buildWisp(): THREE.Group {
    const group = new THREE.Group();
    this.shadow(group, 17, -27);
    const mist = this.material(0x6ab9bb, { roughness: .24, emissive: 0x164a49, opacity: .82 });
    this.mesh(group, new THREE.SphereGeometry(1, 18, 12), mist, 0, 4, 4, 18, 20, 9);
    this.mesh(group, new THREE.ConeGeometry(12, 25, 9), this.material(0x3d8589, { opacity: .8, emissive: 0x164546 }), 0, -15, 2, 1, 1, .7);
    this.mesh(group, new THREE.TorusGeometry(20, 2.4, 7, 28), this.material(0x9ee8df, { metalness: .3, emissive: 0x326c68 }), 0, 1, -1, 1, .72, .24, -.15);
    this.orb(group, 0xefffdf, -6, 6, 13, 2.2, 0xc2ffdf);
    this.orb(group, 0xefffdf, 6, 6, 13, 2.2, 0xc2ffdf);
    this.mesh(group, new THREE.SphereGeometry(1, 8, 6), this.basic(0x12333b), 0, -2, 14, 6.8, 2.2, 1);
    return group;
  }

  private static buildSentinel(): THREE.Group {
    const group = new THREE.Group();
    this.shadow(group, 22, -31);
    const stone = this.material(0x867c68, { roughness: .9 });
    const darkStone = this.material(0x494d45, { roughness: .92 });
    const metal = this.material(0xb58c53, { metalness: .58, roughness: .42 });
    this.mesh(group, new THREE.CylinderGeometry(10, 17, 25, 7), stone, 0, -13, 1);
    this.box(group, darkStone, 0, 0, 5, 39, 24, 14);
    this.box(group, metal, 0, -1, 13, 4, 9, 3);
    this.mesh(group, new THREE.SphereGeometry(1, 12, 8), stone, 0, 19, 6, 12, 11, 10);
    this.box(group, darkStone, 0, 23, 13, 23, 6, 6);
    this.mesh(group, new THREE.ConeGeometry(6, 14, 6), metal, -14, 10, 1, 1, 1, 1, -.52);
    this.mesh(group, new THREE.ConeGeometry(6, 14, 6), metal, 14, 10, 1, 1, 1, 1, .52);
    this.orb(group, 0xffca69, -4, 20, 14, 2.1);
    this.orb(group, 0xffca69, 4, 20, 14, 2.1);
    return group;
  }

  private static buildBoss(bodyColor: number, glowColor: number, darkColor: number): THREE.Group {
    const group = new THREE.Group();
    this.shadow(group, 38, -43);
    const body = this.material(bodyColor, { metalness: .22, roughness: .52, emissive: darkColor });
    const dark = this.material(darkColor, { metalness: .18, roughness: .6 });
    const gold = this.material(glowColor, { metalness: .46, roughness: .3, emissive: glowColor });
    this.mesh(group, new THREE.CylinderGeometry(19, 35, 43, 8), body, 0, -15, 2);
    this.box(group, dark, 0, -7, 15, 44, 31, 9);
    this.box(group, gold, 0, -9, 21, 8, 14, 3);
    this.mesh(group, new THREE.SphereGeometry(1, 14, 10), body, 0, 21, 6, 20, 18, 13);
    this.mesh(group, new THREE.ConeGeometry(11, 20, 7), gold, -18, 34, 2, 1, 1, 1, -.42);
    this.mesh(group, new THREE.ConeGeometry(11, 20, 7), gold, 18, 34, 2, 1, 1, 1, .42);
    this.mesh(group, new THREE.TorusGeometry(34, 3, 8, 32), gold, 0, 15, -8, 1, .72, .23, .08);
    this.mesh(group, new THREE.SphereGeometry(1, 12, 8), this.basic(glowColor), -7, 22, 18, 3, 2, 1);
    this.mesh(group, new THREE.SphereGeometry(1, 12, 8), this.basic(glowColor), 7, 22, 18, 3, 2, 1);
    this.orb(group, glowColor, 0, -7, 23, 5);
    return group;
  }

  private static buildNpc(palette: [number, number, number], lit: boolean): THREE.Group {
    const [robeColor, trimColor, faceColor] = palette;
    const group = new THREE.Group();
    this.shadow(group, 20, -38);
    const robe = this.material(robeColor, { roughness: .86 });
    const trim = this.material(trimColor, { metalness: .3, roughness: .5, emissive: lit ? trimColor : 0x000000 });
    const face = this.material(faceColor, { roughness: .66 });
    this.mesh(group, new THREE.CylinderGeometry(10, 22, 45, 9), robe, 0, -16, 1);
    this.mesh(group, new THREE.CylinderGeometry(20, 22, 5, 9), trim, 0, -35, 2);
    this.mesh(group, new THREE.SphereGeometry(1, 14, 10), face, 0, 18, 7, 12, 14, 10);
    this.mesh(group, new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * .54), robe, 0, 24, 6, 15, 13, 12);
    this.mesh(group, new THREE.CylinderGeometry(17, 18, 3, 10), trim, 0, 31, 7);
    this.box(group, trim, -16, -2, 5, 7, 22, 7, -.3);
    this.box(group, face, 15, -2, 5, 7, 20, 7, .3);
    const eye = this.basic(0x1b2730);
    this.mesh(group, new THREE.SphereGeometry(1, 7, 5), eye, -4, 19, 16, 1.3, 1.8, 1);
    this.mesh(group, new THREE.SphereGeometry(1, 7, 5), eye, 4, 19, 16, 1.3, 1.8, 1);
    this.mesh(group, new THREE.BoxGeometry(9, 12, 5), trim, 19, -6, 11);
    this.orb(group, lit ? 0xffe095 : 0xf3bd62, 19, -5, 15, 4.2);
    return group;
  }

  private static buildInteractable(kind: InteractiveModelKind, lit: boolean): THREE.Group {
    if (kind === 'npc') return this.buildNpc(NPC_PALETTES[0], lit);
    if (kind === 'platform') return this.buildPlatform(lit);
    const group = new THREE.Group();
    this.shadow(group, kind === 'chest' ? 26 : 22, -36);
    const stone = this.material(kind === 'valve' ? 0x527681 : 0x75664f, { roughness: .86 });
    const dark = this.material(0x303d3c, { metalness: .18, roughness: .6 });
    const metal = this.material(kind === 'rune' ? 0x8bcfc5 : 0xd6a45b, { metalness: .56, roughness: .32, emissive: lit ? 0x5abeb5 : 0x000000 });
    const activeGlow = lit ? (kind === 'rune' ? 0x9fffea : 0xffdf8a) : (kind === 'rune' ? 0x5da99d : 0xeebc66);

    if (kind === 'chest') {
      this.box(group, dark, 0, -13, 0, 50, 29, 26);
      this.box(group, stone, 0, -10, 3, 46, 24, 23);
      this.box(group, metal, 0, 2, 0, 50, 5, 27);
      this.box(group, metal, -18, -13, 15, 5, 28, 3);
      this.box(group, metal, 18, -13, 15, 5, 28, 3);
      this.box(group, stone, 0, 7, 0, 48, 9, 28, -.06);
      this.orb(group, lit ? 0xffdf8a : 0xf3bd62, 0, -2, 18, 3.8);
      return group;
    }

    if (kind === 'valve') {
      this.mesh(group, new THREE.CylinderGeometry(15, 20, 34, 7), stone, 0, -19, 0);
      this.box(group, metal, 0, -1, 6, 24, 9, 10);
      this.mesh(group, new THREE.TorusGeometry(19, 3.2, 8, 24), metal, 0, 17, 11, 1, 1, .45, .08);
      this.box(group, dark, 0, 17, 15, 35, 5, 5, .35);
      this.box(group, dark, 0, 17, 16, 5, 35, 5, -.3);
      this.orb(group, activeGlow, 0, 17, 18, 3.3);
      return group;
    }

    if (kind === 'rune') {
      this.mesh(group, new THREE.CylinderGeometry(16, 21, 24, 7), stone, 0, -27, 0);
      this.box(group, dark, 0, 5, 3, 46, 56, 12);
      this.box(group, stone, 0, 6, 6, 39, 49, 12);
      this.box(group, metal, 0, 8, 14, 4, 29, 3, .28);
      this.box(group, metal, 0, 8, 15, 24, 4, 3, -.4);
      this.mesh(group, new THREE.TorusGeometry(12, 2.1, 7, 24), metal, 0, 7, 16, 1, 1, .3);
      this.orb(group, activeGlow, 0, 7, 18, 4.4);
      return group;
    }

    // A switch is a small lantern shrine with a hinged brass lever.
    this.mesh(group, new THREE.CylinderGeometry(14, 19, 33, 7), stone, 0, -21, 0);
    this.mesh(group, new THREE.CylinderGeometry(19, 21, 6, 8), dark, 0, -38, 0);
    this.box(group, metal, 0, -1, 7, 6, 24, 6, -.28);
    this.mesh(group, new THREE.SphereGeometry(1, 10, 8), metal, 0, 14, 8, 10, 7, 8);
    this.mesh(group, new THREE.TorusGeometry(18, 2.2, 7, 24), metal, 0, 14, 2, 1, 1, .28);
    this.orb(group, activeGlow, 0, 15, 16, 5.1);
    return group;
  }

  private static buildPlatform(lit = true): THREE.Group {
    const group = new THREE.Group();
    this.shadow(group, 50, -28);
    const stone = this.material(0x527d83, { roughness: .72 });
    const edge = this.material(0x8edbd5, { metalness: .38, roughness: .34, emissive: lit ? 0x357e79 : 0x000000 });
    this.box(group, edge, 0, -2, 0, 112, 14, 62);
    this.box(group, stone, 0, 4, 2, 104, 15, 56);
    this.box(group, edge, 0, 12, 4, 70, 3, 38);
    for (const x of [-38, 38]) {
      this.mesh(group, new THREE.ConeGeometry(8, 26, 6), edge, x, -20, -2);
    }
    this.mesh(group, new THREE.TorusGeometry(17, 2, 7, 24), edge, 0, 14, 16, 1, .72, .25);
    return group;
  }

  private static buildGate(): THREE.Group {
    const group = new THREE.Group();
    this.shadow(group, 49, -73);
    const stone = this.material(0x6e6656, { roughness: .88 });
    const dark = this.material(0x1d2b30, { roughness: .7 });
    const trim = this.material(0xe3b85f, { metalness: .54, roughness: .33, emissive: 0x6b4213 });
    this.box(group, stone, -41, -4, 0, 22, 130, 25);
    this.box(group, stone, 41, -4, 0, 22, 130, 25);
    this.box(group, stone, 0, 57, 0, 104, 24, 28);
    this.box(group, trim, 0, 65, 15, 72, 5, 3);
    this.box(group, dark, 0, -10, -2, 59, 91, 8);
    this.mesh(group, new THREE.TorusGeometry(34, 3, 8, 30), trim, 0, -7, 13, 1, 1.25, .3);
    this.mesh(group, new THREE.TorusGeometry(21, 2, 7, 24), trim, 0, -7, 15, 1, 1.2, .3);
    this.orb(group, 0xffd77e, 0, -6, 19, 6);
    return group;
  }

  private static buildExit(): THREE.Group {
    const group = new THREE.Group();
    this.shadow(group, 34, -81);
    const stone = this.material(0x625b4c, { roughness: .88 });
    const gold = this.material(0xeac16c, { metalness: .4, roughness: .3, emissive: 0x6b4b19 });
    const portal = this.material(0x0a2228, { roughness: .28, emissive: 0x12343a });
    this.mesh(group, new THREE.CylinderGeometry(10, 15, 176, 8), stone, -33, -1, 0);
    this.mesh(group, new THREE.CylinderGeometry(10, 15, 176, 8), stone, 33, -1, 0);
    this.mesh(group, new THREE.CylinderGeometry(13, 13, 76, 9), stone, 0, 80, 0, 1, 1, 1, Math.PI / 2);
    this.mesh(group, new THREE.TorusGeometry(47, 5, 9, 32), gold, 0, 4, 9, 1, 1.86, .45);
    const inset = new THREE.Mesh(new THREE.CircleGeometry(1, 36), portal);
    inset.position.set(0, -4, -2);
    inset.scale.set(29, 66, 1);
    group.add(inset);
    this.mesh(group, new THREE.TorusGeometry(36, 2, 7, 28), gold, 0, 4, 12, 1, 1.82, .45);
    this.orb(group, 0xf3c970, 0, 56, 14, 4.2);
    return group;
  }

  private static buildGem(color: number, glow: number): THREE.Group {
    const group = new THREE.Group();
    this.shadow(group, 17, -25);
    this.mesh(group, new THREE.OctahedronGeometry(17, 0), this.material(color, { metalness: .3, roughness: .24, emissive: color }), 0, 0, 5, .82, 1.18, .64, .18);
    this.mesh(group, new THREE.OctahedronGeometry(8, 0), this.basic(glow), 0, 0, 12, .68, 1.1, .42, -.18);
    this.mesh(group, new THREE.TorusGeometry(18, 1.5, 6, 24), this.material(glow, { metalness: .4, emissive: color }), 0, 0, 1, 1, .8, .25, .16);
    return group;
  }

  private static buildChaserRock(): THREE.Group {
    const group = new THREE.Group();
    this.shadow(group, 35, -31);
    const rock = this.material(0x934d3e, { roughness: .95 });
    const edge = this.material(0xd28c56, { metalness: .12, roughness: .6 });
    this.mesh(group, new THREE.DodecahedronGeometry(31, 0), rock, 0, 0, 1, 1.16, 1, .8, .14);
    this.mesh(group, new THREE.TorusGeometry(30, 2, 7, 22), edge, 0, 0, 16, 1, .94, .35, .14);
    this.mesh(group, new THREE.ConeGeometry(5, 21, 5), edge, 3, -2, 19, 1, 1, .5, -.44);
    this.orb(group, 0xf0a05c, 13, 8, 20, 4.2);
    return group;
  }

  private static disposeModel(model: THREE.Group): void {
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
  }
}
