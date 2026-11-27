const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  load: () => ipcRenderer.invoke('workspace:load'),
  agentModels: agent => ipcRenderer.invoke('agent:models', agent),
  save: state => ipcRenderer.invoke('workspace:save', state),
  copy: data => ipcRenderer.invoke('clipboard:copy', data),
  paste: () => ipcRenderer.invoke('clipboard:paste'),
  folder: () => ipcRenderer.invoke('project:folder'),
  createFolder: name => ipcRenderer.invoke('project:create-folder', name),
  start: id => ipcRenderer.invoke('terminal:start', id),
  input: (id, data) => ipcRenderer.invoke('terminal:input', id, data),
  resize: (id, cols, rows) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
  kill: id => ipcRenderer.invoke('terminal:kill', id),
  onOutput: callback => {
    const listener = (_event, id, data) => callback(id, data);
    ipcRenderer.on('terminal:output', listener);
    return () => ipcRenderer.removeListener('terminal:output', listener);
  },
  onExit: callback => {
    const listener = (_event, id, code) => callback(id, code);
    ipcRenderer.on('terminal:exit', listener);
    return () => ipcRenderer.removeListener('terminal:exit', listener);
  },
  onAgent: callback => {
    const listener = (_event, id, agent, model, pid) => callback(id, agent, model, pid);
    ipcRenderer.on('terminal:agent', listener);
    return () => ipcRenderer.removeListener('terminal:agent', listener);
  }
});
