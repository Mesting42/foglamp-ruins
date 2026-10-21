import type { GameSettings, KeyBindings, LevelDefinition } from '../data/types';
import { LEVELS } from '../data/levels';
import { DEFAULT_KEYS, SettingsManager } from '../systems/SettingsManager';
import { SaveManager } from '../systems/SaveManager';
import { MEMORIES } from '../data/adventure';

export interface HUDState {
  health: number;
  maxHealth: number;
  fragments: number;
  stageIndex: number;
  objective: string;
  timer?: string;
  bossHealth?: number;
  bossMaxHealth?: number;
  bossCue?: string;
}

export class GameUI {
  private unsubscribe: () => void;
  private promptMessage: string | undefined;
  private abilityProgress = '';
  constructor(private root: HTMLElement, private settings: SettingsManager, private save: SaveManager) {
    this.unsubscribe = settings.subscribe((value) => this.applyPreferences(value));
    this.applyPreferences(settings.value);
  }

  destroy(clear = true): void {
    this.unsubscribe();
    this.root.querySelectorAll('.pause-modal').forEach((overlay) => overlay.remove());
    if (clear) this.root.innerHTML = '';
    this.root.classList.remove('tutorial-active', 'has-boss');
  }

  showMainMenu(actions: {
    continue: () => void; newGame: () => void; levels: () => void; credits: () => void;
  }): void {
    const canContinue = this.save.canContinue;
    this.root.innerHTML = '<section class="ui-layer screen-shade"><div class="menu-card"><img class="brand-mark" src="/assets/brand/lantern-mark.svg" alt="雾灯图案"><div class="eyebrow">A LANTERN THROUGH THE FOG</div><h1 class="title">雾灯遗迹</h1><p class="subtitle">五枚失落灯芯 · 一座沉睡灯塔</p><p class="body-copy">雾吞没了山谷，也吞没了通往家的路。<br>提起旧灯，沿着微光穿过遗迹。</p><div class="menu-actions"><button class="btn primary" data-action="continue"' + (canContinue ? '' : ' disabled') + '>继续旅程</button><button class="btn" data-action="new">开始新旅程</button><button class="btn" data-action="levels">选择关卡</button><div class="row"><button class="btn ghost" data-action="settings">设置</button><button class="btn ghost" data-action="credits">素材与许可</button></div></div><div class="menu-footer"><span>方向键 / WASD 移动 · 空格冲刺</span><span>雾灯：F / 鼠标右键 · 互动：E</span></div></div></section>';
    this.bind('[data-action=continue]', actions.continue);
    this.bind('[data-action=new]', actions.newGame);
    this.bind('[data-action=levels]', actions.levels);
    this.bind('[data-action=credits]', actions.credits);
    this.bind('[data-action=settings]', () => this.showSettings(() => this.showMainMenu(actions)));
    const journal = document.createElement('button');
    journal.className = 'btn ghost'; journal.textContent = '旅途手记 · ' + this.save.value.journal.length + '/5 段记忆';
    journal.addEventListener('click', () => this.showJournal(() => this.showMainMenu(actions)));
    this.root.querySelector('.menu-actions')!.appendChild(journal);
    const progress = document.createElement('div'); progress.className = 'wick-progress';
    progress.setAttribute('aria-label', '中央灯塔已点亮 ' + this.save.value.fragments + ' 枚灯芯');
    progress.innerHTML = Array.from({ length: 5 }, (_, i) => '<span class="' + (i < this.save.value.fragments ? 'lit' : '') + '"></span>').join('');
    this.root.querySelector('.subtitle')!.after(progress);
  }

  showLevelSelect(unlocked: number, onChoose: (index: number) => void, onBack: () => void): void {
    const cards = LEVELS.map((level, index) => {
      const locked = index > unlocked;
      return '<button class="btn level-card' + (locked ? ' locked' : '') + '" data-level="' + index + '"' + (locked ? ' disabled' : '') + '><span class="number">' + String(index + 1).padStart(2, '0') + '</span><span>' + level.name + (locked ? ' · 未解锁' : '') + '</span><span class="meta">' + level.subtitle + ' · ' + level.duration + '</span></button>';
    }).join('');
    this.root.innerHTML = '<section class="ui-layer screen-shade"><div class="menu-card"><div class="eyebrow">已点亮的路标</div><h2 class="title" style="font-size:42px">选择关卡</h2><p class="body-copy">通关后会解锁下一段旅程。已收集的碎片会保留。</p><div class="level-grid">' + cards + '</div><div class="modal-actions"><button class="btn small ghost" data-action="back">返回</button></div></div></section>';
    this.root.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((button) => button.addEventListener('click', () => onChoose(Number(button.dataset.level))));
    this.bind('[data-action=back]', onBack);
  }

