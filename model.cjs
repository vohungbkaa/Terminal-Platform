const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const themes = ['graphite', 'obsidian', 'warmDusk', 'nordFrost', 'hacker'];
const windowsShells = { 'powershell.exe': 'Windows PowerShell', 'pwsh.exe': 'PowerShell 7 (cần cài riêng)', 'cmd.exe': 'Command Prompt' };
const shells = process.platform === 'win32' ? windowsShells : { '/bin/zsh': 'Zsh', '/bin/bash': 'Bash' };
const defaultCommands = [
  { title: 'agy • Default', command: 'agy' },
  { title: 'agy • Skip permissions', command: 'agy --dangerously-skip-permissions' },
  { title: 'codex • Default', command: 'codex' },
  { title: 'codex • Bypass approvals', command: 'codex --dangerously-bypass-approvals-and-sandbox' },
  { title: 'claude • Default', command: 'claude' },
  { title: 'claude • Skip permissions', command: 'claude --dangerously-skip-permissions' },
  { title: 'gemini • Default', command: 'gemini' }
];
function defaults() {
  return {
    version: 1, projects: [], panes: { home: [] }, selected: 'home',
    settings: { fontSize: 13, theme: 'graphite', shell: Object.keys(shells)[0], opacity: 100 },
    commands: defaultCommands.map(item => ({ id: randomUUID(), ...item }))
  };
}
function text(value, max = 4096) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) {
    throw new Error('Giá trị văn bản không hợp lệ.');
  }
  return value;
}
function validateOpacity(value) {
  if (!Number.isInteger(value) || value < 40 || value > 100) throw new Error('Độ đục phải từ 40 đến 100%.');
  return value;
}
function validate(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.projects) || state.projects.length > 200) {
    throw new Error('Dữ liệu workspace không hợp lệ.');
  }
  const ids = new Set(['home']);
  const addID = id => {
    text(id, 100);
    if (!/^[a-zA-Z0-9-]+$/.test(id) || ids.has(id)) throw new Error('ID trùng hoặc không hợp lệ.');
    ids.add(id);
  };
  for (const project of state.projects) {
    addID(project.id); text(project.name, 200); text(project.path);
    if (!path.isAbsolute(project.path) || !Array.isArray(project.tasks)) throw new Error('Project không hợp lệ.');
    if (project.tasks.length > 200) throw new Error('Quá nhiều task.');
    for (const task of project.tasks) { addID(task.id); text(task.name, 200); }
  }
  if (!ids.has(state.selected)) throw new Error('Workspace được chọn không tồn tại.');
  if (!state.panes || typeof state.panes !== 'object' || Array.isArray(state.panes)) throw new Error('Layout không hợp lệ.');
  const paneIDs = new Set();
  for (const [entity, panes] of Object.entries(state.panes)) {
    if (!ids.has(entity) || !Array.isArray(panes) || panes.length > 9) throw new Error('Mỗi workspace tối đa 9 terminal.');
    for (const pane of panes) {
      text(pane.id, 100); text(pane.name, 200);
      if (!/^[a-zA-Z0-9-]+$/.test(pane.id) || paneIDs.has(pane.id) || typeof pane.hidden !== 'boolean') throw new Error('Terminal không hợp lệ.');
      if (pane.agent !== undefined) text(pane.agent, 40);
      if (pane.model !== undefined) text(pane.model, 200);
      paneIDs.add(pane.id);
    }
  }
  if (!state.settings || !themes.includes(state.settings.theme) ||
      !Number.isInteger(state.settings.fontSize) || state.settings.fontSize < 9 || state.settings.fontSize > 32 ||
      !Object.hasOwn(shells, state.settings.shell)) throw new Error('Thiết lập không hợp lệ.');
  if (state.settings.opacity !== undefined) validateOpacity(state.settings.opacity);
  if (!Array.isArray(state.commands) || state.commands.length > 200) throw new Error('Danh sách lệnh không hợp lệ.');
  for (const command of state.commands) { text(command.id, 100); text(command.title, 200); text(command.command); }
  return state;
}
function entityPath(state, entity, home) {
  if (entity === 'home') return home;
  const project = state.projects.find(p => p.id === entity || p.tasks.some(t => t.id === entity));
  if (!project) throw new Error('Workspace không tồn tại.');
  return project.path;
}
function findPane(state, id) {
  for (const [entity, panes] of Object.entries(state.panes)) {
    if (panes.some(p => p.id === id)) return entity;
  }
  throw new Error('Terminal không tồn tại.');
}
function isLegacyDefaultCommands(commands) {
  if (!Array.isArray(commands) || commands.length !== 4) return false;
  const legacy = ['agy', 'codex', 'claude', 'gemini'];
  return commands.every((item, i) => item && item.title === legacy[i] && item.command === legacy[i]);
}
function load(file) {
  try {
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    // Earlier desktop builds stored a Windows shell even when running on macOS.
    if (process.platform === 'darwin' && Object.hasOwn(windowsShells, state?.settings?.shell)) state.settings.shell = '/bin/zsh';
    // Upgrade legacy bare default commands to the full preset set.
    if (isLegacyDefaultCommands(state?.commands)) {
      state.commands = defaultCommands.map(item => ({ id: randomUUID(), ...item }));
    }
    return validate(state);
  }
  catch (error) { if (error.code === 'ENOENT') return defaults(); throw error; }
}
function save(file, state) {
  validate(state);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, file);
}
const AGENT_RUNNERS = new Set(['env', 'node', 'nodejs', 'bun', 'deno', 'npx', 'pnpx', 'python', 'python3', 'sh', 'bash', 'zsh']);

