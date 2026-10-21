let hybridInput: 'mouse' | 'touch' | undefined;

function isMobilePlatform(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Input capability decides the controls; window size only decides their arrangement. */
export function usesTouchLayout(): boolean {
  if (isMobilePlatform()) return true;
  if (hybridInput) return hybridInput === 'touch';
  if (window.matchMedia('(pointer: fine) and (hover: hover)').matches) return false;
  return window.matchMedia('(pointer: coarse)').matches ||
    (navigator.maxTouchPoints > 0 && !window.matchMedia('(any-pointer: fine)').matches);
}

export function syncDeviceLayout(): void {
  const root = document.documentElement;
  const touch = usesTouchLayout();
  const changed = root.classList.contains('touch-layout') !== touch;
  root.classList.toggle('touch-layout', touch);
  root.classList.toggle('phone-portrait', touch && window.innerWidth <= 600 && window.innerHeight > window.innerWidth);
  if (changed) window.dispatchEvent(new Event('foglamp:layoutchange'));
}

export function observeDeviceLayout(): void {
  syncDeviceLayout();
  window.addEventListener('resize', syncDeviceLayout, { passive: true });
  window.addEventListener('orientationchange', syncDeviceLayout, { passive: true });
  window.visualViewport?.addEventListener('resize', syncDeviceLayout, { passive: true });
  window.matchMedia('(pointer: coarse)').addEventListener('change', syncDeviceLayout);
  window.matchMedia('(pointer: fine) and (hover: hover)').addEventListener('change', syncDeviceLayout);
  // Convertible PCs can switch inputs without a reload. Phones/tablets retain their touch layout.
  window.addEventListener('pointerdown', (event) => {
    if (isMobilePlatform() || !['mouse', 'touch', 'pen'].includes(event.pointerType)) return;
    hybridInput = event.pointerType === 'mouse' ? 'mouse' : 'touch';
    syncDeviceLayout();
  }, { passive: true });
  window.addEventListener('keydown', (event) => {
    if (isMobilePlatform() || event.target instanceof HTMLElement && event.target.closest('input,select,textarea')) return;
    hybridInput = 'mouse'; syncDeviceLayout();
  });
}