  showHUD(level: LevelDefinition, actions: { pause: () => void; lamp: () => void; dash: () => void; interact: () => void; skipTutorial: () => void }): void {
    this.abilityProgress = '';
    this.root.innerHTML = '<div class="ui-layer"><div class="hud"><div class="hud-panel"><div class="hud-stage"></div><div class="hud-objective"></div></div><div class="hud-right"><div class="hud-panel chip hud-health" aria-label="生命值"></div><div class="hud-panel chip hud-fragments" aria-label="灯芯收集"></div><div class="hud-panel chip hud-timer hidden"></div><button class="hud-button" data-action="lamp" aria-label="使用雾灯"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.9 4.9l2.8 2.8m8.6 8.6 2.8 2.8m0-14.2-2.8 2.8m-8.6 8.6-2.8 2.8"/><circle cx="12" cy="12" r="4"/></svg></button><button class="hud-button" data-action="pause" aria-label="暂停"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg></button></div></div><div class="toast hidden" role="status" aria-live="polite"></div><div class="prompt hidden"></div><aside class="tutorial-guide hidden" aria-live="polite" aria-atomic="true"><div class="tutorial-heading"><span class="tutorial-mark" aria-hidden="true">01</span><div class="tutorial-heading-copy"><span class="tutorial-eyebrow">雾灯练习 · 初次点灯</span><h2 class="tutorial-title"></h2></div><span class="tutorial-count"></span></div><p class="tutorial-copy"></p><div class="tutorial-progress" role="progressbar" aria-label="新手引导进度" aria-valuemin="1" aria-valuemax="4" aria-valuenow="1"><span></span></div><div class="tutorial-footer"><span>完成操作后自动继续</span><button class="tutorial-skip" type="button" data-action="skip-tutorial">跳过引导</button></div></aside><div class="boss-hud hidden" style="position:absolute;left:50%;top:max(76px,calc(env(safe-area-inset-top) + 66px));transform:translateX(-50%);width:min(380px,78vw);text-align:center"><div class="boss-label" style="font-size:11px;letter-spacing:.2em;color:#efb56c;margin-bottom:6px">守塔者</div><div style="height:9px;background:rgba(5,20,28,.8);border:1px solid rgba(237,190,120,.6)"><div class="boss-fill" style="height:100%;width:100%;background:linear-gradient(90deg,#b84f4c,#edbb68);transition:width .2s"></div></div></div></div>';
    this.root.classList.remove('tutorial-active');
    this.root.querySelector('.hud-right [data-action="lamp"]')?.remove();
    const toolbar = document.createElement('nav');
    toolbar.className = 'desktop-actions'; toolbar.setAttribute('aria-label', '键鼠操作');
    const icons = {
      dash: '<path d="m13 3-8 11h6l-1 7 9-12h-6l1-6Z"/>',
      lamp: '<path d="M9 6V4a3 3 0 0 1 6 0v2M7 7h10l2 13H5L7 7Zm-1 3h12M6 17h12"/><path d="M12 12v3"/>',
      interact: '<path d="M8 12V5a2 2 0 0 1 4 0v6-2a2 2 0 0 1 4 0v3-1a2 2 0 0 1 4 0v5c0 4-3 6-6 6h-2c-2 0-3-1-4-3l-4-5a2 2 0 0 1 3-2l1 1Z"/>',
    };
    toolbar.innerHTML = (['dash', 'lamp', 'interact'] as const).map(action =>
      '<button type="button" class="desktop-action ' + action + '" data-action="' + action + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + icons[action] + '</svg><span class="action-copy"><span class="action-name">' + keyLabel(action) + '</span><small class="action-status">' + (action === 'interact' ? '靠近机关' : '就绪') + '</small></span><kbd></kbd></button>'
    ).join('');
    this.root.querySelector('.ui-layer')!.appendChild(toolbar);
    this.root.querySelector('.hud-stage')!.textContent = '路标 ' + String(LEVELS.indexOf(level) + 1).padStart(2, '0') + ' / 05 · ' + level.name;
    this.root.querySelector('.hud-objective')!.textContent = level.objective;
    this.promptMessage = undefined;
    this.bind('[data-action=pause]', actions.pause);
    this.bind('[data-action=lamp]', actions.lamp);
    this.bind('[data-action=dash]', actions.dash);
    this.bind('[data-action=interact]', actions.interact);
    this.bind('[data-action=skip-tutorial]', actions.skipTutorial);
    this.applyPreferences(this.settings.value);
  }

