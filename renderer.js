/* global Terminal, FitAddon */
const api = window.desktop;
const $ = id => document.getElementById(id);
let state, home, platform, maximized = null, actionQueue = Promise.resolve();
let projectFilter = '';
let agentDrawerVisible = false;
let agentDrawerPinned = false;
let agentDrawerAutoPane = null;
let isHoveringAgentTrigger = false;
let isHoveringAgentDrawer = false;
let agentHideTimer = null;
const collapsedProjects = new Set();
const terminals = new Map();
const pendingAgentLaunches = new Set();
let activeModelPopover = null;

// The original four palettes plus a phosphor-green terminal theme.
const themes = {
  graphite: {
    id: 'graphite', name: 'Graphite', subtitle: 'Linear / Raycast',
    bg: '#0e1015', sidebarBg: 'rgba(17, 19, 26, 0.92)', toolbarBg: 'rgba(18, 21, 28, 0.88)',
    surface: '#141720', elevated: '#1a1e29',
    surfaceHover: 'rgba(255, 255, 255, 0.045)', surfaceActive: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.075)', borderStrong: 'rgba(255, 255, 255, 0.14)',
    accent: '#5e9bff', accentHover: '#7eb0ff', accentSoft: 'rgba(94, 155, 255, 0.15)',
    text: '#f2f4f8', textSecondary: '#9ba3b4', muted: '#646d82',
    success: '#34d399', warning: '#fbbf24', danger: '#f87171', info: '#38bdf8',
    terminal: '#12151c', terminalFg: '#d8dee9', cursor: '#5e9bff',
    ansi: [
      '#1b1f2a', '#f87171', '#34d399', '#fbbf24', '#60a5fa', '#c084fc', '#38bdf8', '#d8dee9',
      '#4b5568', '#fca5a5', '#6ee7b7', '#fde68a', '#93c5fd', '#d8b4fe', '#7dd3fc', '#f8fafc'
    ]
  },
  obsidian: {
    id: 'obsidian', name: 'Obsidian', subtitle: 'Đen sâu tối giản',
    bg: '#090a0e', sidebarBg: 'rgba(12, 13, 18, 0.94)', toolbarBg: 'rgba(13, 15, 20, 0.90)',
    surface: '#101218', elevated: '#161922',
    surfaceHover: 'rgba(255, 255, 255, 0.04)', surfaceActive: 'rgba(255, 255, 255, 0.075)',
    border: 'rgba(255, 255, 255, 0.07)', borderStrong: 'rgba(255, 255, 255, 0.14)',
    accent: '#a78bfa', accentHover: '#c4b5fd', accentSoft: 'rgba(167, 139, 250, 0.15)',
    text: '#f4f4f6', textSecondary: '#9a9fb0', muted: '#5e6478',
    success: '#2dd4bf', warning: '#f59e0b', danger: '#fb7185', info: '#60a5fa',
    terminal: '#0e1016', terminalFg: '#c8d3f5', cursor: '#a78bfa',
    ansi: [
      '#181b26', '#f7768e', '#9ece6a', '#e0af68', '#7aa2f7', '#bb9af7', '#7dcfff', '#c0caf5',
      '#414868', '#ff899d', '#b9f27c', '#ffd08a', '#8db0ff', '#cda9ff', '#a4daff', '#ffffff'
    ]
  },
  warmDusk: {
    id: 'warmDusk', name: 'Warm Dusk', subtitle: 'Charcoal ấm áp',
    bg: '#131110', sidebarBg: 'rgba(24, 21, 19, 0.94)', toolbarBg: 'rgba(24, 21, 19, 0.90)',
    surface: '#1a1715', elevated: '#221e1b',
    surfaceHover: 'rgba(255, 255, 255, 0.045)', surfaceActive: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.08)', borderStrong: 'rgba(255, 255, 255, 0.15)',
    accent: '#e59853', accentHover: '#f2b172', accentSoft: 'rgba(229, 152, 83, 0.16)',
    text: '#f4efea', textSecondary: '#ada39a', muted: '#736960',
    success: '#5cc489', warning: '#e5b567', danger: '#e56b6f', info: '#6bb2d8',
    terminal: '#181513', terminalFg: '#e8dfd5', cursor: '#e59853',
    ansi: [
      '#26211e', '#e56b6f', '#78c293', '#e5b567', '#6ea8d6', '#c88ec7', '#6cc2bd', '#e8dfd5',
      '#594f48', '#f28f92', '#97d6ae', '#f2cc8a', '#94c2e6', '#dcafe0', '#92d9d4', '#faf6f2'
    ]
  },
  hacker: {
    id: 'hacker', name: 'Hacker', subtitle: 'Đen sâu · Xanh phosphor',
    bg: '#050a06', sidebarBg: 'rgba(7, 14, 8, 0.95)', toolbarBg: 'rgba(8, 16, 10, 0.93)',
    surface: '#09120b', elevated: '#101e13',
    surfaceHover: 'rgba(43, 212, 74, 0.07)', surfaceActive: 'rgba(43, 212, 74, 0.13)',
    border: 'rgba(43, 212, 74, 0.17)', borderStrong: 'rgba(43, 212, 74, 0.34)',
    accent: '#2bd44a', accentHover: '#4de669', accentSoft: 'rgba(43, 212, 74, 0.15)',
    text: '#7ce88c', textSecondary: '#4ba85c', muted: '#336e3e',
    success: '#2bd44a', warning: '#d4c953', danger: '#e55d5d', info: '#4bc99c',
    terminal: '#050a06', terminalFg: '#4be065', cursor: '#2bd44a',
    ansi: [
      '#0d190f', '#e55d5d', '#2bd44a', '#d4c953', '#49a89a', '#8ccf5b', '#4bc99c', '#7ce88c',
      '#3e6e47', '#f08686', '#5ceb76', '#e6dc7a', '#6ec7ba', '#ade082', '#73dec0', '#c8f7ce'
    ]
  },
  nordFrost: {
    id: 'nordFrost', name: 'Nord Frost', subtitle: 'Xanh Bắc Âu',
    bg: '#191e28', sidebarBg: 'rgba(30, 36, 48, 0.94)', toolbarBg: 'rgba(30, 36, 48, 0.90)',
    surface: '#202633', elevated: '#283040',
    surfaceHover: 'rgba(255, 255, 255, 0.05)', surfaceActive: 'rgba(255, 255, 255, 0.09)',
    border: 'rgba(255, 255, 255, 0.085)', borderStrong: 'rgba(255, 255, 255, 0.16)',
    accent: '#81c8ee', accentHover: '#9ed8f7', accentSoft: 'rgba(129, 200, 238, 0.16)',
    text: '#eceff4', textSecondary: '#a8b5c8', muted: '#6d7b91',
    success: '#a3be8c', warning: '#ebcb8b', danger: '#bf616a', info: '#88c0d0',
    terminal: '#1e2430', terminalFg: '#d8dee9', cursor: '#88c0d0',
    ansi: [
      '#3b4252', '#bf616a', '#a3be8c', '#ebcb8b', '#81a1c1', '#b48ead', '#88c0d0', '#e5e9f0',
      '#4c566a', '#d0727b', '#b5cf9e', '#f5d99f', '#94b4d4', '#c7a1c0', '#8fbcbb', '#eceff4'
    ]
  }
};

const themeOrder = ['graphite', 'obsidian', 'warmDusk', 'nordFrost', 'hacker'];

// Crisp inline SVG icon helpers matching SF Symbols from native TerManager
const ICONS = {
  terminal: '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5 6.8 8 3 11.5M8.2 11.5H13"/></svg>',
  folder: '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.4 1.6h4.6A1.5 1.5 0 0 1 14 6.1v5.4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7Z"/></svg>',
  folderPlus: '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.4 1.6h4.6A1.5 1.5 0 0 1 14 6.1v5.4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7Z"/><path d="M8 7v3.6M6.2 8.8h3.6"/></svg>',
  sparkles: '<svg class="icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8.4 1.8 9.6 5.4l3.6 1.2-3.6 1.2-1.2 3.6-1.2-3.6-3.6-1.2 3.6-1.2 1.2-3.6ZM3.4 10.6l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6.6-1.8Z"/></svg>',
  bolt: '<svg class="icon" viewBox="0 0 16 16" fill="currentColor"><path d="M9.3 1.5 3.6 8.8a.4.4 0 0 0 .32.65h3.5l-.72 5.05a.35.35 0 0 0 .62.27l5.7-7.3a.4.4 0 0 0-.32-.65H9.2l.72-5.05a.35.35 0 0 0-.62-.27Z"/></svg>',
  chevronDown: '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4.2 6.2 8 10l3.8-3.8"/></svg>',
  chevronRight: '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6.2 4.2 10 8l-3.8 3.8"/></svg>',
  plus: '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 3.2v9.6M3.2 8h9.6"/></svg>',
  pencil: '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11.2 2.4a1.6 1.6 0 0 1 2.3 2.3L5.6 12.6l-3.1.8.8-3.1 7.9-7.9Z"/></svg>',
  trash: '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 4.4h10.4M6 4.4V3.1c0-.5.4-.9.9-.9h2.2c.5 0 .9.4.9.9v1.3M4.4 4.4l.7 8.4c0 .6.5 1 1.1 1h3.6c.6 0 1.1-.4 1.1-1l.7-8.4"/></svg>',
  close: '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8"/></svg>',
  restart: '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8a5 5 0 1 1-1.4-3.5M13 2.8v2.6h-2.6"/></svg>',
  eyeSlash: '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="M2.2 2.2 13.8 13.8M6.5 6.6a2 2 0 0 0 2.9 2.8M4.3 4.5C2.8 5.4 1.8 6.8 1.5 8c.9 2.6 3.5 4.4 6.5 4.4 1.3 0 2.5-.3 3.5-.9M11.8 10.6c1.2-.8 2.1-1.9 2.7-2.6-.9-2.6-3.5-4.4-6.5-4.4-.7 0-1.4.1-2 .3"/></svg>',
  expand: '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"><path d="M9.8 2.5h3.7v3.7M6.2 13.5H2.5V9.8M13.5 2.5 9.2 6.8M2.5 13.5l4.3-4.3"/></svg>',
  compress: '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"><path d="M6.2 2.5v3.7H2.5M9.8 13.5V9.8h3.7M2.5 13.5l3.7-3.7M13.5 2.5 9.8 6.2"/></svg>',
  grip: '<svg class="icon command-grip" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 5h10M3 8h10M3 11h10"/></svg>',
  checkCircle: '<svg class="icon theme-check" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm2.9 5.1-3.4 3.5a.65.65 0 0 1-.92 0L5.1 8.6a.65.65 0 1 1 .92-.92l1.02 1.02 2.94-3.02a.65.65 0 1 1 .92.92Z"/></svg>',
  copy: '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.4"/><path d="M10.5 5.5V3.9A1.4 1.4 0 0 0 9.1 2.5H3.9A1.4 1.4 0 0 0 2.5 3.9v5.2a1.4 1.4 0 0 0 1.4 1.4h1.6"/></svg>',
  check: '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 8.4 6.5 11.7 12.8 4.8"/></svg>'
};

