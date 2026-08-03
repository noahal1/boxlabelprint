const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ========== 数据库操作 ==========
  getBoxLabels: (filters) => ipcRenderer.invoke('db:getBoxLabels', filters),
  getBoxLabelStats: () => ipcRenderer.invoke('db:getBoxLabelStats'),
  createBoxLabel: (data) => ipcRenderer.invoke('db:createBoxLabel', data),
  updateBoxLabel: (id, data) => ipcRenderer.invoke('db:updateBoxLabel', id, data),
  deleteBoxLabel: (id) => ipcRenderer.invoke('db:deleteBoxLabel', id),
  markPrinted: (id, printerName) => ipcRenderer.invoke('db:markPrinted', id, printerName),
  getPrintLogs: (boxLabelId) => ipcRenderer.invoke('db:getPrintLogs', boxLabelId),
  generateBoxNumber: () => ipcRenderer.invoke('db:generateBoxNumber'),

  // ========== 字段定义 ==========
  getFieldDefinitions: (boxType) => ipcRenderer.invoke('db:getFieldDefinitions', boxType || 'inner'),
  setFieldDefinitions: (boxType, defs) => ipcRenderer.invoke('db:setFieldDefinitions', boxType || 'inner', defs),

  // ========== 设置 ==========
  getSetting: (key) => ipcRenderer.invoke('db:getSetting', key),
  setSetting: (key, value) => ipcRenderer.invoke('db:setSetting', key, value),
  getAllSettings: () => ipcRenderer.invoke('db:getAllSettings'),

  // ========== 窗口控制 ==========
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // ========== 打印 ==========
  printSend: (zplData) => ipcRenderer.invoke('print:send', zplData),
  printTest: (options) => ipcRenderer.invoke('print:test', options || {}),
  printSystemPreview: (labelHtml) => ipcRenderer.invoke('print:systemPreview', labelHtml),

  // ========== 自动更新 ==========
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateDownload: () => ipcRenderer.invoke('update:download'),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  onUpdateChecking: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('update:checking', handler);
    return () => ipcRenderer.removeListener('update:checking', handler);
  },
  onUpdateAvailable: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('update:available', handler);
    return () => ipcRenderer.removeListener('update:available', handler);
  },
  onUpdateNotAvailable: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('update:not-available', handler);
    return () => ipcRenderer.removeListener('update:not-available', handler);
  },
  onUpdateProgress: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('update:progress', handler);
    return () => ipcRenderer.removeListener('update:progress', handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('update:downloaded', handler);
    return () => ipcRenderer.removeListener('update:downloaded', handler);
  },
  onUpdateError: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('update:error', handler);
    return () => ipcRenderer.removeListener('update:error', handler);
  },
});