  showTutorialStep(step: number, total: number, title: string, description: string): void {
    const guide = this.root.querySelector<HTMLElement>('.tutorial-guide');
    if (!guide) return;
    const current = Math.max(1, Math.min(total, step + 1));
    const count = guide.querySelector<HTMLElement>('.tutorial-count');
    const heading = guide.querySelector<HTMLElement>('.tutorial-title');
    const copy = guide.querySelector<HTMLElement>('.tutorial-copy');
    const progress = guide.querySelector<HTMLElement>('.tutorial-progress');
    if (count) count.textContent = String(current).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
    if (heading) heading.textContent = title;
    if (copy) copy.textContent = description;
    if (progress) {
      progress.setAttribute('aria-valuemax', String(total));
      progress.setAttribute('aria-valuenow', String(current));
      progress.querySelector('span')?.setAttribute('style', 'width:' + current / total * 100 + '%');
    }
    guide.classList.remove('hidden');
    this.root.classList.add('tutorial-active');
  }

  hideTutorial(): void {
    this.root.querySelector('.tutorial-guide')?.classList.add('hidden');
    this.root.classList.remove('tutorial-active');
  }

  updateHUD(state: HUDState): void {
    const objective = this.root.querySelector('.hud-objective');
    if (objective && objective.textContent !== state.objective) objective.textContent = state.objective;
    const health = this.root.querySelector('.hud-health');
    const fragments = this.root.querySelector('.hud-fragments');
    if (!health || !fragments) return;
    health.textContent = '生命 ' + state.health + ' / ' + state.maxHealth;
    fragments.innerHTML = '灯芯 <strong>' + state.fragments + ' / 5</strong>';
    const timer = this.root.querySelector<HTMLElement>('.hud-timer');
    if (timer) {
      timer.classList.toggle('hidden', !state.timer);
      timer.textContent = state.timer ? '崩塌 ' + state.timer : '';
    }
    this.root.classList.toggle('has-timer', !!state.timer);
    const bar = this.root.querySelector<HTMLElement>('.boss-hud');
    const fill = this.root.querySelector<HTMLElement>('.boss-fill');
    if (bar && fill) {
      const visible = state.bossHealth !== undefined && state.bossMaxHealth !== undefined;
      this.root.classList.toggle('has-boss', visible);
      bar.classList.toggle('hidden', !visible);
      if (visible) fill.style.width = Math.max(0, state.bossHealth! / state.bossMaxHealth! * 100) + '%';
      if (visible) {
        const label = bar.querySelector<HTMLElement>('.boss-label');
        if (label) { label.textContent = state.bossCue ?? '守塔者'; label.style.letterSpacing = '.04em'; label.style.fontSize = '12px'; }
        bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', state.bossCue ?? '守塔者生命');
        bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(state.bossMaxHealth)); bar.setAttribute('aria-valuenow', String(state.bossHealth));
      }
    }
  }

  showToast(message: string, duration = 2600): void {
    const toast = this.root.querySelector<HTMLElement>('.toast');
    if (!toast) return;
    toast.textContent = message; toast.classList.remove('hidden'); toast.style.opacity = '1';
    window.clearTimeout(Number(toast.dataset.timer));
    toast.dataset.timer = String(window.setTimeout(() => {
      toast.style.opacity = '0'; window.setTimeout(() => toast.classList.add('hidden'), 260);
    }, duration));
  }

  showPrompt(message?: string): void {
    this.root.classList.toggle('has-interaction', !!message);
    if (message === this.promptMessage) return;
    this.promptMessage = message;
    const interact = this.root.querySelector<HTMLElement>('.desktop-action.interact');
    interact?.classList.toggle('available', !!message);
    const status = interact?.querySelector('.action-status');
    if (status) status.textContent = message ? '可互动' : '靠近机关';
    const prompt = this.root.querySelector<HTMLElement>('.prompt');
    if (!prompt) return;
    prompt.textContent = message ?? '';
    prompt.classList.toggle('hidden', !message);
  }

  updateAbility(lamp: number, dash: number): void {
    const key = Math.ceil(lamp * 20) + ':' + Math.ceil(dash * 20);
    if (key === this.abilityProgress) return;
    this.abilityProgress = key;
    for (const [action, fraction, seconds] of [['lamp', lamp, 1.1], ['dash', dash, .8]] as const) {
      this.root.querySelectorAll<HTMLButtonElement>('[data-action="' + action + '"]').forEach(button => {
        button.classList.toggle('cooling', fraction > 0);
        button.style.setProperty('--ready', (100 * (1 - fraction)).toFixed(0) + '%');
        const status = button.querySelector('.action-status');
        if (status) { status.textContent = fraction > 0 ? '冷却 ' + (fraction * seconds).toFixed(1) + ' 秒' : '就绪'; return; }
        let label = button.querySelector<HTMLElement>('.cooldown-time');
        if (!label) { label = document.createElement('small'); label.className = 'cooldown-time'; label.setAttribute('aria-hidden', 'true'); button.appendChild(label); }
        label.textContent = fraction > 0 ? (fraction * seconds).toFixed(1) : '';
      });
    }
  }

  showPause(actions: { resume: () => void; restart: () => void; settings: () => void; levels: () => void; menu: () => void; journal: () => void }): void {
    const overlay = document.createElement('section');
    overlay.className = 'ui-layer screen-shade pause-modal';
    overlay.innerHTML = '<div class="menu-card"><div class="eyebrow">旅途暂停</div><h2 class="title" style="font-size:44px">雾中歇息</h2><p class="body-copy">灯火仍在，准备好后继续前行。</p><div class="menu-actions"><button class="btn primary" data-action="resume">继续旅程</button><button class="btn" data-action="restart">从检查点重来</button><div class="row"><button class="btn ghost" data-action="settings">设置</button><button class="btn ghost" data-action="levels">关卡</button></div><button class="btn ghost" data-action="menu">返回主菜单</button></div></div>';
    this.root.appendChild(overlay);
    const query = (selector: string, fn: () => void) => overlay.querySelector(selector)?.addEventListener('click', fn);
    query('[data-action=resume]', actions.resume); query('[data-action=restart]', actions.restart);
    query('[data-action=levels]', actions.levels); query('[data-action=menu]', actions.menu);
    query('[data-action=settings]', actions.settings);
    const journal = document.createElement('button'); journal.className = 'btn ghost'; journal.textContent = '旅途手记与灯焰';
    journal.addEventListener('click', actions.journal); overlay.querySelector('.menu-actions')!.appendChild(journal);
  }

  showJournal(onBack: () => void): void {
    const save = this.save.value;
    const cards = MEMORIES.map(memory => {
      const found = save.journal.includes(memory.id);
      const level = LEVELS[memory.level];
      const shards = level.collectibles.filter(c => c.kind === 'shard' && save.collected.includes(c.id)).length;
      const row = save.journey[level.id];
      return '<article class="memory-card' + (found ? ' discovered' : '') + '"><div class="eyebrow">' + String(memory.level + 1).padStart(2, '0') + ' · ' + level.name + '</div><h3>' + (found ? memory.title : '尚未照见的记忆') + '</h3><p>' + (found ? memory.text : '在关卡中寻找淡蓝的回声，用雾灯照见石碑，再走近阅读。') + '</p><div class="memory-meta">碎片 ' + shards + '/2 · 灯芯 ' + (save.collected.includes(level.collectibles.find(c => c.kind === 'fragment')!.id) ? '已取回' : '未取回') + '</div>' + (found ? '<button class="btn small flame-choice" data-flame="' + memory.id + '" aria-pressed="' + (save.lanternMemory === memory.id) + '"><span style="--flame:' + memory.color + '"></span>' + (save.lanternMemory === memory.id ? '正在使用' : memory.reward.replace('解锁', '使用')) + '</button>' : '') + (row ? '<p class="journey-meta">游玩 ' + formatTime(row.seconds) + ' · 雾灯 ' + row.pulses + ' 次 · 失败 ' + row.deaths + ' 次 · 完成 ' + row.completions + ' 次</p>' : '') + '</article>';
    }).join('');
    this.root.innerHTML = '<section class="ui-layer screen-shade"><div class="menu-card journal-card"><div class="journal-toolbar"><div class="eyebrow">已照见 ' + save.journal.length + ' / 5 段记忆</div><button class="btn small ghost" data-action="back-top">返回</button></div><h2 class="title" style="font-size:40px">旅途手记</h2><p class="body-copy">灯光照见的故事会留在这里。找到记忆后可更换灯焰，已收集的碎片与灯芯会持续保留。</p><div class="memory-grid">' + cards + '</div><p class="body-copy">游玩记录仅保存在本机；暂停不计时。记录从本次更新开始累计。</p><button class="btn small ghost" data-flame="">恢复琥珀灯焰</button><div class="modal-actions"><button class="btn" data-action="back">返回旅途</button></div></div></section>';
    this.bind('[data-action=back-top]', onBack); this.bind('[data-action=back]', onBack);
    this.root.querySelectorAll<HTMLButtonElement>('[data-flame]').forEach(button => button.addEventListener('click', () => {
      this.save.selectLantern(button.dataset.flame ?? ''); this.showJournal(onBack);
    }));
  }

  showGameOver(actions: { retry: () => void; menu: () => void }): void {
    this.root.innerHTML = '<section class="ui-layer screen-shade"><div class="menu-card"><div class="eyebrow">光芒暂时隐去</div><h2 class="title" style="font-size:50px">迷失在雾中</h2><p class="body-copy">灯火会在最近的检查点重新燃起。已收集的碎片不会丢失。</p><div class="menu-actions"><button class="btn primary" data-action="retry">从检查点继续</button><button class="btn ghost" data-action="menu">回到主菜单</button></div></div></section>';
    this.bind('[data-action=retry]', actions.retry); this.bind('[data-action=menu]', actions.menu);
  }

  showLevelComplete(level: LevelDefinition, actions: { next: () => void; levels: () => void }): void {
    this.root.innerHTML = '<section class="ui-layer screen-shade"><div class="menu-card"><div class="eyebrow">路标已点亮</div><h2 class="title" style="font-size:48px">' + level.name + '</h2><p class="body-copy">雾退开了一小段。前方的灯塔仍在等待，新的路标已经显现。</p><div class="menu-actions"><button class="btn primary" data-action="next">' + (LEVELS.indexOf(level) === 4 ? '点亮灯塔' : '继续前行') + '</button><button class="btn ghost" data-action="levels">查看路标</button></div></div></section>';
    this.bind('[data-action=next]', actions.next); this.bind('[data-action=levels]', actions.levels);
    const summary = document.createElement('p'); summary.className = 'body-copy';
    const memory = MEMORIES.find(m => LEVELS.indexOf(level) === m.level)!;
    const shards = level.collectibles.filter(c => c.kind === 'shard' && this.save.hasCollected(c.id)).length;
    const journey = this.save.value.journey[level.id];
    summary.textContent = '遗迹记忆 ' + (this.save.value.journal.includes(memory.id) ? '1/1' : '0/1') + ' · 碎片 ' + shards + '/2' + (journey ? ' · 本关累计游玩 ' + formatTime(journey.seconds) : '');
    this.root.querySelector('.body-copy')!.after(summary);
  }

  showEnding(onMenu: () => void, onLevels: () => void): void {
    this.root.innerHTML = '<section class="ui-layer screen-shade"><div class="menu-card"><div class="eyebrow">结局 · 雾散之后</div><h2 class="title" style="font-size:48px">山谷重新有了方向</h2><p class="body-copy">第五枚灯芯嵌入灯塔的那一刻，五道光越过山脊，照亮了失落的归途。<br><br>你留下的碎片记录了曾经的旅人，也记录了这一次没有放弃的选择。<br><br>风停了。雾灯仍亮着。</p><div class="menu-actions"><button class="btn primary" data-action="menu">回到主菜单</button><button class="btn ghost" data-action="levels">重访路标</button></div></div></section>';
    this.bind('[data-action=menu]', onMenu); this.bind('[data-action=levels]', onLevels);
  }

  showCredits(onBack: () => void): void {
    this.root.innerHTML = '<section class="ui-layer screen-shade"><div class="menu-card"><div class="eyebrow">素材与再分发许可</div><h2 class="title" style="font-size:42px">光影来自这里</h2><p class="body-copy">本项目的角色、机关、地形图样和交互图标均由项目代码以程序化几何图形原创生成。声音由浏览器 Web Audio API 合成。未使用外部美术、音频、字体、运行时 CDN 或远端素材。</p><div class="license-list"><strong>原创程序化素材</strong><br>作者：雾灯遗迹开发项目<br>许可：CC0 1.0（本项目自行提供的 SVG、几何图案与合成音效可自由复制、修改、商用及再分发，无需署名；署名欢迎但非强制）。<br><br><strong>浏览器系统字体</strong><br>使用系统中已安装的中文衬线/无衬线字体回退，不在项目中打包字体文件。</div><div class="modal-actions"><button class="btn small" data-action="back">返回</button></div></div></section>';
    this.bind('[data-action=back]', onBack);
  }

  showSettings(onBack: () => void): void {
    const s = this.settings.value;
    const select = (id: string, label: string, value: string, options: Array<[string, string]>) =>
      '<div class="setting"><label for="' + id + '">' + label + '</label><select id="' + id + '">' + options.map(([v, text]) => '<option value="' + v + '"' + (value === v ? ' selected' : '') + '>' + text + '</option>').join('') + '</select></div>';
    const check = (id: keyof GameSettings, label: string, value: boolean) =>
      '<label class="setting check-setting" for="set-' + id + '"><span>' + label + '</span><input id="set-' + id + '" type="checkbox"' + (value ? ' checked' : '') + '></label>';
    const range = (id: keyof GameSettings, label: string, value: number, min: number, max: number, suffix: string) =>
      '<div class="setting"><label for="set-' + id + '">' + label + ' <span data-value="' + id + '">' + value + suffix + '</span></label><input id="set-' + id + '" type="range" min="' + min + '" max="' + max + '" value="' + value + '"></div>';
    const keys = Object.entries(s.keyBindings).map(([action, key]) =>
      '<div class="setting"><label>' + keyLabel(action as keyof KeyBindings) + '</label><button class="btn small keybind-btn" data-key="' + action + '">' + key + '</button></div>').join('');
    this.root.innerHTML = '<section class="ui-layer screen-shade"><div class="menu-card settings-card"><div class="settings-toolbar"><button class="btn small ghost" data-action="back-top">返回</button></div><div class="eyebrow">旅途偏好</div><h2 class="title" style="font-size:42px">设置</h2><div class="settings-grid">' +
      select('quality', '画质', s.quality, [['low','低'],['medium','中'],['high','高']]) +
      select('fps', '帧率上限', s.fps, [['unlimited','无上限'],['60','60 FPS'],['30','30 FPS']]) +
      select('pixelRatio', '像素比', s.pixelRatio, [['auto','自动'],['1','1×'],['2','2×']]) +
      check('particles','粒子效果',s.particles) + check('screenShake','屏幕震动',s.screenShake) +
      check('shadows','阴影',s.shadows) + check('postFx','后处理',s.postFx) +
      check('dynamicScale','动态缩放',s.dynamicScale) + check('gamepad','手柄支持',s.gamepad) +
      check('subtitles','字幕与提示',s.subtitles) + check('highContrast','高对比度',s.highContrast) +
      check('colorAssist','色觉辅助',s.colorAssist) + check('reduceMotion','减少动态效果',s.reduceMotion) +
      range('joystickSize','摇杆大小',s.joystickSize,70,140,'%') +
      range('joystickOpacity','摇杆透明度',s.joystickOpacity,20,100,'%') +
      range('buttonOpacity','按钮透明度',s.buttonOpacity,20,100,'%') +
      range('mouseSensitivity','点选移动灵敏度',s.mouseSensitivity,30,200,'%') +
      range('volume','音量',s.volume,0,100,'%') +
      range('fontSize','字体大小',s.fontSize,80,150,'%') +
      '</div><h3 style="font-size:15px;color:#efc875;letter-spacing:.1em">键位重绑</h3><div class="settings-grid">' + keys +
      '</div><p class="body-copy" style="font-size:12px;margin:8px 0">点击按键后按下新按键。设置会保存在本机浏览器。</p><div class="modal-actions"><button class="btn small ghost" data-action="defaults">恢复默认</button><button class="btn small" data-action="back">返回</button></div></div></section>';

    const setBoolean = (key: keyof GameSettings) => {
      const input = this.root.querySelector<HTMLInputElement>('#set-' + key);
      input?.addEventListener('change', () => this.settings.set(key, input.checked as never));
    };
    const setRange = (key: keyof GameSettings) => {
      const input = this.root.querySelector<HTMLInputElement>('#set-' + key);
      input?.addEventListener('input', () => {
        const value = Number(input.value);
        const label = this.root.querySelector<HTMLElement>('[data-value="' + key + '"]');
        if (label) label.textContent = value + '%';
        this.settings.set(key, value as never);
      });
    };
    ['particles','screenShake','shadows','postFx','dynamicScale','gamepad','subtitles','highContrast','colorAssist','reduceMotion'].forEach((key) => setBoolean(key as keyof GameSettings));
    ['joystickSize','joystickOpacity','buttonOpacity','mouseSensitivity','volume','fontSize'].forEach((key) => setRange(key as keyof GameSettings));
    (['quality','fps','pixelRatio'] as const).forEach((key) => {
      this.root.querySelector<HTMLSelectElement>('#' + key)?.addEventListener('change', (event) => {
        this.settings.set(key, (event.currentTarget as HTMLSelectElement).value as never);
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('.keybind-btn').forEach((button) => {
      button.addEventListener('click', () => {
        button.textContent = '按下新键…';
        const capture = (event: KeyboardEvent) => {
          event.preventDefault(); event.stopPropagation();
          const value = event.code === 'Space' ? 'SPACE' : event.code === 'Escape' ? 'ESC' : event.code.startsWith('Arrow') ? event.code.toUpperCase() : event.key.toUpperCase();
          this.settings.setKey(button.dataset.key as keyof KeyBindings, value);
          window.removeEventListener('keydown', capture, true);
          this.showSettings(onBack);
        };
        window.addEventListener('keydown', capture, true);
      });
    });
    this.bind('[data-action=defaults]', () => { this.settings.restoreDefaults(); this.showSettings(onBack); });
    this.bind('[data-action=back-top]', onBack);
    this.bind('[data-action=back]', onBack);
    this.applyPreferences(this.settings.value);
  }

  private bind(selector: string, action: () => void): void {
    this.root.querySelector(selector)?.addEventListener('click', action);
  }

  private applyPreferences(settings: GameSettings): void {
    this.root.querySelectorAll<HTMLButtonElement>('.desktop-action').forEach(button => {
      const action = button.dataset.action as 'dash' | 'lamp' | 'interact';
      const raw = settings.keyBindings[action];
      const key = raw === 'SPACE' ? '空格' : raw === 'ESC' ? 'Esc' : raw;
      const keycap = button.querySelector('kbd');
      if (keycap) keycap.textContent = key;
      button.setAttribute('aria-label', keyLabel(action) + '（' + key + '）');
      button.setAttribute('aria-keyshortcuts', raw === 'SPACE' ? 'Space' : raw);
      button.title = keyLabel(action) + ' · ' + key;
    });
    this.root.classList.toggle('high-contrast', settings.highContrast);
    this.root.style.fontSize = settings.fontSize + '%';
    this.root.style.setProperty('--button-alpha', String(settings.buttonOpacity / 100));
    this.root.classList.toggle('color-assist', settings.colorAssist);
    this.root.dataset.reduceMotion = String(settings.reduceMotion);
    document.getElementById('game-root')?.classList.toggle('post-fx', settings.postFx && settings.quality === 'high');
  }
}

function keyLabel(key: keyof KeyBindings): string {
  const labels: Record<keyof KeyBindings, string> = {
    moveUp: '向上移动', moveDown: '向下移动', moveLeft: '向左移动', moveRight: '向右移动',
    dash: '冲刺', interact: '互动', lamp: '雾灯', pause: '暂停',
  };
  return labels[key];
}

function formatTime(seconds: number): string {
  return Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
}