function error(reason) {
  $('error').querySelector('span').textContent = reason.message || String(reason);
  $('error').hidden = false;
}

function act(callback) {
  return (...args) => {
    actionQueue = actionQueue.then(() => callback(...args)).catch(error);
    return actionQueue;
  };
}

function iconButton(svg, title, callback, className = '') {
  const node = document.createElement('button');
  node.type = 'button';
  node.innerHTML = svg;
  node.title = title;
  node.setAttribute('aria-label', title);
  node.className = className;
  node.addEventListener('click', event => {
    event.stopPropagation();
    act(callback)();
  });
  return node;
}

function abbreviatePath(fullPath) {
  if (!fullPath) return '~';
  if (home && fullPath === home) return '~';
  if (home && fullPath.startsWith(home + (platform === 'win32' ? '\\' : '/'))) {
    return '~' + fullPath.slice(home.length);
  }
  return fullPath;
}

function agentTint(nameOrCmd) {
  const lower = (nameOrCmd || '').toLowerCase();
  if (lower.includes('claude')) return '#e59853';
  if (lower.includes('codex') || lower.includes('openai')) return '#38bdf8';
  if (lower.includes('gemini')) return '#a78bfa';
  if (lower.includes('agy') || lower.includes('antigravity')) return '#5e9bff';
  return '#34d399';
}

function taskIconSvg(name) {
  const lower = (name || '').toLowerCase();
  if (/(claude|gemini|codex|gpt|agy|ai|openai)/.test(lower)) return ICONS.sparkles;
  if (lower.includes('task')) return ICONS.terminal;
  return ICONS.folder;
}

function shortShellName(shellPath) {
  if (!shellPath) return '';
  const parts = shellPath.split(/[\\/]/);
  return parts[parts.length - 1].replace(/\.exe$/i, '');
}

async function update(change) {
  const next = structuredClone(state);
  change(next);
  await api.save(next);
  state = next;
  render();
}

function entityInfo() {
  if (state.selected === 'home') return { kind: 'home', name: 'Home', fullTitle: 'Home Terminal', path: home };
  for (const project of state.projects) {
    if (project.id === state.selected) return { kind: 'project', name: project.name, fullTitle: project.name, path: project.path };
    const task = project.tasks.find(t => t.id === state.selected);
    if (task) return { kind: 'task', name: project.name, taskName: task.name, fullTitle: `${project.name} / ${task.name}`, path: project.path };
  }
  return { kind: 'home', name: 'Home', fullTitle: 'Home Terminal', path: home };
}

function ask(title, value = '', command) {
  return new Promise(resolve => {
    const dialog = $('text-dialog');
    $('text-title').textContent = title;
    $('text-value').value = value;
    $('command-label').hidden = command === undefined;
    $('command-value').required = command !== undefined;
    $('command-value').value = command || '';
    const finish = result => {
      dialog.close();
      dialog.oncancel = null;
      $('text-form').onsubmit = null;
      resolve(result);
    };
    $('text-form').onsubmit = event => {
      event.preventDefault();
      const name = $('text-value').value.trim();
      const cmd = $('command-value').value.trim();
      if (name && (command === undefined || cmd)) finish({ name, command: cmd });
    };
    $('cancel-text').onclick = $('close-text-x').onclick = () => finish(null);
    dialog.oncancel = event => { event.preventDefault(); finish(null); };
    dialog.showModal();
    $('text-value').focus();
    $('text-value').select();
  });
}

function grid(count) {
  return count <= 1 ? [1, 1] : count === 2 ? [1, 2] : count <= 4 ? [2, 2] : count <= 6 ? [2, 3] : [3, 3];
}

let appliedThemeId = null;
function applyThemeTokens(themeId) {
  const t = themes[themeId] || themes.graphite;
  if (appliedThemeId === t.id) return t;
  appliedThemeId = t.id;
  const root = document.documentElement.style;
  root.setProperty('--bg', t.bg);
  root.setProperty('--sidebar-bg', t.sidebarBg);
  root.setProperty('--toolbar-bg', t.toolbarBg);
  root.setProperty('--surface', t.surface);
  root.setProperty('--elevated', t.elevated);
  root.setProperty('--surface-hover', t.surfaceHover);
  root.setProperty('--surface-active', t.surfaceActive);
  root.setProperty('--border', t.border);
  root.setProperty('--border-strong', t.borderStrong);
  root.setProperty('--accent', t.accent);
  root.setProperty('--accent-hover', t.accentHover);
  root.setProperty('--accent-soft', t.accentSoft);
  root.setProperty('--text', t.text);
  root.setProperty('--text-secondary', t.textSecondary);
  root.setProperty('--muted', t.muted);
  root.setProperty('--success', t.success);
  root.setProperty('--warning', t.warning);
  root.setProperty('--danger', t.danger);
  root.setProperty('--info', t.info);
  root.setProperty('--terminal', t.terminal);
  return t;
}

function xtermThemeFor(t) {
  const a = t.ansi;
  return {
    background: t.terminal,
    foreground: t.terminalFg,
    cursor: t.cursor,
    selectionBackground: t.accent + '4d',
    black: a[0], red: a[1], green: a[2], yellow: a[3],
    blue: a[4], magenta: a[5], cyan: a[6], white: a[7],
    brightBlack: a[8], brightRed: a[9], brightGreen: a[10], brightYellow: a[11],
    brightBlue: a[12], brightMagenta: a[13], brightCyan: a[14], brightWhite: a[15]
  };
}

function renderThemeSwatches() {
  const container = $('theme-swatches');
  container.replaceChildren();
  for (const id of themeOrder) {
    const t = themes[id];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `theme-swatch-dot ${state.settings.theme === id ? 'active' : ''}`;
    btn.title = `Theme: ${t.name}`;
    btn.setAttribute('aria-label', `Theme ${t.name}`);
    const dot = document.createElement('span');
    dot.style.background = t.accent;
    btn.append(dot);
    btn.addEventListener('click', act(() => update(s => { s.settings.theme = id; })));
    container.append(btn);
  }
}

function previewTheme(themeId) {
  const theme = applyThemeTokens(themeId);
  for (const view of terminals.values()) {
    if (view.themeId === theme.id) continue;
    view.term.options.theme = xtermThemeFor(theme);
    view.themeId = theme.id;
  }
}

function renderSettingsThemeCards(selectedId) {
  const container = $('theme-cards');
  container.replaceChildren();
  for (const id of themeOrder) {
    const t = themes[id];
    const isSel = selectedId === id;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `theme-card ${isSel ? 'selected' : ''}`;
    card.innerHTML = `
      <div class="theme-card-preview" style="background:${t.terminal}">
        <span class="preview-dot" style="background:${t.danger}"></span>
        <span class="preview-dot" style="background:${t.warning}"></span>
        <span class="preview-dot" style="background:${t.success}"></span>
        <span class="preview-bar" style="background:${t.accent}"></span>
      </div>
      <div class="theme-card-meta">
        <div>
          <strong>${t.name}</strong>
          <small>${t.subtitle}</small>
        </div>
        ${isSel ? ICONS.checkCircle : ''}
      </div>
    `;
    card.addEventListener('click', () => {
      $('theme').value = id;
      previewTheme(id);
      renderSettingsThemeCards(id);
    });
    container.append(card);
  }
}

function syncFontPreview(size) {
  const clamped = Math.min(24, Math.max(9, Number(size) || 13));
  $('font-size-slider').value = String(clamped);
  const preview = $('font-size-preview');
  preview.textContent = `$ echo "Terminal Manager"  # ${size}pt`;
  preview.style.fontSize = `${Math.min(16, Math.max(10, clamped))}px`;
}

