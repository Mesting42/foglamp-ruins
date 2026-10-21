import type { GameSettings } from '../data/types';
import { syncDeviceLayout, usesTouchLayout } from './DeviceLayout';

export interface TouchState {
  x: number;
  y: number;
  dash: boolean;
  lamp: boolean;
  interact: boolean;
  pause: boolean;
}

export class TouchControls {
  private shell?: HTMLElement;
  private stick?: HTMLElement;
  private knob?: HTMLElement;
  private pointerId: number | null = null;
  private origin = { x: 0, y: 0 };
  private vector = { x: 0, y: 0 };
  private buttons = { dash: false, lamp: false, interact: false, pause: false };
  private handlers: Array<() => void> = [];
  private suspended = false;
  private orientationDismissed = false;
  enabled = false;

  constructor(private root: HTMLElement) {}

  mount(settings: GameSettings, callbacks: { pause: () => void }): void {
    this.dispose();
    syncDeviceLayout();
    this.enabled = usesTouchLayout();
    if (!this.enabled) return;
    const shell = document.createElement('div');
    shell.className = 'touch-controls interactive';
    shell.innerHTML = '<div class="stick-zone" aria-label="移动摇杆"><div class="stick-knob"></div></div><div class="touch-actions"><button class="touch-btn" data-action="dash" aria-label="冲刺">冲刺</button><button class="touch-btn lamp" data-action="lamp" aria-label="使用雾灯">雾灯</button><button class="touch-btn" data-action="interact" aria-label="互动">互动</button><button class="touch-btn" data-action="pause" aria-label="暂停">Ⅱ</button></div>';
    this.shell = shell;
    shell.style.setProperty('--joystick-scale', String(settings.joystickSize / 100));
    (shell.querySelector('.touch-actions') as HTMLElement).style.opacity = String(settings.buttonOpacity / 100);
    const orientation = document.createElement('aside');
    orientation.className = 'orientation-hint' + (this.orientationDismissed ? ' hidden' : '');
    orientation.setAttribute('aria-label', '手机游玩方向建议');
    orientation.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M3 10a9 9 0 0 1 3-5M3 5v5h5m13 4a9 9 0 0 1-3 5m3 0v-5h-5"/></svg><div><strong>建议横屏游玩</strong><span>双手操作，前方视野更开阔</span></div><button type="button" class="landscape-action" aria-label="全屏并尝试横屏游玩">横屏</button><button type="button" class="orientation-dismiss" aria-label="保持竖屏游玩">×</button>';
    shell.appendChild(orientation);
    this.on(orientation.querySelector('.orientation-dismiss')!, 'click', (event) => {
      event.preventDefault(); event.stopPropagation();
      this.orientationDismissed = true; orientation.classList.add('hidden');
    });
    this.on(orientation.querySelector('.landscape-action')!, 'click', (event) => {
      event.preventDefault(); event.stopPropagation(); void this.requestLandscape(orientation);
    });
    this.root.appendChild(shell);
    this.stick = shell.querySelector('.stick-zone') ?? undefined;
    this.knob = shell.querySelector('.stick-knob') ?? undefined;
    if (this.stick) {
      this.stick.style.opacity = String(settings.joystickOpacity / 100);
      this.on(this.stick, 'pointerdown', this.beginStick);
      this.on(this.stick, 'pointermove', this.moveStick);
      this.on(this.stick, 'pointerup', this.endStick);
      this.on(this.stick, 'pointercancel', this.endStick);
      this.on(this.stick, 'lostpointercapture', this.endStick);
    }
    shell.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
      const action = button.dataset.action as keyof TouchState;
      let pressedPointer: number | null = null;
      this.on(button, 'pointerdown', (event) => {
        if (this.suspended || pressedPointer !== null) return;
        event.preventDefault(); event.stopPropagation();
        pressedPointer = (event as PointerEvent).pointerId;
        button.dataset.pressedPointer = String(pressedPointer);
        button.setPointerCapture(pressedPointer);
        button.classList.add('active');
        if (action === 'pause') { callbacks.pause(); return; }
        this.buttons[action as 'dash' | 'lamp' | 'interact'] = true;
      });
      const release = (event: Event) => {
        if (pressedPointer !== (event as PointerEvent).pointerId) return;
        event.preventDefault(); pressedPointer = null; button.classList.remove('active');
        delete button.dataset.pressedPointer;
        if (action !== 'pause') this.buttons[action as 'dash' | 'lamp' | 'interact'] = false;
      };
      this.on(button, 'pointerup', release); this.on(button, 'pointercancel', release);
      this.on(button, 'lostpointercapture', release);
    });
    this.on(window, 'blur', () => this.reset());
    this.on(window, 'resize', () => this.reset());
    this.on(document, 'visibilitychange', () => { if (document.hidden) this.reset(); });
    this.setSuspended(this.suspended);
  }

  get state(): TouchState {
    return this.suspended
      ? { x: 0, y: 0, dash: false, lamp: false, interact: false, pause: false }
      : { ...this.vector, ...this.buttons, pause: false };
  }

  setSuspended(suspended: boolean): void {
    this.suspended = suspended;
    this.reset();
    this.shell?.classList.toggle('hidden', suspended);
    if (this.shell) this.shell.inert = suspended;
  }

  reset(): void {
    const pointerId = this.pointerId;
    this.pointerId = null;
    this.vector = { x: 0, y: 0 };
    this.buttons = { dash: false, lamp: false, interact: false, pause: false };
    if (pointerId !== null && this.stick?.hasPointerCapture(pointerId)) this.stick.releasePointerCapture(pointerId);
    if (this.knob) this.knob.style.transform = '';
    this.shell?.querySelectorAll<HTMLElement>('[data-pressed-pointer]').forEach((button) => {
      const id = Number(button.dataset.pressedPointer);
      if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
    });
    this.shell?.querySelectorAll('.active').forEach((button) => button.classList.remove('active'));
  }

  dispose(): void {
    this.reset();
    this.handlers.forEach((remove) => remove()); this.handlers = [];
    this.root.querySelector('.touch-controls')?.remove();
    this.shell = undefined;
    this.stick = undefined; this.knob = undefined; this.pointerId = null;
    this.vector = { x: 0, y: 0 }; this.buttons = { dash: false, lamp: false, interact: false, pause: false };
  }

  private beginStick = (raw: Event): void => {
    const event = raw as PointerEvent;
    if (this.suspended || this.pointerId !== null) return;
    event.preventDefault(); event.stopPropagation(); this.pointerId = event.pointerId;
    this.stick?.setPointerCapture(event.pointerId);
    const rect = this.stick!.getBoundingClientRect();
    this.origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.applyStick(event.clientX, event.clientY);
  };
  private moveStick = (raw: Event): void => {
    const event = raw as PointerEvent;
    if (this.pointerId !== event.pointerId) return;
    event.preventDefault(); this.applyStick(event.clientX, event.clientY);
  };
  private endStick = (raw: Event): void => {
    if (this.pointerId !== (raw as PointerEvent).pointerId) return;
    this.pointerId = null; this.vector = { x: 0, y: 0 };
    if (this.knob) this.knob.style.transform = '';
  };
  private applyStick(clientX: number, clientY: number): void {
    const rect = this.stick!.getBoundingClientRect();
    const limit = rect.width * .35;
    let dx = clientX - this.origin.x, dy = clientY - this.origin.y;
    const length = Math.hypot(dx, dy);
    if (length > limit) { dx = dx / length * limit; dy = dy / length * limit; }
    this.vector = { x: dx / limit, y: dy / limit };
    if (this.knob) {
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
  }
  private async requestLandscape(hint: HTMLElement): Promise<void> {
    const button = hint.querySelector<HTMLButtonElement>('.landscape-action')!;
    button.disabled = true;
    try {
      const host = document.getElementById('game-shell');
      if (!document.fullscreenElement && host?.requestFullscreen) await host.requestFullscreen();
      const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
      if (orientation.lock) await orientation.lock('landscape');
    } catch {
      // Browsers that cannot lock orientation keep the fully playable portrait layout.
    } finally {
      button.disabled = false;
      if (window.innerHeight > window.innerWidth) {
        hint.querySelector('span')!.textContent = '请横转手机，也可继续竖屏游玩';
      }
    }
  }
  private on(element: EventTarget, event: string, handler: EventListener): void {
    element.addEventListener(event, handler, { passive: false });
    this.handlers.push(() => element.removeEventListener(event, handler));
  }
}
