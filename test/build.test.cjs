const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Windows build script runs from its own directory and stops on build failure', { skip: process.platform === 'win32' }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'windows build-'));
  try {
    fs.copyFileSync(path.join(__dirname, '../build-win.sh'), path.join(directory, 'build-win.sh'));
    fs.writeFileSync(path.join(directory, 'npm'), '#!/usr/bin/env bash\nprintf "%s|%s\\n" "$PWD" "$*" >> "$BUILD_TEST_LOG"\nif [ "$*" = "run dist:win" ]; then exit "${BUILD_TEST_EXIT:-0}"; fi\n', { mode: 0o755 });
    const log = path.join(directory, 'commands.log');
    const env = { ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}`, BUILD_TEST_LOG: log };
    const run = (args = [], extraEnv = {}) => spawnSync('bash', [path.join(directory, 'build-win.sh'), ...args], {
      cwd: os.tmpdir(), env: { ...env, ...extraEnv }, encoding: 'utf8'
    });
    assert.equal(run(['--help']).status, 0);
    assert.equal(run(['--unknown']).status, 1);
    assert.equal(fs.existsSync(log), false);
    const built = run(['--test']);
    assert.equal(built.status, 0, built.stderr);
    const commands = fs.readFileSync(log, 'utf8').trim().split('\n');
    assert.deepEqual(commands.map(line => line.slice(line.indexOf('|') + 1)), [
      'test', 'run test:smoke', 'run test:unicode', 'run dist:win', 'run test:package -- win32 x64'
    ]);
    assert.ok(commands.every(line => fs.realpathSync(line.split('|')[0]) === fs.realpathSync(directory)));
    fs.writeFileSync(log, '');
    assert.equal(run([], { BUILD_TEST_EXIT: '7' }).status, 7);
    assert.equal(fs.readFileSync(log, 'utf8').trim().split('\n').length, 1);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