function render() {
  const t = applyThemeTokens(state.settings.theme);
  renderThemeSwatches();
  renderSidebar();
  renderCommands();

  const info = entityInfo();
  const shortPath = abbreviatePath(info.path);

  // Topbar breadcrumbs
  const badge = $('workspace-icon');
  badge.className = `workspace-badge-icon ${info.kind === 'home' ? 'home' : 'project'}`;
  badge.innerHTML = info.kind === 'home' ? ICONS.terminal : ICONS.folder;
  $('workspace-title').textContent = info.name;
  $('workspace-title').classList.toggle('muted-parent', info.kind === 'task');
  if (info.kind === 'task') {
    $('workspace-sub').hidden = false;
    $('workspace-sub').innerHTML = `<span class="breadcrumb-sep">›</span><span></span>`;
    $('workspace-sub').lastElementChild.textContent = info.taskName;
    $('workspace-path').textContent = '';
  } else {
    $('workspace-sub').hidden = true;
    $('workspace-path').textContent = info.kind === 'home' ? '~' : '';
  }

  // Launchpad identity & quick AI agent pills
  const lpIcon = $('launchpad-icon');
  lpIcon.className = `launchpad-icon ${info.kind === 'home' ? 'home' : 'project'}`;
  lpIcon.innerHTML = info.kind === 'home' ? ICONS.terminal : ICONS.folder;
  $('launchpad-title').textContent = info.fullTitle;
  $('launchpad-path').textContent = shortPath;
  renderLaunchpadAgents();

  // Panes & Grid
  const panes = state.panes[state.selected] || [];
  const visible = panes.filter(p => !p.hidden);
  if (!visible.some(p => p.id === maximized)) maximized = null;
  $('exit-zoom').hidden = !maximized;

  const [rows, cols] = maximized ? [1, 1] : grid(visible.length);
  $('terminal-grid').style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  $('terminal-grid').style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;

  const allIDs = new Set(Object.values(state.panes).flat().map(p => p.id));
  if (activeModelPopover && !allIDs.has(activeModelPopover.paneId)) closeModelPopover();
  for (const [id, view] of terminals) {
    if (!allIDs.has(id)) {
      view.observer.disconnect();
      if (view.fitFrame) cancelAnimationFrame(view.fitFrame);
      view.term.dispose();
      view.node.remove();
      terminals.delete(id);
    }
  }

  const termTheme = xtermThemeFor(t);
  for (const [entity, slots] of Object.entries(state.panes)) {
    for (const pane of slots) {
      let view = terminals.get(pane.id);
      if (!view && entity === state.selected && !pane.hidden) view = makeTerminal(pane);
      if (!view) continue;
      view.node.hidden = entity !== state.selected || pane.hidden || (maximized && maximized !== pane.id);
      view.node.classList.toggle('maximized', maximized === pane.id);
      view.node.classList.toggle('exited', !view.running);
      view.title.textContent = pane.name;
      updatePaneModelButton(view, pane);
      view.zoomBtn.innerHTML = maximized === pane.id ? ICONS.compress : ICONS.expand;
      view.zoomBtn.classList.toggle('active', maximized === pane.id);
      view.zoomBtn.title = maximized === pane.id ? 'Thu về lưới' : 'Phóng to Terminal này';
      if (view.term.options.fontSize !== state.settings.fontSize) view.term.options.fontSize = state.settings.fontSize;
      if (view.themeId !== state.settings.theme) {
        view.term.options.theme = termTheme;
        view.themeId = state.settings.theme;
      }
      if (!view.node.hidden) queueFit(view);
    }
  }

  $('empty').hidden = visible.length !== 0;
  $('new-terminal').disabled = panes.length >= 9;
  $('empty-new').disabled = panes.length >= 9;
  $('empty-split').disabled = panes.length >= 8;

  // Status bar
  $('status-path').textContent = shortPath;
  $('status-path').title = info.path || '';
  $('status').textContent = `${visible.length} đang hiện · ${panes.length}/9 terminal`;
  $('shell-label').textContent = shortShellName(state.settings.shell);
  if (visible.length > 0) {
    $('grid-badge').hidden = false;
    $('grid-badge').textContent = `${rows}×${cols}`;
  } else {
    $('grid-badge').hidden = true;
  }

  // Hidden panes dock (keep single <button> per pane for smoke test compatibility)
  const hiddenList = panes.filter(p => p.hidden);
  $('hidden-panes-divider').hidden = hiddenList.length === 0;
  $('hidden-panes').replaceChildren();
  for (const pane of hiddenList) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'hidden-pill';
    pill.title = 'Nhấn để khôi phục Terminal đang chạy ngầm';
    pill.setAttribute('aria-label', `Khôi phục ${pane.name}`);
    const dot = document.createElement('span');
    dot.className = 'hidden-pill-dot';
    const label = document.createElement('span');
    label.textContent = pane.name;
    pill.append(dot, label);
    pill.addEventListener('click', act(() => update(s => {
      s.panes[s.selected].find(p => p.id === pane.id).hidden = false;
    })));
    $('hidden-panes').append(pill);
  }
}

const AGENT_MODELS = {
  claude: {
    key: 'claude', name: 'Claude Code', tint: '#e59853', icon: ICONS.sparkles,
    models: [], nativePicker: true
  },
  codex: {
    key: 'codex', name: 'Codex', tint: '#38bdf8', icon: ICONS.terminal,
    models: []
  },
  gemini: {
    key: 'gemini', name: 'Gemini', tint: '#a78bfa', icon: ICONS.sparkles,
    models: [], nativePicker: true
  },
  agy: {
    key: 'agy', name: 'Antigravity', tint: '#5e9bff', icon: ICONS.bolt,
    models: []
  }
};

function findPaneState(paneId) {
  return Object.values(state.panes).flat().find(p => p.id === paneId) || null;
}

function extractCommandModel(command) {
  if (!command) return undefined;
  const match = command.match(/(?:^|\s)(?:--model|-m)(?:=|\s+)(?:"([^"]+)"|'([^']+)'|(\S+))/);
  const value = match && (match[1] || match[2] || match[3]);
  return value ? value.trim().slice(0, 200) : undefined;
}

function activeModelForView(view) {
  if (!view?.runningAgent) return null;
  return view.detectedModel || null;
}

// shortcut: read agy’s visible status format; update this matcher if its footer layout changes.
function agyModelFromStatus(lines, models) {
  for (const line of [...lines].reverse()) {
    if (!line.includes('? for shortcuts')) continue;
    const found = models.find(item => line.trimEnd().endsWith(
      item.label.replace(/ \((None|Minimal|Low|Medium|High|XHigh|Max|Ultra)\)$/, (_, effort) => ` · ${effort.toLowerCase()}`)
    ));
    if (found) return found.id;
  }
  return null;
}

function resolveModelName(name, models) {
  const clean = name.trim();
  const found = models.find(item => item.id.toLowerCase() === clean.toLowerCase() ||
    item.label.replace(/ \((None|Minimal|Low|Medium|High|XHigh|Max|Ultra)\)$/, '').toLowerCase() === clean.toLowerCase());
  return found?.id || clean;
}

// shortcut: recognize agent UI status, not arbitrary model mentions; hidden/custom footers can leave the model unknown.
function agentModelFromScreen(agent, lines, models) {
  lines = lines.slice(0, lines.findLastIndex(line => line.trim()) + 1);
  const efforts = 'none|minimal|low|medium|high|xhigh|max|ultra|default';
  if (agent === 'agy') {
    const model = agyModelFromStatus(lines, models);
    if (model) {
      const label = models.find(item => item.id === model)?.label || '';
      return { model, effort: label.match(/\((\w+)\)$/)?.[1]?.toLowerCase() || null };
    }
    if (lines.some(line => line.includes('? for shortcuts') && /\bOrchestrator(?:\s*·.*)?\s*$/.test(line))) {
      return { model: 'Orchestrator', effort: null };
    }
    return null;
  }
  const recent = [...lines].reverse();
  if (agent === 'codex') {
    if (lines.slice(-6).some(line => line.includes('? for shortcuts'))) {
      for (const line of recent.slice(0, 8)) {
        const footer = line.match(new RegExp(`^\\s*([A-Za-z0-9][A-Za-z0-9 ._:/-]{0,150}?)\\s+(${efforts})(?:\\s*\\([^)]*\\))?\\s*[·|]`, 'i'));
        if (footer) return { model: resolveModelName(footer[1], models), effort: footer[2].toLowerCase() === 'default' ? null : footer[2].toLowerCase() };
      }
    }
    for (const line of recent) {
      const changed = line.match(new RegExp(`^\\s*[•●]\\s+Model changed to (\\S+)\\s+(${efforts})(?:\\s|$)`, 'i'));
      if (changed) return { model: resolveModelName(changed[1], models), effort: changed[2].toLowerCase() };
      const status = line.match(/^\s*[│|]?\s*Model:\s+(.+?)\s*$/i);
      if (status && lines.some(row => /OpenAI Codex|Model provider:/i.test(row))) {
        const value = status[1].match(new RegExp(`^(.+?)\\s+\\(reasoning\\s+(${efforts})`, 'i'))
          || status[1].match(new RegExp(`^(\\S+)(?:\\s+(${efforts}))?`, 'i'));
        if (value) return { model: resolveModelName(value[1], models), effort: value[2]?.toLowerCase() || null };
      }
    }
  }
  if (agent === 'claude') {
    const effortLine = recent.find(line => /\b(low|medium|high|xhigh|max)\s*·\s*\/effort\b/i.test(line));
    const effort = effortLine?.match(/\b(low|medium|high|xhigh|max)\s*·\s*\/effort\b/i)?.[1].toLowerCase() || null;
    for (const line of recent) {
      const changed = line.match(/^\s*⎿\s*(?:Set model to|Kept model as)\s+(.+?)\s*$/i);
      if (changed) return { model: changed[1], effort };
    }
    const header = lines.findLastIndex(line => /Claude Code v\d/.test(line));
    if (header >= 0) {
      for (const line of lines.slice(header + 1, header + 4)) {
        const model = line.replace(/[\u2580-\u259f│]/g, '').trim().match(/^(.+?)\s+·\s+.+$/);
        if (model) return { model: model[1].trim(), effort };
      }
    }
  }
  if (agent === 'gemini') {
    const footer = lines.slice(-6);
    if (footer.some(line => /(?:no sandbox|untrusted|sandbox|%\s*(?:context|left|used)|Workspace\s+.*Model)/i.test(line))) {
      for (const line of [...footer].reverse()) {
        if (/^\s*[>❯›]/.test(line)) continue;
        const model = line.match(/\b((?:gemini|gemma|auto-gemini)-[\w.-]+|Auto(?: \(Gemini [\d.]+\))?)(?=\s|$|[│|])/);
        if (model) return { model: model[1], effort: null };
      }
    }
    for (const line of recent) {
      const changed = line.match(/^\s*(?:[ℹ✓]\s*)?Model set to ([\w.:/-]+)(?:\s+\(persisted\))?\s*$/);
      if (changed) return { model: changed[1], effort: null };
    }
  }
  return null;
}

