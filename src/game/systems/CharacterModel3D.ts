import * as THREE from 'three';

const MODEL_VIEW_SIZE = 112;
const MODEL_ANCHOR = MODEL_VIEW_SIZE / 2;

export class CharacterModel3D {
  readonly available: boolean;
  private renderer?: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(0, 1, 1, 0, 1, 500);
  private character = new THREE.Group();
  private robe?: THREE.Group;
  private leftLeg?: THREE.Group;
  private rightLeg?: THREE.Group;
  private lantern?: THREE.Group;
  private quality: string;
  private time = 0;
  private lastTransform = '';

  constructor(private host: HTMLElement, quality: string) {
    this.quality = quality;
    try {
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: quality !== 'low', powerPreference: 'low-power' });
      this.renderer.domElement.className = 'hero3d-canvas';
      this.renderer.domElement.setAttribute('aria-hidden', 'true');
      this.renderer.domElement.style.visibility = 'hidden';
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.18;
      this.renderer.shadowMap.enabled = false;
      this.host.appendChild(this.renderer.domElement);
      this.scene.add(new THREE.HemisphereLight(0xd6fff4, 0x233641, 2.1));
      const key = new THREE.DirectionalLight(0xffe1a1, 2.2);
      key.position.set(-40, 90, 100);
      this.scene.add(key);
      this.scene.add(this.character);
      this.character.visible = false;
      this.buildCharacter();
      this.resize();
      this.available = true;
    } catch {
      this.renderer?.dispose();
      this.renderer?.domElement.remove();
      this.renderer = undefined;
      this.available = false;
    }
  }

  setLanternColor(color: number): void {
    this.lantern?.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshBasicMaterial) object.material.color.setHex(color);
    });
  }

  update(frame: { x: number; y: number; cameraX: number; cameraY: number; zoom: number; facingLeft: boolean; speed: number; dashing: boolean; alpha: number; delta?: number }): void {
    if (!this.renderer) return;
    const zoom = Math.max(.52, Math.min(2.2, frame.zoom));
    const screenX = (frame.x - frame.cameraX) * zoom;
    const screenY = (frame.y - frame.cameraY) * zoom;
    this.time += Math.min(.1, frame.delta ?? 1 / 60);
    if (frame.alpha <= .58) {
      this.character.visible = false;
      this.renderer.domElement.style.visibility = 'hidden';
      return;
    }
    this.character.visible = true;
    this.renderer.domElement.style.visibility = 'visible';
    const moving = frame.speed > 8;
    const bob = moving ? Math.sin(this.time * (frame.dashing ? 23 : 15)) * (frame.dashing ? 4 : 2.5) : Math.sin(this.time * 2.4) * .8;
    this.character.position.set(MODEL_ANCHOR, 27 + bob, 0);
    this.character.scale.set(frame.facingLeft ? -1.18 : 1.18, 1.18, 1.18);
    const transform = `translate3d(${screenX - MODEL_ANCHOR * zoom}px, ${screenY - MODEL_ANCHOR * zoom}px, 0) scale(${zoom})`;
    if (transform !== this.lastTransform) {
      this.lastTransform = transform;
      this.renderer.domElement.style.transform = transform;
    }
    if (this.robe) this.robe.rotation.z = moving ? Math.sin(this.time * (frame.dashing ? 20 : 12)) * .035 : Math.sin(this.time * 1.8) * .018;
    if (this.leftLeg) this.leftLeg.rotation.z = moving ? Math.sin(this.time * 15) * .28 : 0;
    if (this.rightLeg) this.rightLeg.rotation.z = moving ? -Math.sin(this.time * 15) * .28 : 0;
    if (this.lantern) {
      this.lantern.position.y = 28 + Math.sin(this.time * (moving ? 12 : 2.2)) * (moving ? 2 : 1);
      this.lantern.rotation.z = moving ? Math.sin(this.time * 12) * .12 : Math.sin(this.time * 2.4) * .035;
    }
    this.renderer.render(this.scene, this.camera);
  }

  setQuality(quality: string): void {
    if (quality === this.quality) return;
    this.quality = quality;
    this.resize();
  }

  resize = (): void => {
    if (!this.renderer) return;
    const ratio = Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 1.25);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(MODEL_VIEW_SIZE, MODEL_VIEW_SIZE, false);
    this.camera.left = 0;
    this.camera.right = MODEL_VIEW_SIZE;
    this.camera.top = MODEL_VIEW_SIZE;
    this.camera.bottom = 0;
    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  };

  destroy(): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = undefined;
  }

  private buildCharacter(): void {
    const mat = (color: number, roughness = .78, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
    const skin = mat(0xf2c79d);
    const cloak = mat(0x167f99);
    const cloakLight = mat(0x58c9cf);
    const dark = mat(0x183447);
    const leather = mat(0x965437);
    const gold = mat(0xe9b756, .48, .3);
    const boots = mat(0x28333a);
    const eye = new THREE.MeshBasicMaterial({ color: 0x15252b });
    const glow = new THREE.MeshBasicMaterial({ color: 0xffc957, toneMapped: false });
    const glowHalo = new THREE.MeshBasicMaterial({ color: 0xffb53d, transparent: true, opacity: .3, depthWrite: false, toneMapped: false });
    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], scale?: [number, number, number]) => {
      const object = new THREE.Mesh(geometry, material);
      object.position.set(...position);
      if (scale) object.scale.set(...scale);
      this.character.add(object);
      return object;
    };
    const cylinder = (top: number, bottom: number, height: number, material: THREE.Material, y: number, radial = 9) =>
      mesh(new THREE.CylinderGeometry(top, bottom, height, radial, 1), material, [0, y, 0]);

    mesh(new THREE.SphereGeometry(15, 12, 8), new THREE.MeshBasicMaterial({ color: 0x071317, transparent: true, opacity: .34, depthWrite: false }), [0, 4, -9], [1.22, .24, .6]);
    mesh(new THREE.BoxGeometry(15, 18, 11), leather, [-13, 26, -7]);
    mesh(new THREE.BoxGeometry(3, 23, 3), gold, [-6, 27, 1]).rotation.z = -.28;
    const robe = new THREE.Group();
    robe.position.set(0, 0, 1);
    this.character.add(robe);
    const robeBody = new THREE.Mesh(new THREE.CylinderGeometry(13, 22, 36, 9, 1), cloak);
    robeBody.position.y = 26;
    robe.add(robeBody);
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(21, 22, 5, 9), cloakLight);
    hem.position.y = 9;
    robe.add(hem);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, 4, 10), leather);
    belt.position.y = 21;
    robe.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 3), gold);
    buckle.position.set(0, 21, 17);
    robe.add(buckle);
    this.robe = robe;

    const leftLeg = new THREE.Group(); leftLeg.position.set(-7, 8, 3); this.character.add(leftLeg); this.leftLeg = leftLeg;
    const rightLeg = new THREE.Group(); rightLeg.position.set(7, 8, 3); this.character.add(rightLeg); this.rightLeg = rightLeg;
    for (const [leg, direction] of [[leftLeg, -1], [rightLeg, 1]] as Array<[THREE.Group, number]>) {
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5, 11, 7), dark); shin.position.y = -2; leg.add(shin);
      const boot = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 6), boots); boot.position.set(direction * 1.5, -8, 3); boot.scale.set(1.2, .65, 1.4); leg.add(boot);
    }

    const hood = mesh(new THREE.SphereGeometry(13, 10, 8), dark, [0, 47, 0], [1.08, 1.1, .9]);
    hood.rotation.x = -.15;
    mesh(new THREE.SphereGeometry(9.3, 12, 9), skin, [0, 47, 8], [1, 1.12, .78]);
    mesh(new THREE.SphereGeometry(10, 9, 6, 0, Math.PI * 2, 0, Math.PI * .45), leather, [0, 50, 10], [1.05, .9, .62]);
    const brim = mesh(new THREE.CylinderGeometry(14, 16, 3, 9), gold, [0, 56, 8]);
    brim.rotation.x = .12;
    mesh(new THREE.ConeGeometry(9, 13, 8), cloak, [0, 63, 7]);
    mesh(new THREE.SphereGeometry(1.65, 6, 5), eye, [-3.8, 47, 15.3]);
    mesh(new THREE.SphereGeometry(1.65, 6, 5), eye, [3.8, 47, 15.3]);
    mesh(new THREE.SphereGeometry(1.2, 6, 5), gold, [0, 42.2, 15.2]);

    const armLeft = new THREE.Group(); armLeft.position.set(-14, 32, 2); this.character.add(armLeft);
    const sleeveLeft = new THREE.Mesh(new THREE.CapsuleGeometry(4.6, 13, 3, 7), cloakLight); sleeveLeft.rotation.z = -.35; sleeveLeft.position.set(0, -4, 0); armLeft.add(sleeveLeft);
    const handLeft = new THREE.Mesh(new THREE.SphereGeometry(4.2, 7, 6), skin); handLeft.position.set(-2, -12, 3); armLeft.add(handLeft);
    const armRight = new THREE.Group(); armRight.position.set(14, 32, 3); this.character.add(armRight);
    const sleeveRight = new THREE.Mesh(new THREE.CapsuleGeometry(4.6, 13, 3, 7), cloakLight); sleeveRight.rotation.z = .45; sleeveRight.position.set(2, -2, 0); armRight.add(sleeveRight);
    const handRight = new THREE.Mesh(new THREE.SphereGeometry(4.2, 7, 6), skin); handRight.position.set(7, -8, 4); armRight.add(handRight);

    const lantern = new THREE.Group();
    lantern.position.set(22, 27, 14);
    this.character.add(lantern);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(11, 14, 7), gold); lantern.add(frame);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(4.7, 8, 6), glow); glass.scale.set(.72, 1.1, .72); glass.position.z = 4; lantern.add(glass);
    const aura = new THREE.Mesh(new THREE.SphereGeometry(9, 8, 6), glowHalo); aura.position.z = 2; lantern.add(aura);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(3.5, 1.2, 5, 9, Math.PI), gold); handle.rotation.z = Math.PI; handle.position.y = 8; lantern.add(handle);
    this.lantern = lantern;
    void hood;
  }
}
