// Run using Electron so this checks the actual renderer, preload bridge, PTY and packaged terminal libraries.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'termanager smoke dự án-'));
const model = require('../model.cjs');
const initial = model.defaults();
initial.projects.push({ id: 'project', name: 'Dự án test', path: temporary, tasks: [{ id: 'task', name: 'Task 1' }] });
initial.panes.project = [{ id: 'restored', name: 'Restored terminal', hidden: false }];
initial.panes.task = [];
model.save(path.join(temporary, 'workspace.json'), initial);
const timeout = setTimeout(() => { console.error('Smoke test timed out'); app.exit(1); }, 60000);
app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    const run = script => window.webContents.executeJavaScript(script);
    const waitFor = async script => {
      const deadline = Date.now() + 15000;
      while (!await run(script)) {
        if (Date.now() > deadline) throw new Error(`Timeout: ${script}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    };
    try {
      await waitFor("typeof state !== 'undefined' && state && document.getElementById('status').textContent.includes('0/9')");
      assert.equal(await run('typeof require'), 'undefined');
      assert.equal(await run('state.settings.shell'), process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh');
      assert.deepEqual(await run("Array.from(document.getElementById('shell').options, option => option.value)"), Object.keys(model.shells));
      assert.deepEqual(await run('Array.from({length: 10}, (_, i) => grid(i))'), [[1,1],[1,1],[1,2],[2,2],[2,2],[2,3],[2,3],[3,3],[3,3],[3,3]]);
      await run("document.getElementById('new-terminal').click()");
      await waitFor("terminals.size === 1 && [...terminals.values()][0].running");
      await run("window.desktop.input([...terminals.keys()][0], 'echo TERMANAGER_SMOKE_OK\\r')");
      await waitFor("[...terminals.values()][0].term.buffer.active.getLine(0) && Array.from({length: [...terminals.values()][0].term.buffer.active.length}, (_, i) => [...terminals.values()][0].term.buffer.active.getLine(i).translateToString()).filter(line => line.trim() === 'TERMANAGER_SMOKE_OK').length > 0");
      await run("globalThis.controlInput = []; globalThis.controlListener = [...terminals.values()][0].term.onData(data => controlInput.push(data)); [...terminals.values()][0].term.focus()");
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'C', modifiers: ['control'] });
      await waitFor("controlInput.includes('\\u0003')");
      await run('controlListener.dispose()');
      const first = await run('[...terminals.keys()][0]');
      await run("act(() => update(s => { s.panes.home[0].hidden = true; }))()");
      assert.equal(await run("document.querySelectorAll('#hidden-panes button').length"), 1);
      assert.equal(await run('[...terminals.values()][0].running'), true);
      await run("document.querySelector('#hidden-panes button').click()");
      await waitFor("!state.panes.home[0].hidden");
      await run("act(() => update(s => { s.selected = 'project'; }))()");
      await waitFor("terminals.get('restored')?.running");
      await run("act(() => update(s => { s.selected = 'task'; }))()");
      await run("document.getElementById('new-terminal').click()");
      await waitFor("state.panes.task.length === 1 && terminals.get(state.panes.task[0].id)?.running");
      await run("act(() => update(s => { s.selected = 'home'; }))()");
      assert.equal(await run('[...terminals.keys()][0]'), first);
      await run("document.getElementById('settings-button').click()");
      await run("document.getElementById('theme').value = 'nordFrost'; document.getElementById('font-size').value = '16'; document.getElementById('settings-form').requestSubmit()");
      await waitFor("state.settings.theme === 'nordFrost'");
      const persisted = model.load(path.join(temporary, 'workspace.json'));
      assert.equal(persisted.settings.fontSize, 16);
      assert.equal(persisted.panes.home[0].id, first);
      {
        const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
        await run(`act(() => update(s => { s.settings.shell = ${JSON.stringify(shell)}; }))()`);
        window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'T', modifiers: [process.platform === 'darwin' ? 'meta' : 'control'] });
        await waitFor("state.panes.home.length === 2 && terminals.get(state.panes.home[1].id)?.running");
        const command = process.platform === 'win32' ? 'echo TERMANAGER_CMD_OK\r' : 'if [ -n "$BASH_VERSION" ]; then echo TERMANAGER_CMD_OK; fi\r';
        await run(`window.desktop.input(state.panes.home[1].id, ${JSON.stringify(command)})`);
        await waitFor("Array.from({length: terminals.get(state.panes.home[1].id).term.buffer.active.length}, (_, i) => terminals.get(state.panes.home[1].id).term.buffer.active.getLine(i).translateToString()).some(line => line.trim() === 'TERMANAGER_CMD_OK')");
        if (process.platform === 'darwin') {
          await run(`window.desktop.input(state.panes.home[1].id, ${JSON.stringify('trap "" HUP; echo IGNORE_HUP_OK\r')})`);
          await waitFor("Array.from({length: terminals.get(state.panes.home[1].id).term.buffer.active.length}, (_, i) => terminals.get(state.panes.home[1].id).term.buffer.active.getLine(i).translateToString()).some(line => line.trim() === 'IGNORE_HUP_OK')");
          await run('window.desktop.kill(state.panes.home[1].id)');
          await run('window.desktop.start(state.panes.home[1].id)');
          await run("window.desktop.input(state.panes.home[1].id, 'echo RESTART_OK\\r')");
          await waitFor("Array.from({length: terminals.get(state.panes.home[1].id).term.buffer.active.length}, (_, i) => terminals.get(state.panes.home[1].id).term.buffer.active.getLine(i).translateToString()).some(line => line.trim() === 'RESTART_OK')");
        }
        await run("window.desktop.input(state.panes.home[1].id, 'exit\\r')");
        await waitFor("!terminals.get(state.panes.home[1].id).running");
      }
      await run("act(() => update(s => { s.panes = {home: []}; s.projects = []; s.selected = 'home'; }))()");
      await waitFor('terminals.size === 0');
      assert.equal(await run("document.getElementById('error').hidden"), true);
      console.log('PASS: real PTY, shell switching/restart, Ctrl+C, platform shortcuts, renderer isolation, workspace restore and persistence');
      clearTimeout(timeout); window.destroy();
      // shortcut: leave the temporary profile because Windows locks it until exit; add parent cleanup for frequent runs.
      app.exit(0);
    } catch (error) {
      console.error(error);
      clearTimeout(timeout); for (const w of BrowserWindow.getAllWindows()) w.destroy(); app.exit(1);
    }
  });
});
require(path.join(process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..'), 'main.cjs'));
app.setPath('userData', temporary);
