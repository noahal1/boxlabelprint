const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { initDatabase, getDatabase } = require('./database');

let mainWindow = null;

// ========== 自动更新配置 ==========

// 关闭自动下载，让用户选择何时下载
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// 设置日志
autoUpdater.logger = {
  info: (msg) => console.log('[autoUpdater]', msg),
  warn: (msg) => console.warn('[autoUpdater]', msg),
  error: (msg) => console.error('[autoUpdater]', msg),
};

// 更新事件 -> 发送给渲染进程
function sendUpdateEvent(channel, data = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:' + channel, data);
  }
}

autoUpdater.on('checking-for-update', () => {
  sendUpdateEvent('checking');
});

autoUpdater.on('update-available', (info) => {
  sendUpdateEvent('available', {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes,
  });
});

autoUpdater.on('update-not-available', (info) => {
  sendUpdateEvent('not-available', { version: info?.version });
});

autoUpdater.on('download-progress', (progress) => {
  sendUpdateEvent('progress', {
    percent: progress.percent,
    bytesPerSecond: progress.bytesPerSecond,
    transferred: progress.transferred,
    total: progress.total,
  });
});

autoUpdater.on('update-downloaded', (info) => {
  sendUpdateEvent('downloaded', {
    version: info.version,
    releaseDate: info.releaseDate,
  });
});

autoUpdater.on('error', (err) => {
  sendUpdateEvent('error', { message: err.message });
});

// ========== 窗口创建 ==========

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: '箱牌打印管理系统',
    frame: false, // 隐藏默认标题栏
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 开发模式加载 Vite 开发服务器，生产模式加载打包文件
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ========== IPC: 更新操作 ==========

ipcMain.handle('update:check', async () => {
  try {
    autoUpdater.checkForUpdates();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update:download', async () => {
  try {
    autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update:install', async () => {
  try {
    autoUpdater.quitAndInstall();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ========== 数据库 IPC 处理 ==========

ipcMain.handle('db:getBoxLabels', async (event, filters) => {
  const db = getDatabase();
  let sql = 'SELECT * FROM box_labels WHERE 1=1';
  const params = [];

  if (filters?.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters?.keyword) {
    sql += ' AND (box_number LIKE ? OR custom_fields LIKE ?)';
    const kw = `%${filters.keyword}%`;
    params.push(kw, kw);
  }

  sql += ' ORDER BY created_at DESC';

  const stmt = db.prepare(sql);
  const results = stmt.all(...params);
  // 解析 custom_fields JSON
  return results.map(row => ({
    ...row,
    custom_fields: parseJsonSafe(row.custom_fields, {}),
  }));
});

ipcMain.handle('db:createBoxLabel', async (event, data) => {
  const db = getDatabase();
  const customFieldsJson = JSON.stringify(data.custom_fields || {});
  const stmt = db.prepare(`
    INSERT INTO box_labels (box_number, box_type, custom_fields, qr_content, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', datetime('now', 'localtime'))
  `);
  const result = stmt.run(
    data.box_number,
    data.box_type || 'inner',
    customFieldsJson,
    data.qr_content || data.box_number
  );
  return { id: result.lastInsertRowid };
});

ipcMain.handle('db:updateBoxLabel', async (event, id, data) => {
  const db = getDatabase();
  if (data.custom_fields) {
    data.custom_fields = JSON.stringify(data.custom_fields);
  }
  const fields = [];
  const params = [];
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'id') {
      fields.push(`${key} = ?`);
      params.push(value);
    }
  }
  if (fields.length === 0) return { success: false };
  params.push(id);
  db.prepare(`UPDATE box_labels SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return { success: true };
});

ipcMain.handle('db:deleteBoxLabel', async (event, id) => {
  const db = getDatabase();
  db.prepare('DELETE FROM box_labels WHERE id = ?').run(id);
  return { success: true };
});

ipcMain.handle('db:markPrinted', async (event, id, printerName) => {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`UPDATE box_labels SET status = 'printed', printed_at = ?, print_count = print_count + 1 WHERE id = ?`).run(now, id);
  db.prepare(`INSERT INTO print_logs (box_label_id, printer_name, printed_at, status) VALUES (?, ?, ?, 'success')`).run(id, printerName, now);
  return { success: true };
});

ipcMain.handle('db:getPrintLogs', async (event, boxLabelId) => {
  const db = getDatabase();
  if (boxLabelId) {
    return db.prepare('SELECT * FROM print_logs WHERE box_label_id = ? ORDER BY printed_at DESC').all(boxLabelId);
  }
  return db.prepare('SELECT * FROM print_logs ORDER BY printed_at DESC LIMIT 100').all();
});

ipcMain.handle('db:getSetting', async (event, key) => {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
});

ipcMain.handle('db:setSetting', async (event, key, value) => {
  const db = getDatabase();
  db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, value);
  return { success: true };
});

ipcMain.handle('db:getAllSettings', async () => {
  const db = getDatabase();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(row => { settings[row.key] = row.value; });
  return settings;
});

ipcMain.handle('db:getFieldDefinitions', async (event, boxType) => {
  const db = getDatabase();
  const key = boxType === 'outer' ? 'field_definitions_outer' : 'field_definitions_inner';
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? JSON.parse(row.value) : [];
});

ipcMain.handle('db:setFieldDefinitions', async (event, boxType, defs) => {
  const db = getDatabase();
  const key = boxType === 'outer' ? 'field_definitions_outer' : 'field_definitions_inner';
  db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, JSON.stringify(defs));
  return { success: true };
});

ipcMain.handle('db:generateBoxNumber', async () => {
  const db = getDatabase();
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const prefix = `BOX${dateStr}`;
  const row = db.prepare("SELECT box_number FROM box_labels WHERE box_number LIKE ? ORDER BY box_number DESC LIMIT 1").get(`${prefix}%`);
  let seq = 1;
  if (row) {
    const lastSeq = parseInt(row.box_number.slice(-4), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}-${String(seq).padStart(4, '0')}`;
});

// ========== 窗口控制 IPC ==========

ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
  return { success: true };
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
  return { success: true };
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
  return { success: true };
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// ========== 打印 IPC ==========

ipcMain.handle('print:send', async (event, zplData) => {
  try {
    const db = getDatabase();
    const printerName = db.prepare("SELECT value FROM settings WHERE key = 'printer_name'").get();
    if (!printerName || !printerName.value) {
      return { success: false, error: '请先在设置中配置打印机名称' };
    }
    return {
      success: true,
      message: `打印指令已发送到打印机: ${printerName.value}`,
      data: zplData,
      printerName: printerName.value,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ========== 辅助函数 ==========

function parseJsonSafe(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// ========== 应用启动 ==========

app.whenReady().then(async () => {
  try {
    await initDatabase();
    console.log('数据库已就绪，启动应用...');
  } catch (err) {
    console.error('数据库初始化失败:', err);
    dialog.showErrorBox('数据库错误', '数据库初始化失败: ' + err.message);
  }

  createWindow();

  // 窗口创建后，检查更新
  mainWindow.webContents.on('did-finish-load', () => {
    // 延迟几秒检查更新，优先保证界面加载
    setTimeout(() => {
      if (process.env.NODE_ENV !== 'development') {
        autoUpdater.checkForUpdates().catch(() => {});
      }
    }, 5000);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
