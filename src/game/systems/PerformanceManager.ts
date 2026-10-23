import Phaser from 'phaser';
import type { GameSettings } from '../data/types';

export class PerformanceManager {
  private static adaptiveTimers = new WeakMap<Phaser.Scene, any>();

  static applyScene(scene: Phaser.Scene, settings: GameSettings): void {
    const low = settings.quality === 'low';
    scene.registry.set('particleLimit', low ? 20 : settings.quality === 'medium' ? 55 : 110);
    scene.registry.set('useShadows', settings.shadows && !low);
    scene.registry.set('usePostFx', settings.postFx && settings.quality === 'high');
    scene.registry.set('useParticles', settings.particles && !low);
    const qualityCap = settings.quality === 'low' ? 1.1 : settings.quality === 'medium' ? 1.5 : 2;
    const preferred = settings.pixelRatio === 'auto' ? window.devicePixelRatio || 1 : Number(settings.pixelRatio);
    const maxResolution = Math.min(preferred, qualityCap);
    scene.registry.set('dynamicScaleEnabled', settings.dynamicScale);
    scene.registry.set('dynamicScaleMax', maxResolution);
    if (scene.game.renderer && 'resolution' in scene.game.renderer) {
      // The runtime guard above verifies the optional renderer extension.
      const renderer = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer & { resolution: number };
      if (settings.dynamicScale || !Number.isFinite(renderer.resolution)) renderer.resolution = maxResolution;
      if (!this.adaptiveTimers.has(scene)) {
        const timer = scene.time.addEvent({
          delay: 1800,
          loop: true,
          callback: () => {
            if (!scene.registry.get('dynamicScaleEnabled')) return;
            const fps = Number(scene.game.loop.actualFps ?? 0);
            if (fps <= 0) return;
            const current = Number(renderer.resolution || 1);
            const limit = Number(scene.registry.get('dynamicScaleMax') || 1);
            const next = fps < 27 ? Math.max(.75, current - .15) : fps > 56 ? Math.min(limit, current + .05) : current;
            if (Math.abs(next - current) < .04) return;
            renderer.resolution = next;
            renderer.resize(scene.scale.gameSize.width, scene.scale.gameSize.height);
          },
        });
        this.adaptiveTimers.set(scene, timer);
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.adaptiveTimers.delete(scene));
      }
    }
  }
}