function isCurrentModelVariant(view, variant) {
  return variant.id === activeModelForView(view) && (view.runningAgent !== 'codex' ||
    !variant.effort || variant.effort.toLowerCase() === view.detectedEffort);
}

function syncAgentModel(view) {
  if (!view.runningAgent) return;
  const buffer = view.term.buffer.active;
  const markerLine = view.agentMarker?.line;
  const floor = view.agentMarkerBuffer === buffer.type && markerLine >= 0 && markerLine <= buffer.baseY + buffer.cursorY
    ? Math.max(buffer.baseY, markerLine) : buffer.baseY;
  const lines = Array.from({ length: Math.max(0, buffer.baseY + view.term.rows - floor) }, (_, i) => buffer.getLine(floor + i)?.translateToString() || '');
  const detected = agentModelFromScreen(view.runningAgent, lines, AGENT_MODELS[view.runningAgent].models);
  if (detected && (detected.model !== view.detectedModel || detected.effort !== view.detectedEffort)) {
    view.detectedModel = detected.model;
    view.detectedEffort = detected.effort;
    updatePaneModelButton(view, findPaneState(view.id));
  }
}

function groupModelVariants(models) {
  const groups = new Map();
  const levels = ['None', 'Minimal', 'Low', 'Medium', 'High', 'XHigh', 'Max', 'Ultra'];
  for (const model of models) {
    if (/^gemini-pro-orchestrator(?:-|$)/.test(model.id)) continue;
    const match = model.label.match(/^(.*) \((None|Minimal|Low|Medium|High|XHigh|Max|Ultra)\)$/i);
    const label = match ? match[1] : model.label;
    const effort = levels.find(level => level.toLowerCase() === (model.effort || match?.[2] || '').toLowerCase()) || null;
    if (!groups.has(label)) groups.set(label, { label, variants: [] });
    groups.get(label).variants.push({ ...model, effort });
  }
  for (const group of groups.values()) {
    group.variants.sort((a, b) => levels.indexOf(a.effort) - levels.indexOf(b.effort));
  }
  return [...groups.values()];
}

function modelLabelFor(agentKey, modelId) {
  if (!modelId) return 'Model';
  const group = agentKey && AGENT_MODELS[agentKey];
  const found = group?.models.find(m => m.id === modelId);
  if (agentKey === 'codex' && found) return found.label.replace(/ \((None|Minimal|Low|Medium|High|XHigh|Max|Ultra)\)$/i, '');
  if (agentKey === 'agy' && /^gemini-pro-orchestrator(?:-|$)/.test(modelId)) return 'Orchestrator';
  return found ? found.label : modelId;
}

function updatePaneModelButton(view, pane) {
  if (!view.modelBtn) return;
  const agentKey = view.running ? view.runningAgent : null;
  const group = agentKey ? AGENT_MODELS[agentKey] : null;
  if (!group) {
    view.modelBtn.hidden = true;
    view.modelBtn.classList.remove('open', 'has-model');
    if (activeModelPopover?.paneId === view.id) closeModelPopover();
    return;
  }
  const activeModel = activeModelForView(view, pane);
  const label = modelLabelFor(agentKey, activeModel);
  view.modelBtn.hidden = false;
  view.modelBtn.classList.toggle('has-model', Boolean(activeModel));
  view.modelBtn.classList.toggle('open', activeModelPopover?.paneId === view.id);
  view.modelBtn.style.setProperty('--model-tint', group.tint);
  view.modelBtn.querySelector('.pane-model-label').textContent = agentKey === 'codex' && view.detectedEffort
    ? `${label} · ${view.detectedEffort}` : label;
  view.modelBtn.title = activeModel
    ? `${group.name} • Model: ${activeModel} • Nhấn để đổi model`
    : `${group.name} • Chưa xác định model • Nhấn để đổi model (/model)`;
}

function closeModelPopover() {
  if (!activeModelPopover) return;
  const { node, paneId, onOutside, onKeyDown, onResize } = activeModelPopover;
  activeModelPopover = null;
  node.remove();
  document.removeEventListener('mousedown', onOutside, true);
  document.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('resize', onResize);
  const view = terminals.get(paneId);
  if (view?.modelBtn) view.modelBtn.classList.remove('open');
}

async function applyPaneModel(paneId, modelId, effort) {
  const view = terminals.get(paneId);
  if (!view || !view.running || !view.runningAgent) {
    throw new Error('Không có agent nào đang chạy trong terminal này.');
  }
  const cleanModel = (modelId || '').trim();
  if (cleanModel.length > 200 || /[\x00-\x1f\x7f]/.test(cleanModel)) throw new Error('Model không hợp lệ.');
  if (effort && !/^(none|minimal|low|medium|high|xhigh|max|ultra)$/i.test(effort)) throw new Error('Mức reasoning không hợp lệ.');
  const reasoning = view.runningAgent === 'codex' && cleanModel && effort ? ` --reasoning=${effort.toLowerCase()}` : '';
  await api.input(paneId, cleanModel ? `/model ${cleanModel}${reasoning}\r` : '/model\r');
  view.term.focus();
}

const agentModelRequests = new Map();
function loadAgentModels(agent) {
  const group = AGENT_MODELS[agent];
  // shortcut: reuse the CLI catalog for this app session; reopen the app to refresh it.
  if (group.models.length || group.nativePicker) return Promise.resolve(group.models);
  if (!agentModelRequests.has(agent)) {
    agentModelRequests.set(agent, api.agentModels(agent).then(models => {
      if (!models.length) {
        if (agent !== 'codex') throw new Error(`${group.name} chưa trả về danh sách model. Thử mở lại menu.`);
        group.nativePicker = true;
      }
      group.models = models;
      return models;
    }).finally(() => { agentModelRequests.delete(agent); }));
  }
  return agentModelRequests.get(agent);
}

