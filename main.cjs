const { app, BrowserWindow, ipcMain, dialog, Menu, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const pty = require('node-pty');
const model = require('./model.cjs');
// Keep existing Windows workspaces when the package name changes.
if (process.platform === 'win32') app.setPath('userData', path.join(app.getPath('appData'), 'termanager-windows'));
let window, state, stateFile;
const sessions = new Map();
const stopping = new Set();
const pageURL = pathToFileURL(path.join(__dirname, 'index.html')).href;

function stop(id) {
  const session = sessions.get(id);
  if (!session) return;
  sessions.delete(id);
  const exited = new Promise(resolve => {
    const timeout = setTimeout(() => { if (process.platform !== 'win32') session.kill('SIGKILL'); }, 2000);
    timeout.unref();
    session.onExit(() => { clearTimeout(timeout); resolve(); });
  });
  stopping.add(exited);
  exited.then(() => stopping.delete(exited));
  session.kill();
  return exited;
}
function handle(channel, callback) {
  ipcMain.handle(channel, (event, ...args) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame ||
        event.senderFrame.url !== pageURL) throw new Error('Nguồn yêu cầu không hợp lệ.');
    return callback(...args);
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(() => {
    stateFile = path.join(app.getPath('userData'), 'workspace.json');
    try { state = model.load(stateFile); }
    catch (error) {
      dialog.showErrorBox('Không thể đọc workspace', `${error.message}\nDữ liệu gốc được giữ tại:\n${stateFile}\nHãy sao lưu và sửa hoặc đổi tên file trước khi mở lại.`);
      app.quit(); return;
    }
    Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([
      { role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }
    ]) : null);
    window = new BrowserWindow({
      title: 'TerManager-Platform', width: 1440, height: 900, minWidth: 900, minHeight: 580,
      backgroundColor: '#0e1015',
      ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 13 } } : {}),
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    handle('workspace:load', () => ({ state, home: os.homedir(), platform: process.platform, arch: process.arch, shells: model.shells }));
    handle('workspace:save', async next => {
      model.save(stateFile, next);
      state = next;
      for (const id of sessions.keys()) {
        try { model.findPane(state, id); } catch { stop(id); }
      }
      await Promise.all(stopping);
    });
    handle('clipboard:copy', data => {
      if (typeof data !== 'string' || data.length > 1048576) throw new Error('Nội dung clipboard quá lớn.');
      clipboard.writeText(data);
    });
    handle('clipboard:paste', () => clipboard.readText());
    handle('project:folder', async () => {
      const result = await dialog.showOpenDialog(window, { properties: ['openDirectory'] });
      if (result.canceled) return null;
      const directory = result.filePaths[0];
      return { path: directory, name: path.basename(directory) };
    });
    handle('terminal:start', id => {
      model.text(id, 100);
      const entity = model.findPane(state, id);
      if (sessions.has(id)) return;
      const cwd = model.entityPath(state, entity, os.homedir());
      if (!fs.statSync(cwd).isDirectory()) throw new Error('Thư mục project không tồn tại.');
      const isWindows = process.platform === 'win32';
      const executable = state.settings.shell;
      const args = !isWindows ? ['-l'] : executable === 'cmd.exe' ? [] : ['-NoLogo'];
      const env = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' };
      if (process.platform === 'darwin') {
        // Without a UTF-8 locale, shell editing deletes bytes instead of accented characters.
        const locale = [env.LC_ALL, env.LC_CTYPE, env.LANG].find(value => /\.UTF-?8$/i.test(value || '')) || 'en_US.UTF-8';
        for (const name of ['LANG', 'LC_CTYPE', 'LC_ALL']) {
          if (name === 'LC_ALL' && !env[name]) continue;
          if (!/\.UTF-?8$/i.test(env[name] || '')) env[name] = locale;
        }
      }
      const session = pty.spawn(executable, args, {
        name: 'xterm-256color', cols: 100, rows: 30, cwd,
        env
      });
      sessions.set(id, session);
      session.onData(data => { if (!window.isDestroyed()) window.webContents.send('terminal:output', id, data); });
      session.onExit(({ exitCode }) => {
        if (sessions.get(id) !== session) return;
        sessions.delete(id);
        if (!window.isDestroyed()) window.webContents.send('terminal:exit', id, exitCode);
      });
    });
    handle('terminal:input', (id, data) => {
      model.text(id, 100);
      if (typeof data !== 'string' || data.length > 1048576) throw new Error('Dữ liệu terminal không hợp lệ.');
      const session = sessions.get(id);
      if (!session) throw new Error('Terminal đã dừng.');
      session.write(data);
    });
    handle('terminal:resize', (id, cols, rows) => {
      if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || rows < 1 || cols > 1000 || rows > 1000) throw new Error('Kích thước terminal không hợp lệ.');
      sessions.get(id)?.resize(cols, rows);
    });
    handle('terminal:kill', id => { model.text(id, 100); return stop(id); });
    window.on('close', event => {
      if (sessions.size && dialog.showMessageBoxSync(window, {
        type: 'question', buttons: ['Hủy', 'Đóng ứng dụng'], defaultId: 0, cancelId: 0,
        message: 'Đóng ứng dụng và dừng tất cả terminal?', detail: 'Các lệnh đang chạy sẽ bị dừng. Bố cục vẫn được lưu.'
      }) !== 1) { event.preventDefault(); return; }
      if (sessions.size || stopping.size) {
        event.preventDefault();
        for (const id of sessions.keys()) stop(id);
        Promise.all(stopping).then(() => { if (!window.isDestroyed()) window.close(); });
      }
    });
    window.on('closed', () => { for (const id of sessions.keys()) stop(id); });
    window.loadURL(pageURL);
  }).catch(error => { dialog.showErrorBox('Terminal Manager', error.message); app.quit(); });
  app.on('window-all-closed', () => app.quit());
}
