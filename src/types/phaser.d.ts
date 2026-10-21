declare namespace Phaser {
  const AUTO: number;
  const BlendModes: { SCREEN: number; ADD: number; NORMAL: number };

  class Game {
    constructor(config: any);
    registry: any;
    loop: any;
    renderer: any;
    events: any;
  }

  class Scene {
    constructor(config?: any);
    [key: string]: any;
    add: any;
    cameras: any;
    events: any;
    game: Game;
    input: any;
    load: any;
    make: any;
    physics: any;
    registry: any;
    scale: any;
    scene: any;
    time: any;
    textures: any;
    tweens: any;
  }

  namespace Types {
    namespace Core { type GameConfig = any; }
    namespace Physics { namespace Arcade { type GameObjectWithBody = any; } }
  }

  namespace GameObjects {
    class GameObject {
      constructor(scene: Scene, type?: string);
      [key: string]: any;
      scene: Scene;
      x: number;
      y: number;
      active: boolean;
      visible: boolean;
      alpha: number;
      rotation: number;
      body: any;
      destroy(fromScene?: boolean): void;
    }
    class Sprite extends GameObject {
      constructor(scene: Scene, x: number, y: number, texture?: string, frame?: string | number);
    }
    class Image extends Sprite {}
    class Container extends GameObject {
      constructor(scene: Scene, x?: number, y?: number, children?: any[]);
      add(children: any[] | any): this;
    }
    class Graphics extends GameObject {}
    class Rectangle extends GameObject {}
    class Circle extends GameObject {}
    class Arc extends GameObject {}
    class Ellipse extends GameObject {}
    class Text extends GameObject {}
  }

  namespace Physics {
    namespace Arcade {
      class Sprite extends GameObjects.Sprite {
        constructor(scene: Scene, x: number, y: number, texture?: string, frame?: string | number);
      }
      class Body {
        [key: string]: any;
        enable: boolean;
        x: number;
        y: number;
        velocity: { x: number; y: number };
        stop(): this;
        setCircle(radius: number, offsetX?: number, offsetY?: number): this;
        setCollideWorldBounds(value: boolean, bounceX?: number, bounceY?: number): this;
        setImmovable(value: boolean): this;
        setMaxVelocity(x: number, y?: number): this;
        setOffset(x: number, y: number): this;
        setSize(width: number, height: number, center?: boolean): this;
        setVelocity(x: number, y: number): this;
      }
      class StaticBody extends Body { updateFromGameObject(): this; }
    }
  }

  namespace Input {
    class Pointer {
      worldX: number;
      worldY: number;
      rightButtonDown(): boolean;
      middleButtonDown(): boolean;
      leftButtonDown(): boolean;
    }
    namespace Keyboard {
      class Key { isDown: boolean; isUp: boolean; }
      function JustDown(key: Key): boolean;
      const KeyCodes: Record<string, number>;
    }
  }

  namespace Math {
    class Vector2 {
      constructor(x?: number, y?: number);
      x: number;
      y: number;
      set(x: number, y?: number): this;
    }
    function Clamp(value: number, min: number, max: number): number;
    function Between(min: number, max: number): number;
    namespace Distance { function Between(x1: number, y1: number, x2: number, y2: number): number; }
    namespace Angle { function Between(x1: number, y1: number, x2: number, y2: number): number; }
  }

  namespace Renderer { namespace WebGL { class WebGLRenderer { resolution: number; resize(width: number, height: number): void; } } }
  namespace Scale {
    const RESIZE: number;
    const CENTER_BOTH: number;
    namespace Events { const RESIZE: string; }
  }
  namespace Scenes { namespace Events { const SHUTDOWN: string; const RESUME: string; } }
}

declare module 'phaser' {
  export = Phaser;
}