function openModelPopover(paneId, anchorBtn) {
  if (activeModelPopover?.paneId === paneId) {
    closeModelPopover();
    return;
  }
  closeModelPopover();

  const view = terminals.get(paneId);
  const pane = findPaneState(paneId);
  const agentKey = view?.running ? view.runningAgent : null;
  const group = agentKey ? AGENT_MODELS[agentKey] : null;
  if (!pane || !group) return;
  if (group.nativePicker) {
    act(() => applyPaneModel(paneId, ''))();
    return;
  }

  const popover = document.createElement('div');
  popover.className = 'model-popover';
  popover.setAttribute('role', 'menu');
  popover.setAttribute('aria-label', `Chọn model cho ${group.name}`);

  const positionPopover = () => {
    const rect = anchorBtn.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();
    const width = popRect.width || 228;
    const height = popRect.height || 240;
    const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.right - width));
    const top = rect.bottom + height + 12 > window.innerHeight
      ? Math.max(8, rect.top - height - 6)
      : rect.bottom + 6;
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  };

  const header = document.createElement('div');
  header.className = 'model-popover-header';
  header.style.setProperty('--group-tint', group.tint);
  header.innerHTML = `${group.icon}<span>Model ${group.name}</span>`;
  popover.append(header);

  const list = document.createElement('div');
  list.className = 'model-popover-list';

  const section = document.createElement('div');
  section.className = 'model-group';
  const loading = !group.models.length;
  if (loading) {
    section.textContent = 'Đang tải model…';
    section.setAttribute('role', 'status');
  }

  const families = groupModelVariants(group.models);
  let selectedFamily = families.find(item => item.variants.some(v => isCurrentModelVariant(view, v))) || families[0];
  let selectedVariant = selectedFamily?.variants.find(v => isCurrentModelVariant(view, v))
    || selectedFamily?.variants.find(v => v.default) || selectedFamily?.variants.find(v => v.effort === 'Medium') || selectedFamily?.variants[0];

  const effortControl = document.createElement('div');
  effortControl.className = 'model-effort';
  const effortLabel = document.createElement('div');
  effortLabel.className = 'model-effort-label';
  const effortValue = document.createElement('strong');
  const effortModel = document.createElement('span');
  effortLabel.append(effortValue, effortModel);
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.step = '1';
  slider.setAttribute('aria-label', 'Mức reasoning');
  const ticks = document.createElement('div');
  ticks.className = 'model-effort-ticks';
  effortControl.append(effortLabel, slider, ticks);

  const refreshSelection = () => {
    for (const [index, button] of [...section.children].entries()) {
      const selected = families[index] === selectedFamily;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    }
    effortControl.hidden = !selectedFamily || selectedFamily.variants.length < 2;
    applyBtn.disabled = !selectedVariant || isCurrentModelVariant(view, selectedVariant);
    if (!selectedVariant) return;
    effortValue.textContent = selectedVariant.effort || '';
    effortModel.textContent = selectedFamily.label;
    slider.max = String(selectedFamily.variants.length - 1);
    slider.value = String(selectedFamily.variants.indexOf(selectedVariant));
    slider.setAttribute('aria-valuetext', selectedVariant.effort || selectedVariant.label);
    ticks.replaceChildren(...selectedFamily.variants.map(variant => {
      const tick = document.createElement('span');
      tick.textContent = '•';
      tick.title = variant.effort || variant.label;
      return tick;
    }));
    positionPopover();
  };

  for (const family of families) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'model-option';
    btn.setAttribute('role', 'menuitemradio');
    btn.dataset.modelId = family.variants[0].id;
    btn.dataset.agentKey = group.key;
    const nameEl = document.createElement('strong');
    nameEl.textContent = family.label;
    const textWrap = document.createElement('span');
    textWrap.className = 'model-option-text';
    textWrap.append(nameEl);
    btn.append(textWrap);
    btn.addEventListener('click', () => {
      const variant = family.variants.find(v => v.effort === selectedVariant?.effort)
        || family.variants.find(v => v.default) || family.variants.find(v => v.effort === 'Medium') || family.variants[0];
      selectedFamily = family;
      selectedVariant = variant;
      refreshSelection();
    });
    section.append(btn);
  }

  slider.addEventListener('input', () => {
    const variant = selectedFamily.variants[Number(slider.value)];
    selectedVariant = variant;
    effortValue.textContent = variant.effort;
    slider.setAttribute('aria-valuetext', variant.effort);
    applyBtn.disabled = isCurrentModelVariant(view, variant);
  });

  list.append(section);
  popover.append(list, effortControl);

  const footer = document.createElement('div');
  footer.className = 'model-popover-footer';

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'model-footer-btn model-apply-btn';
  applyBtn.textContent = 'Áp dụng';
  applyBtn.addEventListener('click', () => {
    if (!selectedVariant || applyBtn.disabled) return;
    const modelId = selectedVariant.id;
    const effort = selectedVariant.effort;
    applyBtn.disabled = true;
    act(async () => {
      await applyPaneModel(paneId, modelId, effort);
      if (activeModelPopover?.node === popover) closeModelPopover();
    })().finally(() => { applyBtn.disabled = false; });
  });

  const customBtn = document.createElement('button');
  customBtn.type = 'button';
  customBtn.className = 'model-footer-btn';
  customBtn.innerHTML = `${ICONS.pencil}<span>Nhập model tùy chỉnh...</span>`;
  customBtn.addEventListener('click', act(async () => {
    closeModelPopover();
    const latestView = terminals.get(paneId);
    const latestPane = findPaneState(paneId);
    const result = await ask(`Đổi model ${group.name}`, activeModelForView(latestView, latestPane) || '');
    if (result) await applyPaneModel(paneId, result.name);
  }));

  const interactiveBtn = document.createElement('button');
  interactiveBtn.type = 'button';
  interactiveBtn.className = 'model-footer-btn mono';
  interactiveBtn.innerHTML = `${ICONS.terminal}<span>Gửi lệnh /model</span>`;
  interactiveBtn.addEventListener('click', act(async () => {
    closeModelPopover();
    await applyPaneModel(paneId, '');
  }));

  footer.append(applyBtn, customBtn, interactiveBtn);
  popover.append(footer);

  document.body.append(popover);
  anchorBtn.classList.add('open');
  refreshSelection();

  const onOutside = event => {
    if (!popover.contains(event.target) && !anchorBtn.contains(event.target)) closeModelPopover();
  };
  const onKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModelPopover();
      terminals.get(paneId)?.term.focus();
    }
  };
  const onResize = () => closeModelPopover();

  document.addEventListener('mousedown', onOutside, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('resize', onResize);

  activeModelPopover = { node: popover, paneId, anchorBtn, onOutside, onKeyDown, onResize };
  if (loading) {
    loadAgentModels(agentKey).then(() => {
      if (activeModelPopover?.node !== popover) return;
      syncAgentModel(view);
      closeModelPopover();
      openModelPopover(paneId, anchorBtn);
    }).catch(reason => {
      if (activeModelPopover?.node === popover) section.textContent = reason.message;
    });
  }
}

