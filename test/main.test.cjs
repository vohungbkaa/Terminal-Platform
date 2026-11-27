const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const os = require('node:os');

test('workspace file opening uses the default application and validates paths again', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-open-'));
  const root = path.join(temporary, 'project');
  fs.mkdirSync(root);
  const model = require('../model.cjs');
  const state = model.defaults();
  state.projects.push({ id: 'project', name: 'Project', path: root, tasks: [] });
  const opened = [];
  let failure = '';
  let browserFailure = null;
  const browserLaunches = [];
  let openFile;
  const source = fs.readFileSync(path.join(__dirname, '..', 'main.cjs'), 'utf8');
  vm.runInNewContext(source.slice(source.indexOf("    handle('project:open-file'"), source.indexOf("    handle('terminal:start'")), {
    handle: (_channel, callback) => { openFile = callback; }, fs, model, state, process,
    app: { getApplicationInfoForProtocol: async protocol => {
      assert.equal(protocol, 'https://example.com');
      return { path: '/Default Browser.app' };
    } },
    execFile: (command, args, options, callback) => {
      browserLaunches.push({ command, args });
      queueMicrotask(() => callback(browserFailure));
      return { once() {} };
    },
    shell: { openPath: async file => { opened.push(file); return failure; } }
  });
  try {
    for (const name of ["it's here.docx", 'sheet.xls', 'sheet.xlsx']) {
      const file = path.join(root, name);
      fs.writeFileSync(file, 'fixture');
      await openFile('project', name);
      assert.equal(opened.at(-1), fs.realpathSync(file));
    }
    for (const name of ['Trang tiếng Việt.html', "it's here.HTM"]) {
      const file = path.join(root, name);
      fs.writeFileSync(file, 'fixture');
      await openFile('project', name);
      assert.equal(browserLaunches.at(-1).command, process.platform === 'darwin' ? '/usr/bin/open' : '/Default Browser.app');
      assert.deepEqual(Array.from(browserLaunches.at(-1).args), process.platform === 'darwin'
        ? ['-a', '/Default Browser.app', fs.realpathSync(file)] : [fs.realpathSync(file)]);
      assert.equal(opened.length, 3);
    }
    browserFailure = new Error('Browser launch failed');
    await assert.rejects(openFile('project', 'Trang tiếng Việt.html'), /Browser launch failed/);
    fs.writeFileSync(path.join(temporary, 'outside.txt'), 'outside');
    for (const relative of ['../outside.txt', root, '', 'missing', 42, 'bad\0name']) {
      await assert.rejects(openFile('project', relative));
    }
    await assert.rejects(openFile('unknown', 'sheet.xlsx'));
    if (process.platform !== 'win32') {
      const link = path.join(root, 'link');
      fs.symlinkSync(path.join(temporary, 'outside.txt'), link);
      await assert.rejects(openFile('project', 'link'));
      fs.unlinkSync(link);
      fs.symlinkSync(path.join(root, 'sheet.xlsx'), link);
      await openFile('project', 'link');
      assert.equal(opened.at(-1), fs.realpathSync(path.join(root, 'sheet.xlsx')));
    }
    failure = 'No application is associated with this file';
    await assert.rejects(openFile('project', 'sheet.xlsx'), /Không mở được file/);
    failure = '';
    const before = opened.length;
    fs.unlinkSync(path.join(root, 'sheet.xlsx'));
    await assert.rejects(openFile('project', 'sheet.xlsx'));
    assert.equal(opened.length, before);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test('dropped workspace paths accept directories, skip files and reject invalid input', async () => {
  let folders;
  const source = fs.readFileSync(path.join(__dirname, '..', 'main.cjs'), 'utf8');
  vm.runInNewContext(source.slice(source.indexOf("    handle('project:folders'"), source.indexOf("    handle('project:create-folder'")), {
    handle: (_channel, callback) => { folders = callback; }, fs, path, model: require('../model.cjs')
  });
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-drop-'));
  try {
    const directory = path.join(temporary, "Dự án it's here");
    const file = path.join(temporary, 'file.txt');
    fs.mkdirSync(directory);
    fs.writeFileSync(file, 'fixture');
    assert.deepEqual(JSON.parse(JSON.stringify(await folders([directory, file]))), [{ path: directory, name: "Dự án it's here" }]);
    await assert.rejects(folders([file]), /thả thư mục/);
    for (const invalid of [null, [], Array(201).fill(directory), [42], ['relative'], [directory + '\0'], [path.join(temporary, 'missing')]]) {
      await assert.rejects(folders(invalid));
    }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test('PTY resize validates dimensions and skips unchanged sizes', () => {
  let resize;
  let calls = 0;
  const session = { cols: 100, rows: 30, resize(cols, rows) { calls++; this.cols = cols; this.rows = rows; } };
  const source = fs.readFileSync(path.join(__dirname, '..', 'main.cjs'), 'utf8');
  vm.runInNewContext(source.slice(source.indexOf("    handle('terminal:resize'"), source.indexOf("    handle('terminal:kill'")), {
    sessions: new Map([['pane', session]]), handle: (_channel, callback) => { resize = callback; }
  });
  resize('pane', 100, 30);
  assert.equal(calls, 0);
  resize('pane', 120, 40);
  resize('pane', 120, 40);
  assert.equal(calls, 1);
  assert.throws(() => resize('pane', 0, 40));
  assert.throws(() => resize('pane', 120, 1.5));
  assert.equal(calls, 1);
});

test('window opacity converts validated percentages to native values', () => {
  let changeOpacity;
  const values = [];
  const source = fs.readFileSync(path.join(__dirname, '..', 'main.cjs'), 'utf8');
  vm.runInNewContext(source.slice(source.indexOf("    handle('window:opacity'"), source.indexOf("    handle('clipboard:copy'")), {
    handle: (_channel, callback) => { changeOpacity = callback; },
    model: require('../model.cjs'), window: { setOpacity: value => values.push(value) }
  });
  changeOpacity(75);
  changeOpacity(100);
  assert.deepEqual(values, [0.75, 1]);
  assert.throws(() => changeOpacity(0));
  assert.throws(() => changeOpacity('75'));
  assert.equal(values.length, 2);
});
