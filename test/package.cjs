const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const asar = require('@electron/asar');
const { version } = require('../package.json');
const platform = process.argv[2] || process.platform;
const arch = process.argv[3] || process.arch;
assert.ok(['win32', 'darwin'].includes(platform));
assert.ok(['x64', 'arm64'].includes(arch));
const dist = path.join(__dirname, '../dist');
const product = 'TerManager-Platform';
const bundle = path.join(dist, arch === 'arm64' ? 'mac-arm64' : 'mac', `${product}.app/Contents`);
const resources = platform === 'win32' ? path.join(dist, 'win-unpacked/resources') : path.join(bundle, 'Resources');
const archive = path.join(resources, 'app.asar');

function windowsPE(file) {
  const data = fs.readFileSync(file);
  assert.equal(data.toString('ascii', 0, 2), 'MZ', file);
  const header = data.readUInt32LE(0x3c);
  assert.equal(data.toString('ascii', header, header + 4), 'PE\0\0', file);
  return data.readUInt16LE(header + 4);
}

function macBinary(file) {
  const data = fs.readFileSync(file);
  assert.equal(data.readUInt32LE(0), 0xfeedfacf, file);
  assert.equal(data.readUInt32LE(4), arch === 'arm64' ? 0x0100000c : 0x01000007, file);
}

if (platform === 'win32') {
  assert.equal(arch, 'x64');
  assert.equal(windowsPE(path.join(dist, `win-unpacked/${product}.exe`)), 0x8664);
  assert.ok([0x14c, 0x8664].includes(windowsPE(path.join(dist, `${product}-${version}-win-${arch}.exe`))));
} else {
  macBinary(path.join(bundle, 'MacOS', product));
  assert.ok(fs.statSync(path.join(dist, `${product}-${version}-mac-${arch}.dmg`)).size > 1048576);
}
assert.ok(fs.statSync(path.join(dist, `${product}-${version}-${platform === 'win32' ? 'win' : 'mac'}-${arch}.zip`)).size > 1048576);
for (const file of ['main.cjs', 'preload.cjs', 'model.cjs', 'renderer.js', 'index.html', 'styles.css',
  'fonts/FiraCode-VF.woff2', 'fonts/OFL.txt',
  'node_modules/@xterm/xterm/lib/xterm.js', 'node_modules/@xterm/xterm/css/xterm.css',
  'node_modules/@xterm/addon-fit/lib/addon-fit.js', 'node_modules/node-pty/lib/index.js']) {
  assert.ok(asar.statFile(archive, path.normalize(file)).size > 0, file);
}
for (const file of ['main.cjs', 'model.cjs', 'renderer.js', 'index.html', 'styles.css', 'fonts/FiraCode-VF.woff2']) {
  assert.deepEqual(asar.extractFile(archive, file), fs.readFileSync(path.join(__dirname, '..', file)), `Stale packaged file: ${file}`);
}
const prebuilds = path.join(resources, 'app.asar.unpacked/node_modules/node-pty/prebuilds', `${platform}-${arch}`);
if (platform === 'win32') {
  for (const file of ['conpty.node', 'conpty_console_list.node', 'pty.node', 'winpty.dll',
    'winpty-agent.exe', 'conpty/conpty.dll', 'conpty/OpenConsole.exe']) {
    assert.equal(windowsPE(path.join(prebuilds, file)), 0x8664, file);
  }
} else {
  macBinary(path.join(prebuilds, 'pty.node'));
  macBinary(path.join(prebuilds, 'spawn-helper'));
  assert.ok(fs.statSync(path.join(prebuilds, 'spawn-helper')).mode & 0o111);
}
const shipped = JSON.parse(asar.extractFile(archive, 'package.json'));
assert.equal(shipped.version, version);
assert.equal(shipped.main, 'main.cjs');
assert.equal(shipped.name, 'termanager-platform');
console.log(`PASS: ${platform} ${arch} executable, installer, ZIP, current source, renderer assets and unpacked PTY binaries`);