function agentMetaFor(preset) {
  const cmdFirst = (preset.command || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
  const lower = `${preset.title} ${preset.command}`.toLowerCase();
  if (cmdFirst === 'agy' || lower.includes('antigravity') || lower.startsWith('agy')) {
    return { key: 'agy', name: 'Antigravity', tag: 'agy', icon: ICONS.bolt, tint: '#5e9bff' };
  }
  if (cmdFirst === 'codex' || lower.includes('codex') || lower.includes('openai')) {
    return { key: 'codex', name: 'Codex', tag: 'codex', icon: ICONS.terminal, tint: '#38bdf8' };
  }
  if (cmdFirst === 'claude' || lower.includes('claude')) {
    return { key: 'claude', name: 'Claude Code', tag: 'claude', icon: ICONS.sparkles, tint: '#e59853' };
  }
  if (cmdFirst === 'gemini' || lower.includes('gemini')) {
    return { key: 'gemini', name: 'Gemini', tag: 'gemini', icon: ICONS.sparkles, tint: '#a78bfa' };
  }
  return { key: 'custom', name: 'Tùy chỉnh', tag: 'custom', icon: ICONS.terminal, tint: '#34d399' };
}

function groupCommands(commands) {
  const map = new Map();
  for (const preset of commands) {
    const meta = agentMetaFor(preset);
    if (!map.has(meta.key)) map.set(meta.key, { ...meta, items: [] });
    map.get(meta.key).items.push(preset);
  }
  return [...map.values()];
}

function renderLaunchpadAgents() {
  const container = $('launchpad-agents');
  container.replaceChildren();
  for (const group of groupCommands(state.commands).slice(0, 4)) {
    const preferred = group.items[group.items.length - 1] || group.items[0];
    if (!preferred) continue;
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'agent-quick-pill';
    pill.style.setProperty('--pill-tint', group.tint);
    pill.title = preferred.command;
    pill.innerHTML = group.icon;
    const text = document.createElement('span');
    text.textContent = group.name;
    pill.append(text);
    pill.addEventListener('click', act(() => newTerminal(preferred.command, preferred.title)));
    container.append(pill);
  }
}

function renderSidebar() {
  const nav = $('projects');
  nav.replaceChildren();

  const showFilter = state.projects.length >= 4 || projectFilter.length > 0;
  $('project-filter-wrap').hidden = !showFilter;
  $('clear-filter').hidden = projectFilter.length === 0;

  // 1. Home (~) row
  const homeGroup = document.createElement('div');
  homeGroup.className = 'sidebar-group';
  const homeCount = (state.panes.home || []).length;
  const homeRow = document.createElement('div');
  homeRow.className = `project-row ${state.selected === 'home' ? 'selected' : ''}`;
  homeRow.title = 'Terminal hệ thống tại thư mục gốc (~)';

  const homeSpacer = document.createElement('span');
  homeSpacer.className = 'disclosure-rail';

  const homeSelect = document.createElement('button');
  homeSelect.type = 'button';
  homeSelect.className = 'row-main select';
  homeSelect.innerHTML = `<span class="row-icon home">${ICONS.terminal}</span><span class="row-label">Home (~)</span>`;
  homeSelect.addEventListener('click', act(() => update(s => { s.selected = 'home'; })));

  homeRow.append(homeSpacer, homeSelect);
  if (homeCount > 0) {
    const badge = document.createElement('span');
    badge.className = 'row-count';
    badge.textContent = String(homeCount);
    homeRow.append(badge);
  }
  const homeActions = document.createElement('div');
  homeActions.className = 'row-actions';
  homeActions.append(iconButton(ICONS.plus, 'Mở terminal tại ~', async () => {
    if (state.selected !== 'home') await update(s => { s.selected = 'home'; });
    await newTerminal();
  }, 'row-action success'));
  homeRow.append(homeActions);
  homeGroup.append(homeRow);
  nav.append(homeGroup);

  // 2. Workspaces section
  const wsGroup = document.createElement('div');
  wsGroup.className = 'sidebar-group';

  const header = document.createElement('div');
  header.className = 'section-header';
  header.innerHTML = `<span>WORKSPACES</span>${state.projects.length ? `<span class="section-count">${state.projects.length}</span>` : ''}`;
  wsGroup.append(header);

  const query = projectFilter.trim().toLowerCase();
  const filtered = query
    ? state.projects.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.tasks.some(t => t.name.toLowerCase().includes(query))
      )
    : state.projects;

  if (state.projects.length === 0) {
    const emptyHint = document.createElement('button');
    emptyHint.type = 'button';
    emptyHint.className = 'sidebar-empty-hint';
    emptyHint.innerHTML = `${ICONS.folderPlus}<strong>Thêm thư mục dự án</strong><small>hoặc nhấn + ở góc trên</small>`;
    emptyHint.addEventListener('click', () => $('add-project').click());
    wsGroup.append(emptyHint);
  } else if (filtered.length === 0) {
    const noMatch = document.createElement('div');
    noMatch.className = 'sidebar-filter-empty';
    noMatch.textContent = 'Không tìm thấy dự án phù hợp';
    wsGroup.append(noMatch);
  } else {
    for (const project of filtered) {
      const section = document.createElement('div');
      section.className = 'project-section';

      const hasTasks = project.tasks.length > 0;
      const isExpanded = !collapsedProjects.has(project.id);
      const paneCount = (state.panes[project.id] || []).length;

      const row = document.createElement('div');
      row.className = `project-row ${state.selected === project.id ? 'selected' : ''}`;
      row.title = abbreviatePath(project.path);

      if (hasTasks) {
        const toggle = iconButton(
          isExpanded ? ICONS.chevronDown : ICONS.chevronRight,
          isExpanded ? 'Thu gọn' : `Mở rộng (${project.tasks.length} Task)`,
          () => {
            if (collapsedProjects.has(project.id)) collapsedProjects.delete(project.id);
            else collapsedProjects.add(project.id);
            renderSidebar();
          },
          'disclosure-rail'
        );
        row.append(toggle);
      } else {
        const spacer = document.createElement('span');
        spacer.className = 'disclosure-rail';
        row.append(spacer);
      }

      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = 'row-main select';
      selectBtn.innerHTML = `<span class="row-icon project">${ICONS.folder}</span>`;
      const nameSpan = document.createElement('span');
      nameSpan.className = 'row-label';
      nameSpan.textContent = project.name;
      selectBtn.append(nameSpan);
      selectBtn.addEventListener('click', act(() => update(s => { s.selected = project.id; })));
      row.append(selectBtn);

      if (paneCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'row-count';
        badge.textContent = String(paneCount);
        row.append(badge);
      }

      const actions = document.createElement('div');
      actions.className = 'row-actions';
      actions.append(
        iconButton(ICONS.plus, 'Thêm task mới', async () => {
          let number = 1;
          while (project.tasks.some(t => t.name === `Task ${number}`)) number++;
          const result = await ask('Thêm task', `Task ${number}`);
          if (!result) return;
          const id = crypto.randomUUID();
          collapsedProjects.delete(project.id);
          await update(s => {
            s.projects.find(p => p.id === project.id).tasks.push({ id, name: result.name });
            s.selected = id;
            s.panes[id] = [];
          });
          const command = state.commands.find(c => c.title.toLowerCase() === result.name.toLowerCase());
          await newTerminal(command?.command);
        }, 'row-action success'),
        iconButton(ICONS.trash, 'Xóa project khỏi danh sách', async () => {
          if (!confirm(`Xóa “${project.name}” khỏi danh sách và dừng các terminal của project? Thư mục trên ổ đĩa được giữ nguyên.`)) return;
          const ids = new Set([project.id, ...project.tasks.map(t => t.id)]);
          await update(s => {
            s.projects = s.projects.filter(p => p.id !== project.id);
            for (const id of ids) delete s.panes[id];
            if (ids.has(s.selected)) s.selected = 'home';
          });
        }, 'row-action danger')
      );
      row.append(actions);
      section.append(row);

      if (hasTasks && isExpanded) {
        const tree = document.createElement('div');
        tree.className = 'task-tree';
        const guide = document.createElement('div');
        guide.className = 'task-guide';
        const taskList = document.createElement('div');
        taskList.className = 'task-list';

        for (const task of project.tasks) {
          const taskRow = document.createElement('div');
          taskRow.className = `task-row ${state.selected === task.id ? 'selected' : ''}`;
          const taskPaneCount = (state.panes[task.id] || []).length;

          const taskSelect = document.createElement('button');
          taskSelect.type = 'button';
          taskSelect.className = 'row-main select';
          taskSelect.innerHTML = `<span class="task-icon">${taskIconSvg(task.name)}</span>`;
          const taskNameSpan = document.createElement('span');
          taskNameSpan.className = 'task-label';
          taskNameSpan.textContent = task.name;
          taskSelect.append(taskNameSpan);
          taskSelect.addEventListener('click', act(() => update(s => { s.selected = task.id; })));
          taskSelect.addEventListener('dblclick', act(async () => {
            const result = await ask('Đổi tên task', task.name);
            if (result) {
              await update(s => {
                s.projects.find(p => p.id === project.id).tasks.find(t => t.id === task.id).name = result.name;
              });
            }
          }));
          taskRow.append(taskSelect);

          if (taskPaneCount > 0) {
            const countPill = document.createElement('span');
            countPill.className = 'task-count';
            countPill.textContent = String(taskPaneCount);
            taskRow.append(countPill);
          }

          const taskActions = document.createElement('div');
          taskActions.className = 'row-actions';
          taskActions.append(
            iconButton(ICONS.pencil, 'Đổi tên task', async () => {
              const result = await ask('Đổi tên task', task.name);
              if (result) {
                await update(s => {
                  s.projects.find(p => p.id === project.id).tasks.find(t => t.id === task.id).name = result.name;
                });
              }
            }, 'row-action'),
            iconButton(ICONS.trash, 'Xóa task', async () => {
              if (!confirm(`Xóa task “${task.name}” và dừng các terminal của task?`)) return;
              await update(s => {
                const target = s.projects.find(p => p.id === project.id);
                target.tasks = target.tasks.filter(t => t.id !== task.id);
                delete s.panes[task.id];
                if (s.selected === task.id) s.selected = project.id;
              });
            }, 'row-action danger')
          );
          taskRow.append(taskActions);
          taskList.append(taskRow);
        }

        tree.append(guide, taskList);
        section.append(tree);
      }

      wsGroup.append(section);
    }
  }

  nav.append(wsGroup);
}

function renderCommands() {
  const list = $('commands');
  list.replaceChildren();
  for (const group of groupCommands(state.commands)) {
    const section = document.createElement('div');
    section.className = 'command-group';

    const header = document.createElement('div');
    header.className = 'command-group-header';
    header.style.setProperty('--group-tint', group.tint);
    header.innerHTML = `${group.icon}<span class="command-group-name"></span><span class="command-group-tag"></span>`;
    header.querySelector('.command-group-name').textContent = group.name;
    header.querySelector('.command-group-tag').textContent = group.tag;
    section.append(header);

    for (const preset of group.items) {
      const row = document.createElement('div');
      row.className = 'command-row';
      row.style.setProperty('--cmd-tint', group.tint);
      row.draggable = true;
      row.title = `Kéo thả vào Terminal để chạy • Hoặc nhấn để mở Terminal mới\n${preset.command}`;
      row.addEventListener('dragstart', event => {
        event.dataTransfer.setData('application/x-termanager-command', preset.command);
        event.dataTransfer.setData('application/x-termanager-title', preset.title);
      });
      row.addEventListener('dragend', () => {
        if (!agentDrawerPinned && !isHoveringAgentDrawer) scheduleHideAgentDrawer();
      });

      row.insertAdjacentHTML('beforeend', ICONS.grip);

      const launch = document.createElement('button');
      launch.type = 'button';
      launch.className = 'command-launch';
      const titleEl = document.createElement('strong');
      // Strip redundant "tag • " prefix inside grouped section for cleaner display
      const prefix = `${group.tag} • `;
      titleEl.textContent = preset.title.toLowerCase().startsWith(prefix)
        ? preset.title.slice(prefix.length)
        : preset.title;
      const cmdEl = document.createElement('small');
      cmdEl.textContent = preset.command;
      launch.append(titleEl, cmdEl);
      launch.addEventListener('click', act(() => newTerminal(preset.command, preset.title)));
      row.append(launch);

      const actions = document.createElement('div');
      actions.className = 'command-actions';
      actions.append(
        iconButton(ICONS.pencil, 'Sửa lệnh', async () => {
          const result = await ask('Sửa lệnh', preset.title, preset.command);
          if (result) {
            await update(s => {
              Object.assign(s.commands.find(c => c.id === preset.id), { title: result.name, command: result.command });
            });
          }
          if (!agentDrawerPinned && !isHoveringAgentDrawer) scheduleHideAgentDrawer();
        }, 'row-action'),
        iconButton(ICONS.close, 'Xóa lệnh', async () => {
          if (confirm(`Xóa lệnh “${preset.title}”?`)) {
            await update(s => { s.commands = s.commands.filter(c => c.id !== preset.id); });
          }
        }, 'row-action danger')
      );
      row.append(actions);
      section.append(row);
    }

    list.append(section);
  }
}

function queueFit(view) {
  if (view.fitFrame) return;
  view.fitFrame = requestAnimationFrame(() => {
    view.fitFrame = null;
    fit(view);
  });
}

function fit(view) {
  if (view.node.hidden || view.host.clientWidth < 30 || view.host.clientHeight < 30) return;
  try {
    view.fit.fit();
    if (view.running) api.resize(view.id, view.term.cols, view.term.rows).catch(error);
  } catch (reason) {
    error(reason);
  }
}

