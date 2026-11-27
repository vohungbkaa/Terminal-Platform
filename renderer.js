/* global Terminal, FitAddon */
const api = window.desktop;
const $ = id => document.getElementById(id);
let state, home, platform, maximized = null, actionQueue = Promise.resolve();
const terminals = new Map();
const palettes = {
  graphite: ['#0e1015', '#141720', '#1a1e29', '#5e9bff', '#101218', '#e6eaf1'],
  obsidian: ['#09090b', '#111114', '#1c1c22', '#a78bfa', '#0c0c10', '#ededf3'],
  warmDusk: ['#191312', '#231c1a', '#302522', '#eda778', '#171110', '#f0e0d5'],
  nordFrost: ['#242b38', '#2e3440', '#3b4252', '#88c0d0', '#1e2430', '#d8dee9']
};
function error(reason) { $('error').querySelector('span').textContent = reason.message || String(reason); $('error').hidden = false; }
function act(callback) {
  return (...args) => {
    actionQueue = actionQueue.then(() => callback(...args)).catch(error);
    return actionQueue;
  };
}
function button(label, title, callback, className = '') {
  const node = document.createElement('button');
  node.type = 'button'; node.textContent = label; node.title = title; node.setAttribute('aria-label', title);
  node.className = className; node.addEventListener('click', act(callback));
  return node;
}
async function update(change) {
  const next = structuredClone(state);
  change(next);
  await api.save(next);
  state = next;
  render();
}
function entityInfo() {
  if (state.selected === 'home') return { name: 'Terminal', path: home };
  for (const project of state.projects) {
    if (project.id === state.selected) return project;
    const task = project.tasks.find(t => t.id === state.selected);
    if (task) return { name: `${project.name} / ${task.name}`, path: project.path };
  }
}
function ask(title, value = '', command) {
  return new Promise(resolve => {
    const dialog = $('text-dialog');
    $('text-title').textContent = title;
    $('text-value').value = value;
    $('command-label').hidden = command === undefined;
    $('command-value').required = command !== undefined;
    $('command-value').value = command || '';
    const finish = result => { dialog.close(); dialog.oncancel = null; $('text-form').onsubmit = null; resolve(result); };
    $('text-form').onsubmit = event => {
      event.preventDefault();
      const name = $('text-value').value.trim(), cmd = $('command-value').value.trim();
      if (name && (command === undefined || cmd)) finish({ name, command: cmd });
    };
    $('cancel-text').onclick = () => finish(null);
    dialog.oncancel = event => { event.preventDefault(); finish(null); };
    dialog.showModal(); $('text-value').focus(); $('text-value').select();
  });
}
function grid(count) {
  return count <= 1 ? [1, 1] : count === 2 ? [1, 2] : count <= 4 ? [2, 2] : count <= 6 ? [2, 3] : [3, 3];
}
function render() {
  const palette = palettes[state.settings.theme];
  ['--bg', '--surface', '--elevated', '--accent', '--terminal', '--text'].forEach((key, i) => document.documentElement.style.setProperty(key, palette[i]));
  renderSidebar(); renderCommands();
  const info = entityInfo();
  $('workspace-title').textContent = info.name; $('workspace-path').textContent = info.path;
  const panes = state.panes[state.selected] || [];
  const visible = panes.filter(p => !p.hidden);
  if (!visible.some(p => p.id === maximized)) maximized = null;
  const [rows, cols] = maximized ? [1, 1] : grid(visible.length);
  $('terminal-grid').style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  $('terminal-grid').style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  const allIDs = new Set(Object.values(state.panes).flat().map(p => p.id));
  for (const [id, view] of terminals) {
    if (!allIDs.has(id)) { view.observer.disconnect(); view.term.dispose(); view.node.remove(); terminals.delete(id); }
  }
  for (const [entity, slots] of Object.entries(state.panes)) {
    for (const pane of slots) {
      let view = terminals.get(pane.id);
      if (!view && entity === state.selected && !pane.hidden) view = makeTerminal(pane);
      if (!view) continue;
      view.node.hidden = entity !== state.selected || pane.hidden || (maximized && maximized !== pane.id);
      view.title.textContent = pane.name;
      view.term.options.fontSize = state.settings.fontSize;
      view.term.options.theme = { background: palette[4], foreground: palette[5], cursor: palette[3], selectionBackground: '#5e9bff55' };
      if (!view.node.hidden) requestAnimationFrame(() => fit(view));
    }
  }
  $('empty').hidden = visible.length !== 0;
  $('new-terminal').disabled = panes.length >= 9;
  $('empty-new').disabled = panes.length >= 9;
  $('status').textContent = `${visible.length} đang hiện · ${panes.length}/9 terminal`;
  $('hidden-panes').replaceChildren();
  for (const pane of panes.filter(p => p.hidden)) {
    $('hidden-panes').append(button(`↗ ${pane.name}`, 'Khôi phục terminal', () => update(s => { s.panes[s.selected].find(p => p.id === pane.id).hidden = false; })));
  }
}
function renderSidebar() {
  const nav = $('projects'); nav.replaceChildren();
  const row = (id, name, className) => {
    const node = document.createElement('div'); node.className = `${className} ${state.selected === id ? 'selected' : ''}`;
    node.append(button(name, name, () => update(s => { s.selected = id; }), 'select'));
    nav.append(node); return node;
  };
  row('home', '❯_ Terminal', 'project-row');
  for (const project of state.projects) {
    const node = row(project.id, `▱ ${project.name}`, 'project-row');
    node.append(button('+', 'Thêm task', async () => {
      let number = 1;
      while (project.tasks.some(t => t.name === `Task ${number}`)) number++;
      const result = await ask('Thêm task', `Task ${number}`);
      if (!result) return;
      const id = crypto.randomUUID();
      await update(s => { s.projects.find(p => p.id === project.id).tasks.push({ id, name: result.name }); s.selected = id; s.panes[id] = []; });
      const command = state.commands.find(c => c.title.toLowerCase() === result.name.toLowerCase());
      await newTerminal(command?.command);
    }, 'row-action'));
    node.append(button('×', 'Xóa project khỏi danh sách', async () => {
      if (!confirm(`Xóa “${project.name}” khỏi danh sách và dừng các terminal của project? Thư mục trên ổ đĩa được giữ nguyên.`)) return;
      const ids = new Set([project.id, ...project.tasks.map(t => t.id)]);
      await update(s => { s.projects = s.projects.filter(p => p.id !== project.id); for (const id of ids) delete s.panes[id]; if (ids.has(s.selected)) s.selected = 'home'; });
    }, 'row-action'));
    for (const task of project.tasks) {
      const taskRow = row(task.id, task.name, 'task-row');
      taskRow.append(button('✎', 'Đổi tên task', async () => {
        const result = await ask('Đổi tên task', task.name);
        if (result) await update(s => { s.projects.find(p => p.id === project.id).tasks.find(t => t.id === task.id).name = result.name; });
      }, 'row-action'));
      taskRow.append(button('×', 'Xóa task', async () => {
        if (!confirm(`Xóa task “${task.name}” và dừng các terminal của task?`)) return;
        await update(s => {
          s.projects.find(p => p.id === project.id).tasks = s.projects.find(p => p.id === project.id).tasks.filter(t => t.id !== task.id);
          delete s.panes[task.id]; if (s.selected === task.id) s.selected = project.id;
        });
      }, 'row-action'));
    }
  }
}
function renderCommands() {
  $('commands').replaceChildren();
  for (const preset of state.commands) {
    const row = document.createElement('div'); row.className = 'command-row';
    const launch = button(preset.title, preset.command, () => newTerminal(preset.command));
    const description = document.createElement('small'); description.textContent = preset.command; launch.append(description);
    launch.draggable = true;
    launch.addEventListener('dragstart', event => event.dataTransfer.setData('application/x-termanager-command', preset.command));
    row.append(launch, button('✎', 'Sửa lệnh', async () => {
      const result = await ask('Sửa lệnh', preset.title, preset.command);
      if (result) await update(s => { Object.assign(s.commands.find(c => c.id === preset.id), { title: result.name, command: result.command }); });
    }), button('×', 'Xóa lệnh', async () => {
      if (confirm(`Xóa lệnh “${preset.title}”?`)) await update(s => { s.commands = s.commands.filter(c => c.id !== preset.id); });
    }));
    $('commands').append(row);
  }
}
function fit(view) {
  if (view.node.hidden || view.host.clientWidth < 30 || view.host.clientHeight < 30) return;
  try {
    view.fit.fit();
    if (view.running) api.resize(view.id, view.term.cols, view.term.rows).catch(error);
  } catch (reason) { error(reason); }
}
function makeTerminal(pane) {
  const node = document.createElement('section'); node.className = 'pane'; node.setAttribute('aria-label', pane.name);
  const header = document.createElement('div'); header.className = 'pane-header';
  const title = button(pane.name, 'Đổi tên terminal', async () => {
    const result = await ask('Đổi tên terminal', title.textContent);
    if (result) await update(s => { Object.values(s.panes).flat().find(p => p.id === pane.id).name = result.name; });
  }, 'pane-title');
  header.append(title, button('↻', 'Khởi động lại terminal', async () => {
    if (view.running && !confirm('Dừng phiên hiện tại và mở shell mới?')) return;
    await api.kill(pane.id); view.running = false; view.term.reset(); await start(view);
  }), button('−', 'Ẩn terminal, giữ phiên chạy', () => update(s => { Object.values(s.panes).flat().find(p => p.id === pane.id).hidden = true; })),
  button('□', 'Phóng to/khôi phục terminal', () => { maximized = maximized === pane.id ? null : pane.id; render(); }),
  button('×', 'Đóng và dừng terminal', async () => {
    if (!confirm('Đóng terminal và dừng lệnh đang chạy?')) return;
    await update(s => { for (const key of Object.keys(s.panes)) s.panes[key] = s.panes[key].filter(p => p.id !== pane.id); });
  }));
  const host = document.createElement('div'); host.className = 'terminal-host'; node.append(header, host); $('terminal-grid').append(node);
  const term = new Terminal({ cursorBlink: true, fontFamily: 'Cascadia Mono, Menlo, Consolas, monospace', fontSize: state.settings.fontSize, scrollback: 5000, allowProposedApi: false });
  const addon = new FitAddon.FitAddon(); term.loadAddon(addon); term.open(host);
  const view = { id: pane.id, node, host, title, term, fit: addon, running: false, observer: new ResizeObserver(() => fit(view)) };
  terminals.set(pane.id, view); view.observer.observe(host);
  term.onData(data => { if (view.running) api.input(pane.id, data).catch(error); });
  term.onTitleChange(value => { node.title = value; });
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
    if (event.dataTransfer.types.includes('application/x-termanager-command')) { event.preventDefault(); node.classList.add('drag-over'); }
  });
  node.addEventListener('dragleave', () => node.classList.remove('drag-over'));
  node.addEventListener('drop', event => {
    node.classList.remove('drag-over');
    const command = event.dataTransfer.getData('application/x-termanager-command');
    if (!command) return;
    event.preventDefault();
    if (view.running) { term.paste(command); term.focus(); }
    else error(new Error('Terminal đã dừng. Bấm ↻ để mở lại.'));
  });
  view.ready = start(view);
  view.ready.catch(error);
  return view;
}
async function start(view) {
  try { await api.start(view.id); view.running = true; fit(view); }
  catch (reason) { view.running = false; view.term.writeln(`\r\nKhông mở được shell: ${reason.message}\r\nBấm ↻ để thử lại.`); throw reason; }
}
async function newTerminal(command) {
  if ((state.panes[state.selected] || []).length >= 9) throw new Error('Workspace đã có 9 terminal. Hãy đóng một terminal trước.');
  const id = crypto.randomUUID();
  await update(s => { (s.panes[s.selected] ||= []).push({ id, name: `Terminal ${s.panes[s.selected].length + 1}`, hidden: false }); });
  const view = terminals.get(id); await view.ready; view.term.focus();
  if (command) await api.input(id, command + '\r');
}
api.onOutput((id, data) => terminals.get(id)?.term.write(data));
api.onExit((id, code) => {
  const view = terminals.get(id);
  if (view) { view.running = false; view.term.writeln(`\r\n[Đã kết thúc: ${code}. Bấm ↻ để mở lại.]`); }
});
$('add-project').onclick = act(async () => {
  const folder = await api.folder(); if (!folder) return;
  const existing = state.projects.find(p => platform === 'win32' ? p.path.toLowerCase() === folder.path.toLowerCase() : p.path === folder.path);
  const id = existing?.id || crypto.randomUUID();
  await update(s => { if (!existing) { s.projects.push({ id, ...folder, tasks: [] }); s.panes[id] = []; } s.selected = id; });
});
$('new-terminal').onclick = $('empty-new').onclick = act(() => newTerminal());
$('toggle-sidebar').onclick = () => { $('sidebar').hidden = !$('sidebar').hidden; };
$('commands-button').onclick = () => { $('commands-panel').hidden = !$('commands-panel').hidden; };
$('close-commands').onclick = () => { $('commands-panel').hidden = true; };
$('add-command').onclick = act(async () => {
  const result = await ask('Thêm lệnh agent', '', '');
  if (result) await update(s => { s.commands.push({ id: crypto.randomUUID(), title: result.name, command: result.command }); });
});
$('settings-button').onclick = () => {
  $('shell').value = state.settings.shell; $('font-size').value = state.settings.fontSize; $('theme').value = state.settings.theme;
  $('settings-dialog').showModal();
};
$('cancel-settings').onclick = () => $('settings-dialog').close();
$('settings-form').onsubmit = event => {
  event.preventDefault();
  act(async () => {
    await update(s => { s.settings = { shell: $('shell').value, fontSize: Number($('font-size').value), theme: $('theme').value }; });
    $('settings-dialog').close();
  })();
};
$('dismiss-error').onclick = () => { $('error').hidden = true; };
document.addEventListener('keydown', event => {
  if (!(platform === 'darwin' ? event.metaKey : event.ctrlKey) || event.altKey || document.querySelector('dialog[open]')) return;
  const key = event.key.toLowerCase();
  if (key === 't') { event.preventDefault(); act(() => newTerminal())(); }
  if (key === ',') { event.preventDefault(); $('settings-button').click(); }
  if (key === '\\') { event.preventDefault(); $('toggle-sidebar').click(); }
});
act(async () => {
  const loaded = await api.load();
  ({ state, home, platform } = loaded);
  $('platform-label').textContent = `${platform === 'darwin' ? 'macOS' : 'WINDOWS'} · ${loaded.arch}`;
  $('shell-label').textContent = platform === 'darwin' ? 'Zsh / Bash' : 'PowerShell / CMD';
  $('shell').replaceChildren(...Object.entries(loaded.shells).map(([value, label]) => new Option(label, value)));
  const modifier = platform === 'darwin' ? 'Cmd' : 'Ctrl';
  $('toggle-sidebar').title = `Ẩn/hiện sidebar (${modifier}+\\)`;
  $('empty-new').textContent = `Mở Terminal · ${modifier}+T`;
  $('settings-shortcut').textContent = `${modifier}+, Thiết lập`;
  render();
  // shortcut: reopen shells without replaying commands; terminal output is kept only until app exit.
})();
