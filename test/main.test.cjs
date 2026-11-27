const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