function makeTerminal(pane) {
  const node = document.createElement('section');
  node.className = 'pane';
  node.setAttribute('aria-label', pane.name);

  const header = document.createElement('div');
  header.className = 'pane-header';

  const dot = document.createElement('span');
  dot.className = 'pane-dot';

  const title = document.createElement('button');
  title.type = 'button';
  title.className = 'pane-title';
  title.textContent = pane.name;
  title.title = 'Nhấn để đổi tên Terminal';
  title.addEventListener('click', act(async () => {
    const result = await ask('Đổi tên terminal', title.textContent);
    if (result) {
      await update(s => {
        Object.values(s.panes).flat().find(p => p.id === pane.id).name = result.name;
      });
    }
  }));

  const modelBtn = document.createElement('button');
  modelBtn.type = 'button';
  modelBtn.className = 'pane-model-btn';
  modelBtn.hidden = true;
  modelBtn.setAttribute('aria-haspopup', 'menu');
  modelBtn.innerHTML = `${ICONS.sparkles}<span class="pane-model-label">Model</span>${ICONS.chevronDown}`;
  modelBtn.addEventListener('click', event => {
    event.stopPropagation();
    openModelPopover(pane.id, modelBtn);
  });

  const actions = document.createElement('div');
  actions.className = 'pane-actions';

  const restartBtn = iconButton(ICONS.restart, 'Khởi động lại terminal', async () => {
    if (view.running && !confirm('Dừng phiên hiện tại và mở shell mới?')) return;
    await api.kill(pane.id);
    view.running = false;
    view.runningAgent = null;
    view.detectedModel = null;
    view.detectedEffort = null;
    updatePaneModelButton(view, findPaneState(pane.id));
    view.term.reset();
    await start(view);
  }, 'pane-btn');

  const hideBtn = iconButton(ICONS.eyeSlash, 'Ẩn xuống thanh trạng thái (vẫn chạy ngầm)', () => update(s => {
    Object.values(s.panes).flat().find(p => p.id === pane.id).hidden = true;
  }), 'pane-btn');

  const zoomBtn = iconButton(ICONS.expand, 'Phóng to Terminal này', () => {
    maximized = maximized === pane.id ? null : pane.id;
    render();
  }, 'pane-btn');

  const closeBtn = iconButton(ICONS.close, 'Đóng và dừng terminal', async () => {
    if (!confirm('Đóng terminal và dừng lệnh đang chạy?')) return;
    await update(s => {
      for (const key of Object.keys(s.panes)) s.panes[key] = s.panes[key].filter(p => p.id !== pane.id);
    });
  }, 'pane-btn danger');

  actions.append(restartBtn, hideBtn, zoomBtn, closeBtn);
  header.append(dot, title, modelBtn, actions);

  const host = document.createElement('div');
  host.className = 'terminal-host';
  node.append(header, host);
  $('terminal-grid').append(node);

  const t = themes[state.settings.theme] || themes.graphite;
  const term = new Terminal({
    cursorBlink: true,
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace",
    fontSize: state.settings.fontSize,
    fontWeight: '500',
    fontWeightBold: '700',
    scrollback: 5000,
    theme: xtermThemeFor(t),
    allowProposedApi: false
  });
  const addon = new FitAddon.FitAddon();
  term.loadAddon(addon);
  term.open(host);

  const view = {
    id: pane.id, node, host, title, modelBtn, zoomBtn, term, fit: addon,
    running: false, runningAgent: null, agentPid: null, detectedModel: null, detectedEffort: null,
    themeId: state.settings.theme, observer: new ResizeObserver(() => queueFit(view))
  };
  terminals.set(pane.id, view);
  view.agentMarker = term.registerMarker(0);
  view.agentMarkerBuffer = term.buffer.active.type;
  updatePaneModelButton(view, pane);
  view.observer.observe(host);

  term.onData(data => { if (view.running) api.input(pane.id, data).catch(error); });
  term.onTitleChange(value => { node.title = value; });
  term.onWriteParsed(() => syncAgentModel(view));
  term.attachCustomKeyEventHandler(event => {
    const modifier = platform === 'darwin' ? event.metaKey : event.ctrlKey;
    if (modifier && ['t', ',', '\\'].includes(event.key.toLowerCase())) return false;
    if (platform !== 'darwin' && event.ctrlKey && event.shiftKey && ['c', 'v'].includes(event.key.toLowerCase())) {
      if (event.type === 'keydown' && event.shiftKey && event.key.toLowerCase() === 'c') api.copy(term.getSelection()).catch(error);
      if (event.type === 'keydown' && event.shiftKey && event.key.toLowerCase() === 'v') api.paste().then(text => term.paste(text)).catch(error);
      return false;
    }
    return true;
  });

  node.addEventListener('dragover', event => {
    if (event.dataTransfer.types.includes('application/x-termanager-command')) {
      event.preventDefault();
      node.classList.add('drag-over');
    }
  });
  node.addEventListener('dragleave', () => node.classList.remove('drag-over'));
  node.addEventListener('drop', event => {
    node.classList.remove('drag-over');
    const command = event.dataTransfer.getData('application/x-termanager-command');
    const cmdTitle = event.dataTransfer.getData('application/x-termanager-title');
    if (!command) return;
    event.preventDefault();
    if (view.running) {
      api.input(pane.id, command + '\r').then(closeAgentDrawer).catch(error);
      term.focus();
      const meta = agentMetaFor({ title: cmdTitle || '', command });
      const droppedModel = extractCommandModel(command);
      if (meta.key !== 'custom' || droppedModel) {
        act(() => update(s => {
          const target = Object.values(s.panes).flat().find(p => p.id === pane.id);
          if (!target) return;
          if (meta.key !== 'custom') target.agent = meta.key;
          if (droppedModel) target.model = droppedModel;
        }))();
      }
    } else error(new Error('Terminal đã dừng. Bấm khởi động lại để mở lại.'));
  });

  view.ready = start(view);
  view.ready.catch(error);
  return view;
}

async function start(view) {
  try {
    await api.start(view.id);
    view.running = true;
    view.node.classList.remove('exited');
    fit(view);
    if (!pendingAgentLaunches.has(view.id) && !view.node.hidden && !view.runningAgent) {
      agentDrawerAutoPane = view.id;
      openAgentDrawer();
    }
  } catch (reason) {
    view.running = false;
    view.node.classList.add('exited');
    view.term.writeln(`\r\nKhông mở được shell: ${reason.message}\r\nBấm khởi động lại để thử lại.`);
    throw reason;
  }
}

async function newTerminal(command, customName) {
  if ((state.panes[state.selected] || []).length >= 9) {
    throw new Error('Workspace đã có 9 terminal. Hãy đóng một terminal trước.');
  }
  const id = crypto.randomUUID();
  const meta = command ? agentMetaFor({ title: customName || '', command }) : null;
  const detectedModel = extractCommandModel(command);
  if (command) pendingAgentLaunches.add(id);
  try {
    await update(s => {
      const list = (s.panes[s.selected] ||= []);
      const pane = { id, name: customName || `Terminal ${list.length + 1}`, hidden: false };
      if (meta && meta.key !== 'custom') pane.agent = meta.key;
      if (detectedModel) pane.model = detectedModel;
      list.push(pane);
    });
    const view = terminals.get(id);
    await view.ready;
    view.term.focus();
    if (command) {
      await api.input(id, command + '\r');
      closeAgentDrawer();
    }
  } finally {
    pendingAgentLaunches.delete(id);
  }
}

function setSidebarCollapsed(collapsed) {
  $('sidebar').hidden = collapsed;
  $('sidebar-resizer').hidden = collapsed;
  $('topbar-settings').hidden = !collapsed;
  document.body.classList.toggle('sidebar-collapsed', collapsed);
}

api.onOutput((id, data) => terminals.get(id)?.term.write(data));
api.onAgent((id, agent, detectedModel, pid) => {
  const view = terminals.get(id);
  if (!view) return;
  const nextAgent = agent && Object.hasOwn(AGENT_MODELS, agent) ? agent : null;
  const agentChanged = view.runningAgent !== nextAgent || view.agentPid !== pid;
  if (agentChanged && activeModelPopover?.paneId === id) closeModelPopover();
  view.runningAgent = nextAgent;
  view.agentPid = pid;
  if (agentChanged) {
    view.detectedModel = detectedModel || null;
    view.detectedEffort = null;
    if (!nextAgent) {
      view.agentMarker?.dispose();
      view.agentMarker = view.term.registerMarker(0);
      view.agentMarkerBuffer = view.term.buffer.active.type;
    }
  }
  if (nextAgent && agentDrawerAutoPane === id) closeAgentDrawer();
  if (nextAgent && agentChanged) {
    loadAgentModels(nextAgent).then(() => {
      if (terminals.get(id) !== view || view.runningAgent !== nextAgent || view.agentPid !== pid) return;
      syncAgentModel(view);
      updatePaneModelButton(view, findPaneState(id));
    }).catch(error);
  }
  syncAgentModel(view);
  updatePaneModelButton(view, findPaneState(id));
});
api.onExit((id, code) => {
  const view = terminals.get(id);
  if (view) {
    view.running = false;
    view.runningAgent = null;
    view.detectedModel = null;
    view.detectedEffort = null;
    updatePaneModelButton(view, findPaneState(id));
    view.node.classList.add('exited');
    view.term.writeln(`\r\n[Đã kết thúc: ${code}. Bấm khởi động lại để mở lại.]`);
  }
});

// Sidebar & Topbar interactions
async function addProject(folder) {
  const existing = state.projects.find(p =>
    platform === 'win32' ? p.path.toLowerCase() === folder.path.toLowerCase() : p.path === folder.path
  );
  const id = existing?.id || crypto.randomUUID();
  await update(s => {
    if (!existing) {
      s.projects.push({ id, ...folder, tasks: [] });
      s.panes[id] = [];
    }
    s.selected = id;
  });
}

$('add-project').onclick = act(async () => {
  const folder = await api.folder();
  if (folder) await addProject(folder);
});

$('create-folder').onclick = act(async () => {
  if (state.projects.length >= 200) throw new Error('Workspace đã có 200 project.');
  const result = await ask('Tên thư mục mới', 'Thư mục mới');
  if (!result) return;
  const folder = await api.createFolder(result.name);
  if (folder) await addProject(folder);
});

$('new-terminal').onclick = $('empty-new').onclick = act(() => newTerminal());
$('empty-split').onclick = act(async () => {
  await newTerminal();
  await newTerminal();
});
$('exit-zoom').onclick = () => { maximized = null; render(); };

