// Run using Electron so this checks the actual renderer, preload bridge, PTY and packaged terminal libraries.
const { app, BrowserWindow, dialog, shell } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'termanager smoke dự án-'));
const model = require('../model.cjs');
fs.mkdirSync(path.join(temporary, 'src', 'nested'), { recursive: true });
fs.writeFileSync(path.join(temporary, 'src', 'hello.txt'), 'hello');
fs.writeFileSync(path.join(temporary, 'src', 'nested', 'deep.txt'), 'deep');
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
      assert.equal(await run("CSS.supports('transition-behavior', 'allow-discrete')"), true);
      assert.equal(await run('state.settings.shell'), process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh');
      assert.deepEqual(await run("Array.from(document.getElementById('shell').options, option => option.value)"), Object.keys(model.shells));
      assert.deepEqual(await run('Array.from({length: 10}, (_, i) => grid(i))'), [[1,1],[1,1],[1,2],[2,2],[2,2],[2,3],[2,3],[3,3],[3,3],[3,3]]);
      assert.equal(await run('directoryCache.size'), 0);
      assert.equal(await run("document.querySelector('.project-row[data-project-id=project] .disclosure-rail').getAttribute('aria-expanded')"), 'false');
      await run("document.querySelector('.project-row[data-project-id=project] .disclosure-rail').click()");
      await waitFor("[...document.querySelectorAll('.file-name')].some(node => node.textContent === 'src')");
      assert.equal(await run('directoryCache.size'), 1);
      assert.equal(await run("document.querySelectorAll('.task-row').length"), 1);
      assert.equal(await run("[...document.querySelectorAll('.file-name')].some(node => node.textContent === 'hello.txt')"), false);
      await run("[...document.querySelectorAll('.file-row')].find(row => row.querySelector('.file-name').textContent === 'src').click()");
      await waitFor("[...document.querySelectorAll('.file-name')].some(node => node.textContent === 'hello.txt')");
      assert.equal(await run('directoryCache.size'), 2);
      const originalOpenPath = shell.openPath;
      const openedFiles = [];
      shell.openPath = async file => { openedFiles.push(file); return ''; };
      try {
        await run("[...document.querySelectorAll('.file-row')].find(row => row.querySelector('.file-name').textContent === 'hello.txt').click()");
        await run('actionQueue');
        assert.equal(openedFiles.length, 0);
        await run("[...document.querySelectorAll('.file-row')].find(row => row.querySelector('.file-name').textContent === 'hello.txt').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))");
        await run('actionQueue');
        assert.deepEqual(openedFiles, [fs.realpathSync(path.join(temporary, 'src', 'hello.txt'))]);
        await run("[...document.querySelectorAll('.file-row')].find(row => row.querySelector('.file-name').textContent === 'hello.txt').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))");
        await run('actionQueue');
        assert.equal(openedFiles.length, 2);
      } finally { shell.openPath = originalOpenPath; }
      assert.equal(await run("[...document.querySelectorAll('.file-name')].some(node => node.textContent === 'deep.txt')"), false);
      await run("[...document.querySelectorAll('.file-row')].find(row => row.querySelector('.file-name').textContent === 'nested').click()");
      await waitFor("[...document.querySelectorAll('.file-name')].some(node => node.textContent === 'deep.txt')");
      await run("[...document.querySelectorAll('.file-row')].find(row => row.querySelector('.file-name').textContent === 'nested').click()");
      assert.equal(await run("[...document.querySelectorAll('.file-name')].some(node => node.textContent === 'deep.txt')"), false);
      assert.equal(await run("document.activeElement.querySelector('.file-name').textContent"), 'nested');
      await run("document.querySelector('.project-row[data-project-id=project] .disclosure-rail').click()");
      await run('actionQueue');
      assert.equal(await run("document.querySelectorAll('.directory-tree').length"), 0);
      await run("(() => { const handle = document.getElementById('sidebar-resizer'); const width = document.getElementById('sidebar').getBoundingClientRect().width; handle.dispatchEvent(new MouseEvent('mousedown', { clientX: width, bubbles: true })); window.dispatchEvent(new MouseEvent('mousemove', { clientX: 800 })); window.dispatchEvent(new MouseEvent('mouseup')); })()");
      assert.equal(await run("document.getElementById('sidebar').getBoundingClientRect().width"), 800);
      await run("document.documentElement.style.setProperty('--sidebar-width', '99999px')");
      assert.equal(await run("document.getElementById('sidebar-resizer').getBoundingClientRect().right <= window.innerWidth"), true);
      await run("document.documentElement.style.setProperty('--sidebar-width', '232px')");
      await run("document.getElementById('new-terminal').click()");
      await waitFor("terminals.size === 1 && [...terminals.values()][0].running");
      assert.equal(await run("document.fonts.check('500 13px \"Fira Code\"', 'Xin chào Dự án')"), true);
      assert.equal(await run("[...document.fonts].some(face => face.family.includes('Fira Code') && face.status === 'loaded')"), true);
      assert.equal(await run("[...terminals.values()][0].term.options.fontFamily.startsWith(\"'Fira Code'\")"), true);
      assert.equal(await run("[...terminals.values()][0].term.options.fontWeight"), '500');
      assert.equal(await run("document.querySelector('.pane-model-btn').hidden"), true);
      assert.equal(await run("document.getElementById('commands-panel').classList.contains('open')"), true);
      await run('scheduleHideAgentDrawer(); new Promise(resolve => setTimeout(resolve, 300))');
      assert.equal(await run("document.getElementById('commands-panel').classList.contains('open')"), true);
      const droppedFiles = [path.join(temporary, 'Dự án có dấu.txt'), path.join(temporary, "it's $(no).png")];
      for (const file of droppedFiles) fs.writeFileSync(file, 'drop fixture');
      window.webContents.debugger.attach('1.3');
      try {
        await run("globalThis.dropInput = []; globalThis.dropListener = [...terminals.values()][0].term.onData(data => dropInput.push(data)); const picker = document.createElement('input'); picker.type = 'file'; picker.multiple = true; picker.hidden = true; picker.id = 'native-drop-fixture'; document.body.append(picker); void 0");
        const { root } = await window.webContents.debugger.sendCommand('DOM.getDocument');
        const { nodeId } = await window.webContents.debugger.sendCommand('DOM.querySelector', { nodeId: root.nodeId, selector: '#native-drop-fixture' });
        await window.webContents.debugger.sendCommand('DOM.setFileInputFiles', { nodeId, files: droppedFiles });
        const actualPaths = await run("globalThis.nativeDropFiles = [...document.getElementById('native-drop-fixture').files]; window.desktop.filePaths(nativeDropFiles)");
        assert.deepEqual(actualPaths.map(file => fs.realpathSync(file)), droppedFiles.map(file => fs.realpathSync(file)));
        assert.equal(await run("(() => { const transfer = new DataTransfer(); for (const file of document.getElementById('native-drop-fixture').files) transfer.items.add(file); const pane = document.querySelector('.pane'); const over = new DragEvent('dragover', { dataTransfer: transfer, bubbles: true, cancelable: true }); pane.dispatchEvent(over); pane.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true })); return over.defaultPrevented; })()"), true);
        assert.equal(await run("dropInput.join('').includes(quoteDroppedPaths(window.desktop.filePaths([...document.getElementById('native-drop-fixture').files]), [...terminals.values()][0].shell))"), true);
        assert.equal(await run("dropInput.join('').includes(String.fromCharCode(13))"), false);
        await run("dropListener.dispose(); document.getElementById('native-drop-fixture').remove(); window.desktop.input([...terminals.keys()][0], String.fromCharCode(3))");
      } finally { window.webContents.debugger.detach(); }
      if (process.platform !== 'win32') {
        const fakeClaude = path.join(temporary, 'claude');
        fs.writeFileSync(fakeClaude, `process.stdout.write('Claude Code v9.0.0\\nSonnet 5 · API Usage Billing\\n');
process.stdin.on('data', data => {
  if (data.includes('/model')) process.stdout.write('Select model\\n');
  if (data.includes('choose-opus')) process.stdout.write('⎿ Set model to Opus 5\\n');
});
setInterval(() => {}, 1000);\n`);
        await run(`(() => {
          const transfer = new DataTransfer();
          transfer.setData('application/x-termanager-command', ${JSON.stringify(`node "${fakeClaude}"`)});
          transfer.setData('application/x-termanager-title', 'claude • Default');
          document.querySelector('.pane').dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
        })()`);
        await waitFor("document.querySelector('.pane-model-label').textContent === 'Sonnet 5'");
        await run("globalThis.sidebarInput = []; globalThis.sidebarListener = [...terminals.values()][0].term.onData(data => sidebarInput.push(data)); globalThis.dropSidebarRow = row => { sidebarInput.length = 0; const transfer = new DataTransfer(); row.dispatchEvent(new DragEvent('dragstart', { dataTransfer: transfer, bubbles: true })); document.querySelector('.pane').dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true })); return { path: transfer.getData('application/x-termanager-path'), input: sidebarInput.join('') }; }; void 0");
        const rootDrop = await run("dropSidebarRow(document.querySelector('.project-row[data-project-id=project]'))");
        assert.equal(rootDrop.path, temporary);
        assert.ok(rootDrop.input.includes(temporary));
        assert.equal(rootDrop.input.includes('\r'), false);
        await run("document.querySelector('.project-row[data-project-id=project] .disclosure-rail').click()");
        await run('actionQueue');
        await waitFor("[...document.querySelectorAll('.file-name')].some(node => node.textContent === 'src')");
        for (const name of ['src', 'hello.txt']) {
          const drop = await run(`dropSidebarRow([...document.querySelectorAll('.file-row')].find(row => row.querySelector('.file-name').textContent === ${JSON.stringify(name)}))`);
          assert.ok(drop.input.includes(name));
          assert.equal(drop.input.includes('\r'), false);
        }
        await run("sidebarListener.dispose(); window.desktop.input([...terminals.keys()][0], String.fromCharCode(21)); document.querySelector('.project-row[data-project-id=project] .disclosure-rail').click()");
        await run('actionQueue');
        await waitFor("!document.getElementById('commands-panel').classList.contains('open')");
        assert.equal(await run('agentDrawerAutoPane'), null);
        await run("document.querySelector('.pane-model-btn').click()");
        await run('actionQueue');
        assert.equal(await run("Boolean(document.querySelector('.model-popover'))"), false);
        await run("window.desktop.input([...terminals.keys()][0], 'choose-opus\\r')");
        await waitFor("document.querySelector('.pane-model-label').textContent === 'Opus 5'");
        assert.equal(await run("state.panes.home[0].model"), undefined);
        await run("window.desktop.input([...terminals.keys()][0], '\\u0003')");
        await waitFor("document.querySelector('.pane-model-btn').hidden");
      }
      if (process.platform !== 'win32') {
        const fakeAgy = path.join(temporary, 'agy');
        fs.writeFileSync(fakeAgy, '#!/bin/sh\nif [ "$1" = models ]; then\n  printf "neon-medium\\tGemini 4 Neon (Medium)\\nneon-high\\tGemini 4 Neon (High)\\ngemini-pro-orchestrator-neon\\tOrchestrator (Neon)\\ngemini-pro-orchestrator\\tOrchestrator (Carbon)\\ngemini-pro-orchestrator-argon\\tOrchestrator (Argon)\\n"\nelse\n  printf "? for shortcuts    Gemini 4 Neon · medium\\n"\n  while IFS= read -r line; do [ "$line" = "/model neon-high" ] || continue; printf "? for shortcuts    Gemini 4 Neon · high\\n"; done\nfi\n', { mode: 0o700 });
        process.env.PATH = temporary + path.delimiter + process.env.PATH;
        await run(`window.desktop.input([...terminals.keys()][0], ${JSON.stringify(`"${fakeAgy}"\r`)})`);
        await waitFor("document.querySelector('.pane-model-label').textContent === 'Gemini 4 Neon (Medium)'");
        await run("globalThis.modelCommands = []; globalThis.originalApplyPaneModel = applyPaneModel; applyPaneModel = (...args) => { modelCommands.push(args); return originalApplyPaneModel(...args); }; void 0");
        await run("document.querySelector('.pane-model-btn').click()");
        assert.equal(await run("Boolean(document.querySelector('.model-option[data-model-id=neon-medium]'))"), true);
        assert.equal(await run("getComputedStyle(document.querySelector('.model-popover')).animationName"), 'popover-enter');
        await waitFor("Boolean(document.querySelector('.model-option[data-model-id=neon-medium]'))");
        assert.equal(await run("document.querySelectorAll('.model-option').length"), 1);
        assert.equal(await run("document.querySelector('.model-option').textContent"), 'Gemini 4 Neon');
        assert.equal(await run("document.querySelector('.model-effort').hidden"), false);
        assert.equal(await run("document.querySelector('.model-effort input').max"), '1');
        await run("document.querySelector('.model-option').click()");
        assert.equal(await run('modelCommands.length'), 0);
        await run("const slider = document.querySelector('.model-effort input'); slider.value = '1'; slider.dispatchEvent(new Event('input')); slider.dispatchEvent(new Event('change'));");
        assert.equal(await run('modelCommands.length'), 0);
        assert.equal(await run("document.querySelector('.pane-model-label').textContent"), 'Gemini 4 Neon (Medium)');
        await run("document.querySelector('.model-apply-btn').click(); document.querySelector('.model-apply-btn').click()");
        await waitFor("document.querySelector('.pane-model-label').textContent === 'Gemini 4 Neon (High)'");
        assert.equal(await run('modelCommands.length'), 1);
        await waitFor("!document.querySelector('.model-popover')");
        await run("document.querySelector('.pane-model-btn').click()");
        assert.equal(await run("Boolean(document.querySelector('.model-popover'))"), true);
        assert.equal(await run("document.querySelector('.model-effort-label strong').textContent"), 'High');
        assert.equal(await run("document.querySelectorAll('.model-option[data-model-id^=gemini-pro-orchestrator]').length"), 0);
        await run("closeModelPopover(); applyPaneModel = originalApplyPaneModel; void 0");
        await run("globalThis.savedCatalog = AGENT_MODELS.agy.models; globalThis.originalLoadAgyModels = loadAgentModels; AGENT_MODELS.agy.models = []; loadAgentModels = () => new Promise(resolve => setTimeout(() => { AGENT_MODELS.agy.models = savedCatalog; resolve(savedCatalog); }, 200)); document.querySelector('.pane-model-btn').click(); void 0");
        assert.equal(await run("document.querySelector('.model-popover [role=status]').textContent"), 'Đang tải model…');
        await run("document.querySelector('.pane-model-btn').click()");
        await run('new Promise(resolve => setTimeout(resolve, 300))');
        assert.equal(await run("Boolean(document.querySelector('.model-popover'))"), false);
        await run('loadAgentModels = originalLoadAgyModels; void 0');
        await run("window.desktop.input([...terminals.keys()][0], '\\u0003')");
        await waitFor("document.querySelector('.pane-model-btn').hidden");
      }
      if (process.platform !== 'win32') {
        const codexHome = path.join(temporary, 'codex-home');
        fs.mkdirSync(codexHome);
        fs.writeFileSync(path.join(codexHome, 'models_cache.json'), JSON.stringify({ models: [
          { slug: 'gpt-6.1-sol', display_name: 'GPT-6.1-Sol', visibility: 'list', default_reasoning_level: 'medium',
            supported_reasoning_levels: [{ effort: 'low' }, { effort: 'medium' }, { effort: 'high' }] },
          { slug: 'gpt-6.2-sol', display_name: 'GPT-6.2-Sol', visibility: 'list', default_reasoning_level: 'low',
            supported_reasoning_levels: [{ effort: 'low' }, { effort: 'xhigh' }, { effort: 'ultra' }] },
          { slug: 'internal', display_name: 'Hidden', visibility: 'hide' }
        ] }));
        process.env.CODEX_HOME = codexHome;
        const fakeCodex = path.join(temporary, 'codex');
        fs.writeFileSync(fakeCodex, `process.stdout.write('GPT-6.1-Sol medium · ~/project\\n? for shortcuts\\n');
process.stdin.on('data', data => {
  if (data.toString().trim() === '/model gpt-6.2-sol --reasoning=ultra') {
    process.stdout.write('GPT-6.2-Sol ultra · ~/project\\n? for shortcuts\\n');
  }
});
setInterval(() => {}, 1000);
`);
        await run(`window.desktop.input([...terminals.keys()][0], ${JSON.stringify(`node "${fakeCodex}" --model stale-launch-model\r`)})`);
        await waitFor("document.querySelector('.pane-model-label').textContent === 'GPT-6.1-Sol · medium'");
        await run("document.querySelector('.pane-model-btn').click()");
        await waitFor("Boolean(document.querySelector('.model-option[data-model-id=\"gpt-6.2-sol\"]'))");
        assert.equal(await run("document.querySelectorAll('.model-option').length"), 2);
        assert.equal(await run("document.querySelector('.model-effort-label strong').textContent"), 'Medium');
        await run("document.querySelector('.model-option[data-model-id=\"gpt-6.2-sol\"]').click(); const codexSlider = document.querySelector('.model-effort input'); codexSlider.value = '2'; codexSlider.dispatchEvent(new Event('input'));");
        assert.equal(await run("document.querySelector('.pane-model-label').textContent"), 'GPT-6.1-Sol · medium');
        await run("document.querySelector('.model-apply-btn').click()");
        await waitFor("document.querySelector('.pane-model-label').textContent === 'GPT-6.2-Sol · ultra'");
        await run("window.desktop.input([...terminals.keys()][0], '\\u0003')");
        await waitFor("document.querySelector('.pane-model-btn').hidden");

        const fakeGemini = path.join(temporary, 'gemini');
        fs.writeFileSync(fakeGemini, `process.stdout.write('~/project  no sandbox  gemini-4-pro  100% context left\\n');
process.stdin.on('data', data => {
  if (data.includes('/model')) process.stdout.write('Select model\\n');
  if (data.includes('choose-flash')) process.stdout.write('Model set to gemini-4-flash\\n~/project  no sandbox  gemini-4-flash  100% context left\\n');
});
setInterval(() => {}, 1000);
`);
        await run(`window.desktop.input([...terminals.keys()][0], ${JSON.stringify(`node "${fakeGemini}"
`)})`);
        await waitFor("document.querySelector('.pane-model-label').textContent === 'gemini-4-pro'");
        await run("document.querySelector('.pane-model-btn').click()");
        await run('actionQueue');
        assert.equal(await run("Boolean(document.querySelector('.model-popover'))"), false);
        await run("window.desktop.input([...terminals.keys()][0], 'choose-flash\\r')");
        await waitFor("document.querySelector('.pane-model-label').textContent === 'gemini-4-flash'");
        await run("window.desktop.input([...terminals.keys()][0], '\\u0003')");
        await waitFor("document.querySelector('.pane-model-btn').hidden");
      }
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
      await run('closeAgentDrawer()');
      await run("act(() => update(s => { s.selected = 'project'; }))()");
      await waitFor("terminals.get('restored')?.running");
      assert.equal(await run("document.getElementById('commands-panel').classList.contains('open')"), true);
      assert.equal(await run('agentDrawerAutoPane'), 'restored');
      await run("act(() => update(s => { s.selected = 'task'; }))()");
      await run("document.getElementById('new-terminal').click()");
      await waitFor("state.panes.task.length === 1 && terminals.get(state.panes.task[0].id)?.running");
      await run("act(() => update(s => { s.selected = 'home'; }))()");
      assert.equal(await run('[...terminals.keys()][0]'), first);
      const terminalSize = await run("({ width: [...terminals.values()][0].host.clientWidth, height: [...terminals.values()][0].host.clientHeight })");
      await run("for (let i = 0; i < 3; i++) { openSettings(); closeSettings(); } document.getElementById('settings-button').click()");
      assert.equal(await run("document.getElementById('settings-dialog').open"), true);
      assert.equal(await run("getComputedStyle(document.getElementById('settings-dialog')).transitionProperty.includes('opacity')"), true);
      assert.deepEqual(await run("({ width: [...terminals.values()][0].host.clientWidth, height: [...terminals.values()][0].host.clientHeight })"), terminalSize);
      assert.equal(await run("document.querySelectorAll('.theme-card').length"), 5);
      await run("[...document.querySelectorAll('.theme-card')].find(card => card.querySelector('strong').textContent === 'Hacker').click(); document.getElementById('app-opacity').value = '75'; document.getElementById('app-opacity').dispatchEvent(new Event('input'))");
      await run('window.desktop.load().then(() => undefined)');
      assert.equal(await run("[...terminals.values()].every(view => view.term.options.theme.foreground === themes.hacker.terminalFg)"), true);
      assert.equal(await run("document.getElementById('opacity-value').textContent"), '75%');
      if (process.platform !== 'linux') assert.ok(Math.abs(window.getOpacity() - 0.75) < 0.01);
      await run('closeSettings()');
      await run('window.desktop.load().then(() => undefined)');
      assert.equal(await run("[...terminals.values()].every(view => view.themeId === state.settings.theme)"), true);
      assert.equal(await run('state.settings.opacity'), 100);
      if (process.platform !== 'linux') assert.ok(Math.abs(window.getOpacity() - 1) < 0.01);
      await run('openSettings()');
      await run("document.getElementById('theme').value = 'nordFrost'; document.getElementById('font-size').value = '16'; document.getElementById('settings-form').requestSubmit()");
      await waitFor("state.settings.theme === 'nordFrost'");
      const persisted = model.load(path.join(temporary, 'workspace.json'));
      assert.equal(persisted.settings.fontSize, 16);
      assert.equal(persisted.panes.home[0].id, first);
      await run("openSettings(); [...document.querySelectorAll('.theme-card')].find(card => card.querySelector('strong').textContent === 'Hacker').click(); document.getElementById('app-opacity').value = '80'; document.getElementById('app-opacity').dispatchEvent(new Event('input')); document.getElementById('settings-form').requestSubmit()");
      await waitFor("state.settings.theme === 'hacker' && state.settings.opacity === 80");
      const appearance = model.load(path.join(temporary, 'workspace.json')).settings;
      assert.equal(appearance.theme, 'hacker');
      assert.equal(appearance.opacity, 80);
      if (process.platform !== 'linux') assert.ok(Math.abs(window.getOpacity() - 0.8) < 0.01);
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
      const originalOpenDialog = dialog.showOpenDialog;
      let parentSelections = 0;
      dialog.showOpenDialog = async () => { parentSelections++; return { canceled: true, filePaths: [] }; };
      try {
        const projectCount = await run('state.projects.length');
        await run("document.getElementById('create-folder').click()");
        await waitFor("document.getElementById('text-dialog').open");
        await run("document.getElementById('cancel-text').click()");
        await run('actionQueue');
        assert.equal(parentSelections, 0);
        await run("document.getElementById('create-folder').click()");
        await waitFor("document.getElementById('text-dialog').open");
        await run("document.getElementById('text-value').value = 'Canceled folder'; document.getElementById('text-form').requestSubmit()");
        await run('actionQueue');
        assert.equal(await run('state.projects.length'), projectCount);
        assert.equal(fs.existsSync(path.join(temporary, 'Canceled folder')), false);
        dialog.showOpenDialog = async (_window, options) => {
          assert.equal(options.title, 'Chọn nơi tạo thư mục');
          return { canceled: false, filePaths: [temporary] };
        };
        await run("document.getElementById('create-folder').click()");
        await waitFor("document.getElementById('text-dialog').open");
        await run("document.getElementById('text-value').value = 'Dự án mới'; document.getElementById('text-form').requestSubmit()");
        await run('actionQueue');
        assert.equal(fs.statSync(path.join(temporary, 'Dự án mới')).isDirectory(), true);
        assert.equal(await run('state.projects.length'), projectCount + 1);
        assert.equal(await run('state.projects.find(p => p.id === state.selected).path'), path.join(temporary, 'Dự án mới'));
      } finally { dialog.showOpenDialog = originalOpenDialog; }
      window.webContents.debugger.attach('1.3');
      try {
        const count = await run('state.projects.length');
        const folders = [path.join(temporary, 'src'), path.join(temporary, 'src', 'nested')];
        await run("(() => { const picker = document.createElement('input'); picker.type = 'file'; picker.multiple = true; picker.hidden = true; picker.id = 'workspace-drop-fixture'; document.body.append(picker); })()");
        const { root } = await window.webContents.debugger.sendCommand('DOM.getDocument');
        const { nodeId } = await window.webContents.debugger.sendCommand('DOM.querySelector', { nodeId: root.nodeId, selector: '#workspace-drop-fixture' });
        await window.webContents.debugger.sendCommand('DOM.setFileInputFiles', { nodeId, files: [...folders, droppedFiles[0]] });
        await run("globalThis.dropWorkspace = () => { const transfer = new DataTransfer(); for (const file of document.getElementById('workspace-drop-fixture').files) transfer.items.add(file); const sidebar = document.getElementById('sidebar'); const over = new DragEvent('dragover', { dataTransfer: transfer, bubbles: true, cancelable: true }); sidebar.dispatchEvent(over); sidebar.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true })); return over.defaultPrevented; }; void 0");
        assert.equal(await run('dropWorkspace()'), true);
        await run('actionQueue');
        assert.equal(await run('state.projects.length'), count + 2);
        assert.deepEqual(await run('state.projects.slice(-2).map(project => project.path)'), folders);
        const selected = await run('state.selected');
        assert.equal(await run('document.querySelectorAll("#sidebar.drag-over").length'), 0);
        assert.equal(await run('dropWorkspace()'), true);
        await run('actionQueue');
        assert.equal(await run('state.projects.length'), count + 2);
        assert.equal(await run('state.selected'), selected);
        assert.equal(model.load(path.join(temporary, 'workspace.json')).selected, selected);
        await run("document.getElementById('workspace-drop-fixture').remove()");
      } finally { window.webContents.debugger.detach(); }
      await run("act(() => update(s => { s.panes = {home: []}; s.projects = []; s.selected = 'home'; }))()");
      await waitFor('terminals.size === 0');
      await run("(() => { const transfer = new DataTransfer(); for (const file of nativeDropFiles) transfer.items.add(file); document.getElementById('empty').dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true })); })()");
      await run('actionQueue');
      await waitFor('terminals.size === 1 && [...terminals.values()][0].running');
      await waitFor("(() => { const buffer = [...terminals.values()][0].term.buffer.active; return Array.from({ length: buffer.length }, (_, i) => buffer.getLine(i).translateToString(false)).join('').includes('Dự án có dấu.txt'); })()");
      await run("act(() => update(s => { s.panes.home = []; }))()");
      await waitFor('terminals.size === 0');
      assert.equal(await run("document.getElementById('error').hidden"), true);
      console.log('PASS: native folder drops into sidebar with deduplication/persistence, file drops into panes/Launchpad without Enter, automatic command drawer, all four agents, model/effort grouping, real PTY, shell switching/restart, renderer isolation and persistence');
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
