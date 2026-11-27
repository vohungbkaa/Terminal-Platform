const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const model = require('../model.cjs');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'termanager-unicode-'));
// Finder may supply no UTF-8 locale; isolate shell profiles so they cannot mask this regression.
if (process.platform === 'darwin') {
  Object.assign(process.env, { LANG: 'C', LC_ALL: 'C', LC_CTYPE: 'C', ZDOTDIR: temporary });
}
model.save(path.join(temporary, 'workspace.json'), model.defaults());
const timeout = setTimeout(() => { console.error('Unicode test timed out'); app.exit(1); }, 60000);
app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    const run = script => window.webContents.executeJavaScript(script);
    const waitFor = async script => {
      const deadline = Date.now() + 15000;
      while (!await run(script)) {
        if (Date.now() > deadline) throw new Error(`Timeout: ${script}`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    };
    const line = text => `Array.from({length: [...terminals.values()][0].term.buffer.active.length}, (_, i) => [...terminals.values()][0].term.buffer.active.getLine(i).translateToString().trim()).includes(${JSON.stringify(text)})`;
    const insert = text => window.webContents.debugger.sendCommand('Input.insertText', { text });
    const key = keyCode => {
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode });
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode });
    };
    let exitCode = 0;
    try {
      await waitFor("typeof state !== 'undefined' && state && document.getElementById('status').textContent.includes('0/9')");
      await run("document.getElementById('new-terminal').click()");
      await waitFor('terminals.size === 1 && [...terminals.values()][0].running');
      window.webContents.debugger.attach('1.3');
      await run('globalThis.inputData = []; [...terminals.values()][0].term.onData(data => inputData.push(data)); [...terminals.values()][0].term.focus()');
      const text = 'Tiếng Việt có dấu: Đặng ă â ê ô ơ ư';
      await insert(`echo "${text}"`);
      key('Return');
      await waitFor(line(text));
      console.log('PASS: Vietnamese text through Chromium input, IPC, PTY and xterm output');
      const decomposed = 'Tiếng Việt dạng dấu tổ hợp'.normalize('NFD');
      await insert(`echo "${decomposed}"`);
      key('Return');
      await waitFor(line(decomposed));
      console.log('PASS: decomposed Vietnamese characters retain their combining accents');

      await run('inputData.length = 0');
      await insert('echo "');
      for (const text of ['T', 'Ti', 'Tiê', 'Tiế', 'Tiến', 'Tiếng']) {
        await window.webContents.debugger.sendCommand('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
      }
      await insert('Tiếng');
      await insert(' Việt IME"');
      key('Return');
      await waitFor(line('Tiếng Việt IME'));
      assert.equal(await run("inputData.join('')"), 'echo "Tiếng Việt IME"\r');
      console.log('PASS: composing Vietnamese accents commits each character once');

      if (process.platform === 'darwin') {
        await insert('PROMPT="UTF8> "; RPROMPT=""; clear');
        key('Return');
        const currentLine = '(() => { const buffer = [...terminals.values()][0].term.buffer.active; return buffer.getLine(buffer.baseY + buffer.cursorY).translateToString(true).trimEnd(); })()';
        await waitFor(`${currentLine} === 'UTF8>'`);
        const cursor = await run('[...terminals.values()][0].term.buffer.active.cursorX');
        for (const sample of ['tiếng Việt có dấu h ê i', 'tiếng Việt có dấu h ê i'.normalize('NFD')]) {
          await insert(sample);
          await waitFor(`${currentLine} !== 'UTF8>'`);
          for (let i = 0; i < Buffer.byteLength(sample, 'utf8') + 5; i++) {
            await window.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
              type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, autoRepeat: i > 0
            });
          }
          await window.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
            type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8
          });
          await waitFor(`${currentLine} === 'UTF8>'`);
          assert.equal(await run('[...terminals.values()][0].term.buffer.active.cursorX'), cursor);
        }
        console.log('PASS: held Backspace clears precomposed and combining Vietnamese text without residual cells or cursor drift');
        const screenshot = path.join(temporary, 'held-backspace.png');
        fs.writeFileSync(screenshot, (await window.webContents.capturePage()).toPNG());
        console.log('Backspace screenshot:', screenshot);
      }

      await insert('echo "Việ');
      key('Backspace');
      await insert('t"');
      key('Return');
      await waitFor(line('Vit'));
      console.log('PASS: deleting an accented character removes the entire UTF-8 character under a legacy C locale');
      if (process.platform === 'darwin') {
        delete process.env.LANG;
        delete process.env.LC_ALL;
        delete process.env.LC_CTYPE;
        await run("act(() => update(s => { s.settings.shell = '/bin/bash'; }))()");
        await run('(async () => { const view = [...terminals.values()][0]; await api.kill(view.id); view.running = false; view.term.reset(); await start(view); view.term.focus(); })()');
        await insert('echo "Việ');
        key('Backspace');
        await insert('t"');
        key('Return');
        await waitFor(line('Vit'));
        console.log('PASS: Bash handles accented editing when no locale is inherited');
      }
    } catch (error) {
      console.error(error);
      console.error(await run('(() => { const buffer = [...terminals.values()][0].term.buffer.active; return {cursorX: buffer.cursorX, cursorY: buffer.cursorY, baseY: buffer.baseY, lines: Array.from({length: buffer.length}, (_, i) => buffer.getLine(i).translateToString(true)).filter(Boolean)}; })()'));
      exitCode = 1;
    }
    finally {
      clearTimeout(timeout);
      try { await run('act(() => update(s => { s.panes = {home: []}; }))()'); } catch {}
      for (const window of BrowserWindow.getAllWindows()) window.destroy();
      app.exit(exitCode);
    }
  });
});
require(path.join(process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..'), 'main.cjs'));
app.setPath('userData', temporary);
