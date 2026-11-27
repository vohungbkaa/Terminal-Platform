const fs = require('node:fs');
const path = require('node:path');

// node-pty's npm prebuilds ship the macOS spawn helper without executable permissions.
if (process.platform === 'darwin') {
  for (const arch of ['arm64', 'x64']) {
    fs.chmodSync(path.join(__dirname, `../node_modules/node-pty/prebuilds/darwin-${arch}/spawn-helper`), 0o755);
  }
}
