const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const model = require('../model.cjs');

test('createFolder creates a real Unicode directory and rejects traversal and existing paths', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'termanager-folder-'));
  try {
    const folder = await model.createFolder(parent, 'Dự án mới');
    assert.deepEqual(folder, { name: 'Dự án mới', path: path.join(parent, 'Dự án mới') });
    assert.equal(fs.statSync(folder.path).isDirectory(), true);
    fs.writeFileSync(path.join(folder.path, 'keep.txt'), 'keep');
    await assert.rejects(model.createFolder(parent, folder.name), { code: 'EEXIST' });
    assert.equal(fs.readFileSync(path.join(folder.path, 'keep.txt'), 'utf8'), 'keep');
    for (const name of ['.', '..', '../escape', 'nested/folder', 'nested\\folder', 'bad\nname', '']) {
      await assert.rejects(model.createFolder(parent, name));
    }
    await assert.rejects(model.createFolder('relative/path', 'new-folder'));
    assert.deepEqual(fs.readdirSync(parent), ['Dự án mới']);
  } finally { fs.rmSync(parent, { recursive: true, force: true }); }
});

test('default and selectable shells match the current platform', () => {
  const state = model.defaults();
  assert.equal(state.settings.shell, process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh');
  for (const shell of Object.keys(model.shells)) {
    state.settings.shell = shell;
    assert.equal(model.validate(state), state);
  }
  state.settings.shell = process.platform === 'win32' ? '/bin/zsh' : 'cmd.exe';
  assert.throws(() => model.validate(state));
  if (process.platform === 'darwin') {
    for (const arch of ['arm64', 'x64']) {
      assert.ok(fs.statSync(path.join(__dirname, `../node_modules/node-pty/prebuilds/darwin-${arch}/spawn-helper`)).mode & 0o111);
    }
  }
});

test('Hacker theme and opacity persist while old settings remain valid', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'termanager-appearance-'));
  try {
    const state = model.defaults();
    const file = path.join(directory, 'workspace.json');
    assert.equal(state.settings.opacity, 100);
    delete state.settings.opacity;
    model.save(file, state);
    assert.equal(model.load(file).settings.opacity, undefined);
    state.settings.theme = 'hacker';
    state.settings.opacity = 80;
    model.save(file, state);
    assert.deepEqual(model.load(file), state);
    const saved = fs.readFileSync(file, 'utf8');
    for (const value of [0, 39, 101, 75.5, '80', null, NaN, Infinity]) {
      state.settings.opacity = value;
      assert.throws(() => model.save(file, state));
      assert.equal(fs.readFileSync(file, 'utf8'), saved);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('legacy macOS workspace selects zsh without losing layout or overwriting the original', { skip: process.platform !== 'darwin' }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'termanager-'));
  try {
    const file = path.join(directory, 'workspace.json');
    const state = model.defaults();
    state.panes.home.push({ id: 'old-terminal', name: 'Terminal', hidden: false });
    state.settings.shell = 'powershell.exe';
    const original = JSON.stringify(state);
    fs.writeFileSync(file, original);
    const loaded = model.load(file);
    assert.equal(loaded.settings.shell, '/bin/zsh');
    assert.deepEqual(loaded.panes, state.panes);
    assert.equal(fs.readFileSync(file, 'utf8'), original);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('workspace round trip, paths with Unicode and spaces, task shares project cwd', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'termanager-'));
  try {
    const file = path.join(directory, 'data', 'workspace.json');
    const state = model.defaults();
    const projectPath = path.join(directory, 'Dự án của tôi');
    state.projects.push({ id: 'project-1', name: 'Dự án', path: projectPath, tasks: [{ id: 'task-1', name: 'codex' }] });
    state.panes['task-1'] = [{ id: 'pane-1', name: 'Terminal', hidden: true, agent: 'codex', model: 'gpt-5.4' }];
    state.selected = 'task-1';
    model.save(file, state);
    assert.deepEqual(model.load(file), state);
    assert.equal(model.entityPath(state, 'task-1', os.homedir()), projectPath);
    assert.equal(model.findPane(state, 'pane-1'), 'task-1');
    state.panes['task-1'][0].hidden = false;
    model.save(file, state);
    assert.equal(model.load(file).panes['task-1'][0].hidden, false);
    assert.equal(fs.existsSync(file + '.tmp'), false);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('invalid state never overwrites the last valid workspace', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'termanager-'));
  try {
    const file = path.join(directory, 'workspace.json');
    const state = model.defaults(); model.save(file, state);
    const original = fs.readFileSync(file, 'utf8');
    const rejects = change => {
      const next = structuredClone(state); change(next);
      assert.throws(() => model.save(file, next));
      assert.equal(fs.readFileSync(file, 'utf8'), original);
    };
    rejects(s => { s.panes.home = Array.from({ length: 10 }, (_, i) => ({ id: `pane-${i}`, name: 'Terminal', hidden: false })); });
    rejects(s => { s.settings.fontSize = 100; });
    rejects(s => { s.settings.shell = 'unknown.exe'; });
    rejects(s => { s.selected = 'missing'; });
    rejects(s => { s.panes.orphan = []; });
    rejects(s => { s.projects = [{ id: 'home', name: 'X', path: directory, tasks: [] }]; });
    rejects(s => { s.projects = [{ id: 'p', name: 'X', path: 'relative', tasks: [] }]; });
    rejects(s => { s.panes.home = [{ id: 'x', name: 'X', hidden: false }, { id: 'x', name: 'X', hidden: false }]; });
    rejects(s => { s.panes.home = [{ id: 'x', name: 'X', hidden: false, model: '   ' }]; });
    rejects(s => { s.panes.home = [{ id: 'x', name: 'X', hidden: false, agent: 'a'.repeat(41) }]; });
    assert.throws(() => model.entityPath(state, 'missing', directory));
    assert.throws(() => model.findPane(state, 'missing'));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('missing workspace uses defaults; corrupt data is reported and preserved', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'termanager-'));
  try {
    const file = path.join(directory, 'workspace.json');
    assert.equal(model.load(file).selected, 'home');
    fs.writeFileSync(file, '{corrupt');
    assert.throws(() => model.load(file));
    assert.equal(fs.readFileSync(file, 'utf8'), '{corrupt');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('detectAgentFromArgs identifies running agent binaries and ignores non-agent commands', () => {
  assert.deepEqual(model.detectAgentFromArgs('claude --dangerously-skip-permissions'), { agent: 'claude', model: null });
  assert.deepEqual(model.detectAgentFromArgs('node /Users/dev/.nvm/versions/node/v24/bin/claude --model opus'), { agent: 'claude', model: 'opus' });
  assert.deepEqual(model.detectAgentFromArgs('node /tmp/my folder/dự án/claude'), { agent: 'claude', model: null });
  assert.deepEqual(model.detectAgentFromArgs('/Users/dev/.local/bin/codex --model=gpt-5.4'), { agent: 'codex', model: 'gpt-5.4' });
  assert.deepEqual(model.detectAgentFromArgs('npx @google/gemini-cli -m gemini-2.5-pro'), { agent: 'gemini', model: 'gemini-2.5-pro' });
  assert.deepEqual(model.detectAgentFromArgs('/Users/dev/.local/bin/agy'), { agent: 'agy', model: null });
  assert.equal(model.detectAgentFromArgs('/bin/zsh -l'), null);
  assert.equal(model.detectAgentFromArgs('vim claude.md'), null);
  assert.equal(model.detectAgentFromArgs('echo codex'), null);
  assert.equal(model.detectAgentFromArgs('grep gemini README.md'), null);
});


test('parseAgentModels reads the CLI catalog and ignores notices and malformed entries', () => {
  assert.deepEqual(model.parseAgentModels('Fetching available models...\n' +
    'gemini-4-neon-medium\tGemini 4 Neon (Medium)\r\n' +
    'claude-opus-5-5-high\tClaude Opus 5.5 (High)\n' +
    'bad id\tInvalid\ninvalid\tLabel\tExtra\n'), [
    { id: 'gemini-4-neon-medium', label: 'Gemini 4 Neon (Medium)' },
    { id: 'claude-opus-5-5-high', label: 'Claude Opus 5.5 (High)' }
  ]);
});

test('Codex catalog uses visible CLI models and their actual reasoning levels', () => {
  assert.deepEqual(model.parseCodexModels({ models: [
    { slug: 'gpt-6.1-sol', display_name: 'GPT-6.1-Sol', visibility: 'list', default_reasoning_level: 'medium',
      supported_reasoning_levels: [{ effort: 'low' }, { effort: 'medium' }, { effort: 'ultra' }, { effort: 'invalid' }, null] },
    { slug: 'internal', display_name: 'Hidden', visibility: 'hide' },
    { slug: 'bad\nmodel', display_name: 'Invalid', visibility: 'list' }
  ] }), [
    { id: 'gpt-6.1-sol', label: 'GPT-6.1-Sol (Low)', effort: 'low', default: false },
    { id: 'gpt-6.1-sol', label: 'GPT-6.1-Sol (Medium)', effort: 'medium', default: true },
    { id: 'gpt-6.1-sol', label: 'GPT-6.1-Sol (Ultra)', effort: 'ultra', default: false }
  ]);
  assert.deepEqual(model.parseCodexModels({}), []);
});