$('toggle-sidebar').onclick = () => setSidebarCollapsed(!$('sidebar').hidden);
$('collapse-sidebar').onclick = () => setSidebarCollapsed(true);

function updateAgentDrawerUI() {
  const isShown = agentDrawerVisible || agentDrawerPinned;
  const panel = $('commands-panel');
  panel.classList.toggle('open', isShown);
  panel.classList.toggle('pinned', agentDrawerPinned);
  document.querySelector('.stage-body').classList.toggle('agent-pinned', agentDrawerPinned);
  $('agent-hover-trigger').classList.toggle('hidden-trigger', isShown);
  $('commands-button').classList.toggle('active', isShown);
  $('pin-commands').classList.toggle('active', agentDrawerPinned);
  $('pin-commands').title = agentDrawerPinned
    ? 'Bỏ ghim (tự ẩn khi rời chuột)'
    : 'Ghim cố định bảng lệnh';
}

function openAgentDrawer() {
  if (agentHideTimer) { clearTimeout(agentHideTimer); agentHideTimer = null; }
  if (!agentDrawerVisible) {
    agentDrawerVisible = true;
    updateAgentDrawerUI();
  }
}

function closeAgentDrawer() {
  if (agentHideTimer) { clearTimeout(agentHideTimer); agentHideTimer = null; }
  agentDrawerAutoPane = null;
  agentDrawerPinned = false;
  agentDrawerVisible = false;
  updateAgentDrawerUI();
}

function scheduleHideAgentDrawer() {
  if (agentHideTimer) { clearTimeout(agentHideTimer); agentHideTimer = null; }
  if (agentDrawerPinned || agentDrawerAutoPane) return;
  agentHideTimer = setTimeout(() => {
    agentHideTimer = null;
    if (isHoveringAgentDrawer || isHoveringAgentTrigger || agentDrawerPinned || agentDrawerAutoPane || document.querySelector('dialog[open]')) return;
    agentDrawerVisible = false;
    updateAgentDrawerUI();
  }, 220);
}

$('agent-hover-trigger').addEventListener('mouseenter', () => {
  isHoveringAgentTrigger = true;
  openAgentDrawer();
});
$('agent-hover-trigger').addEventListener('mouseleave', () => {
  isHoveringAgentTrigger = false;
  scheduleHideAgentDrawer();
});

$('commands-panel').addEventListener('mouseenter', () => {
  isHoveringAgentDrawer = true;
  if (agentHideTimer) { clearTimeout(agentHideTimer); agentHideTimer = null; }
});
$('commands-panel').addEventListener('mouseleave', () => {
  isHoveringAgentDrawer = false;
  scheduleHideAgentDrawer();
});

$('pin-commands').onclick = () => {
  agentDrawerPinned = !agentDrawerPinned;
  if (agentDrawerPinned) agentDrawerVisible = true;
  updateAgentDrawerUI();
  if (!agentDrawerPinned && !isHoveringAgentDrawer) scheduleHideAgentDrawer();
};

$('commands-button').onclick = () => {
  const isShown = agentDrawerVisible || agentDrawerPinned;
  if (isShown) {
    closeAgentDrawer();
    return;
  } else {
    agentDrawerPinned = true;
    agentDrawerVisible = true;
  }
  updateAgentDrawerUI();
};
$('close-commands').onclick = closeAgentDrawer;

$('add-command').onclick = act(async () => {
  const result = await ask('Thêm lệnh agent', '', '');
  if (result) {
    await update(s => {
      s.commands.push({ id: crypto.randomUUID(), title: result.name, command: result.command });
    });
  }
  if (!agentDrawerPinned && !isHoveringAgentDrawer) scheduleHideAgentDrawer();
});

// Quick filter
$('project-filter').addEventListener('input', event => {
  projectFilter = event.target.value;
  renderSidebar();
});
$('clear-filter').addEventListener('click', () => {
  projectFilter = '';
  $('project-filter').value = '';
  renderSidebar();
  $('project-filter').focus();
});

// Copy path in status bar
$('copy-path').addEventListener('click', act(async () => {
  const info = entityInfo();
  if (!info.path) return;
  await api.copy(info.path);
  const btn = $('copy-path');
  btn.classList.add('copied');
  btn.innerHTML = ICONS.check;
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = ICONS.copy;
  }, 1200);
}));

// Drop Agent Command onto empty Launchpad
const emptyEl = $('empty');
emptyEl.addEventListener('dragover', event => {
  if (event.dataTransfer.types.includes('application/x-termanager-command')) {
    event.preventDefault();
    emptyEl.classList.add('drag-over');
    $('launchpad-tip').textContent = 'Thả vào đây để mở Terminal ngay';
  }
});
emptyEl.addEventListener('dragleave', () => {
  emptyEl.classList.remove('drag-over');
  $('launchpad-tip').textContent = 'Mẹo: Kéo lệnh Agent từ thanh bên vào đây để mở nhanh';
});
emptyEl.addEventListener('drop', event => {
  emptyEl.classList.remove('drag-over');
  $('launchpad-tip').textContent = 'Mẹo: Kéo lệnh Agent từ thanh bên vào đây để mở nhanh';
  const command = event.dataTransfer.getData('application/x-termanager-command');
  const title = event.dataTransfer.getData('application/x-termanager-title');
  if (!command) return;
  event.preventDefault();
  act(() => newTerminal(command, title || undefined))();
});

// Resizable Sidebar
const resizer = $('sidebar-resizer');
resizer.addEventListener('mousedown', event => {
  event.preventDefault();
  resizer.classList.add('dragging');
  const startX = event.clientX;
  const startWidth = $('sidebar').getBoundingClientRect().width;
  const onMove = moveEvent => {
    const next = Math.min(window.innerWidth - resizer.offsetWidth, Math.max(185, startWidth + (moveEvent.clientX - startX)));
    document.documentElement.style.setProperty('--sidebar-width', `${next}px`);
  };
  const onUp = () => {
    resizer.classList.remove('dragging');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
});

// Settings slide-over sheet
function openSettings() {
  $('shell').value = state.settings.shell;
  $('font-size').value = state.settings.fontSize;
  $('theme').value = state.settings.theme;
  $('app-opacity').value = state.settings.opacity ?? 100;
  $('opacity-value').textContent = `${state.settings.opacity ?? 100}%`;
  renderSettingsThemeCards(state.settings.theme);
  syncFontPreview(state.settings.fontSize);
  $('settings-dialog').showModal();
}

function closeSettings() {
  resetSettingsPreview();
  $('settings-dialog').close();
}

function resetSettingsPreview() {
  previewTheme(state.settings.theme);
  api.setOpacity(state.settings.opacity ?? 100).catch(error);
}

$('settings-button').onclick = $('topbar-settings').onclick = openSettings;
$('cancel-settings').onclick = $('cancel-settings-btn').onclick = closeSettings;
$('settings-dialog').addEventListener('cancel', resetSettingsPreview);
$('settings-dialog').addEventListener('click', event => {
  if (event.target === $('settings-dialog')) closeSettings();
});

$('font-size-slider').addEventListener('input', event => {
  $('font-size').value = event.target.value;
  syncFontPreview(event.target.value);
});
$('font-size').addEventListener('input', event => {
  syncFontPreview(event.target.value);
});

$('app-opacity').addEventListener('input', event => {
  const value = Number(event.target.value);
  $('opacity-value').textContent = `${value}%`;
  api.setOpacity(value).catch(error);
});

$('settings-form').onsubmit = event => {
  event.preventDefault();
  act(async () => {
    await update(s => {
      s.settings = {
        shell: $('shell').value,
        fontSize: Number($('font-size').value),
        theme: $('theme').value,
        opacity: Number($('app-opacity').value)
      };
    });
    $('settings-dialog').close();
  })();
};

$('dismiss-error').onclick = () => { $('error').hidden = true; };

document.addEventListener('keydown', event => {
  if (!(platform === 'darwin' ? event.metaKey : event.ctrlKey) || event.altKey || document.querySelector('dialog[open]')) return;
  const key = event.key.toLowerCase();
  if (key === 't') { event.preventDefault(); act(() => newTerminal())(); }
  if (key === ',') { event.preventDefault(); openSettings(); }
  if (key === '\\') { event.preventDefault(); $('toggle-sidebar').click(); }
});

act(async () => {
  const loaded = await api.load();
  ({ state, home, platform } = loaded);
  document.body.classList.add(`platform-${platform}`);
  $('platform-label').textContent = `${platform === 'darwin' ? 'macOS' : 'Windows'} · ${loaded.arch} · Glass & Graphite`;
  $('shell').replaceChildren(...Object.entries(loaded.shells).map(([value, label]) => new Option(label, value)));
  const modifier = platform === 'darwin' ? '⌘' : 'Ctrl+';
  $('toggle-sidebar').title = `Ẩn/hiện sidebar (${modifier}\\)`;
  $('collapse-sidebar').title = `Thu gọn sidebar (${modifier}\\)`;
  $('new-terminal').title = `Mở thêm Terminal mới (${modifier}T)`;
  $('empty-new-sub').textContent = `1 cửa sổ • ${modifier}T`;
  $('settings-button').title = `Thiết lập & Giao diện (${modifier},)`;
  $('topbar-settings').title = `Thiết lập & Giao diện (${modifier},)`;
  $('settings-shortcut').textContent = `${modifier}, Thiết lập`;
  render();
  // shortcut: reopen shells without replaying commands; terminal output is kept only until app exit.
})();
