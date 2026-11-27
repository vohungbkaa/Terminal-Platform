const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const model = require('../model.cjs');

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
    state.panes['task-1'] = [{ id: 'pane-1', name: 'Terminal', hidden: true }];
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