async function createFolder(parent, name) {
  text(parent);
  text(name, 200);
  if (!path.isAbsolute(parent) || name === '.' || name === '..' || /[/\\\x00-\x1f]/.test(name)) {
    throw new Error('Đường dẫn hoặc tên thư mục không hợp lệ.');
  }
  const directory = path.join(parent, name);
  await fs.promises.mkdir(directory);
  return { path: directory, name };
}

function isWithinDirectory(root, directory) {
  const relative = path.relative(root, directory);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function resolveProjectPath(state, projectId, relative) {
  text(projectId, 100);
  const project = state.projects.find(item => item.id === projectId);
  if (!project || typeof relative !== 'string' || relative.length > 4096 || relative.includes('\0') || path.isAbsolute(relative)) {
    throw new Error('Thư mục dự án không hợp lệ.');
  }
  const root = await fs.promises.realpath(project.path);
  const directory = await fs.promises.realpath(path.resolve(root, relative));
  if (!isWithinDirectory(root, directory)) {
    throw new Error('Chỉ được duyệt thư mục trong project.');
  }
  return { project, root, directory };
}

async function listDirectory(state, projectId, relative = '') {
  const { project, root, directory } = await resolveProjectPath(state, projectId, relative);
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => {
    let isDirectory = entry.isDirectory();
    if (entry.isSymbolicLink()) {
      try {
        const target = await fs.promises.realpath(path.join(directory, entry.name));
        if (isWithinDirectory(root, target)) isDirectory = (await fs.promises.stat(target)).isDirectory();
      } catch { /* Broken or unreadable links remain draggable leaves. */ }
    }
    return {
      name: entry.name, path: path.join(project.path, relative, entry.name),
      relative: path.join(relative, entry.name), directory: isDirectory
    };
  }))).sort((a, b) => a.directory === b.directory ? a.name.localeCompare(b.name) : a.directory ? -1 : 1);
}
const AGENT_BINARIES = new Map([
  ['claude', 'claude'],
  ['claude-code', 'claude'],
  ['codex', 'codex'],
  ['gemini', 'gemini'],
  ['gemini-cli', 'gemini'],
  ['agy', 'agy'],
  ['antigravity', 'agy']
]);

function parseAgentModels(output) {
  return output.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^([a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199})\t([^\t\x00-\x1f]{1,200})$/);
    return match ? [{ id: match[1], label: match[2].trim() }] : [];
  });
}

function parseCodexModels(catalog) {
  const levels = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
  if (!Array.isArray(catalog?.models)) return [];
  return catalog.models.flatMap(item => {
    if (!item || item.visibility !== 'list' || typeof item.slug !== 'string' ||
        !/^[\w.:/-]{1,200}$/.test(item.slug) || typeof item.display_name !== 'string' ||
        !item.display_name.trim() || /[\x00-\x1f]/.test(item.display_name)) return [];
    const base = { id: item.slug, label: item.display_name.slice(0, 200) };
    const efforts = Array.isArray(item.supported_reasoning_levels)
      ? item.supported_reasoning_levels.filter(level => levels.has(level?.effort)) : [];
    return efforts.length ? efforts.map(level => ({
      ...base, label: `${base.label} (${level.effort[0].toUpperCase()}${level.effort.slice(1)})`,
      effort: level.effort, default: level.effort === item.default_reasoning_level
    })) : [base];
  });
}

function extractModelFlag(command) {
  if (typeof command !== 'string' || !command) return null;
  const match = command.match(/(?:^|\s)(?:--model|-m)(?:=|\s+)(?:"([^"]+)"|'([^']+)'|(\S+))/);
  const value = match && (match[1] || match[2] || match[3]);
  return value ? value.trim().slice(0, 200) : null;
}

function normalizeBinaryToken(token) {
  if (!token) return '';
  const cleaned = token.replace(/^['"]|['"]$/g, '');
  const base = path.basename(cleaned.replace(/\\/g, '/')).toLowerCase();
  return base.replace(/\.(exe|cmd|bat|mjs|cjs|js)$/i, '');
}

function detectAgentFromArgs(args) {
  if (typeof args !== 'string' || !args.trim()) return null;
  const tokens = args.trim().split(/\s+/);
  let index = 0;
  while (index < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index])) index++;
  const first = normalizeBinaryToken(tokens[index]);
  if (!first) return null;
  if (AGENT_BINARIES.has(first)) {
    return { agent: AGENT_BINARIES.get(first), model: extractModelFlag(args) };
  }
  if (AGENT_RUNNERS.has(first)) {
    let sawFirstArg = false;
    for (let i = index + 1; i < tokens.length; i++) {
      const tok = tokens[i];
      if (!tok || /^[A-Za-z_][A-Za-z0-9_]*=/.test(tok)) continue;
      if (tok.startsWith('-')) {
        if (sawFirstArg) break;
        continue;
      }
      const candidate = normalizeBinaryToken(tok);
      if (AGENT_BINARIES.has(candidate) && (!sawFirstArg || tok.includes('/') || tok.includes('\\'))) {
        return { agent: AGENT_BINARIES.get(candidate), model: extractModelFlag(args) };
      }
      if (!AGENT_RUNNERS.has(candidate)) sawFirstArg = true;
    }
  }
  return null;
}

module.exports = { defaults, validate, entityPath, findPane, load, save, text, shells, detectAgentFromArgs, extractModelFlag, parseAgentModels, parseCodexModels, createFolder, validateOpacity, listDirectory, resolveProjectPath };
