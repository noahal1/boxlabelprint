const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
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

  if (filters?.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  const stmt = db.prepare(sql);
  const results = stmt.all(...params);
  // 解析 custom_fields JSON
  return results.map(row => ({
    ...row,
    custom_fields: parseJsonSafe(row.custom_fields, {}),
  }));
});

/** 箱牌统计数据（SQL COUNT 替代全量查询） */
ipcMain.handle('db:getBoxLabelStats', async () => {
  const db = getDatabase();
  const total = db.prepare('SELECT COUNT(*) as c FROM box_labels').get();
  const printed = db.prepare("SELECT COUNT(*) as c FROM box_labels WHERE status = 'printed'").get();
  const pending = db.prepare("SELECT COUNT(*) as c FROM box_labels WHERE status = 'pending'").get();
  const inner = db.prepare("SELECT COUNT(*) as c FROM box_labels WHERE box_type = 'inner'").get();
  const outer = db.prepare("SELECT COUNT(*) as c FROM box_labels WHERE box_type = 'outer'").get();
  return {
    total: total.c,
    printed: printed.c,
    pending: pending.c,
    inner: inner.c,
    outer: outer.c,
  };
});

ipcMain.handle('db:createBoxLabel', async (event, data) => {
  const db = getDatabase();
  const customFieldsJson = JSON.stringify(data.custom_fields || {});

  // 动态检测表结构，兼容不同版本遗留列（如 product_name）
  const tableInfo = db.exec("PRAGMA table_info(box_labels)");
  const columns = tableInfo[0]?.values.map(v => v[1]) || [];

  const baseCols = ['box_number', 'box_type', 'custom_fields', 'qr_content'];
  const baseVals = [data.box_number, data.box_type || 'inner', customFieldsJson, data.qr_content || data.box_number];

  // 自动检测所有未在基础集中的遗留列（兼容旧版数据库 schema）
  const skipCols = new Set([
    'id', 'box_number', 'box_type', 'custom_fields', 'qr_content',
    'status', 'print_count', 'created_at', 'printed_at',
  ]);
  for (const col of columns) {
    if (!skipCols.has(col)) {
      baseCols.push(col);
      baseVals.push(data[col] || '');
    }
  }

  const stmt = db.prepare(`
    INSERT INTO box_labels (${baseCols.join(', ')}, status, created_at)
    VALUES (${baseVals.map(() => '?').join(', ')}, 'pending', datetime('now', 'localtime'))
  `);
  const result = stmt.run(baseVals);
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

/**
 * 解析 ZPL 状态响应（~HS），形如 "011,0,0,000,0,0,0,0,0,0,0,0,0,0,0"（16 个逗号分隔字段）。
 * 返回关键字段对象；格式不符返回 null。
 *
 * 字段（0 基索引）：
 *   [0] 通信诊断  [1] 打印机状态(位掩码)  [2] 介质路径状态  [3] 打印头温度
 *   [4][5] 错误条件字符  [6] 接收缓冲区字节数  [7] 接收缓冲区格式数  [8] 打印队列格式数
 */
function parseHsResponse(line) {
  const parts = String(line).trim().split(',');
  if (parts.length < 9) return null;
  const nums = parts.map((p) => parseInt(p.trim(), 10));
  if (nums.some((n) => Number.isNaN(n))) return null;
  return {
    printerStatus: nums[1],
    mediaPath: nums[2],
    errCode1: nums[4],
    errCode2: nums[5],
    recvFormats: nums[7],
    queueFormats: nums[8],
  };
}

// ~HS 打印机状态位（字段 2）
const HS_PRINTER_STATUS = {
  paperOut: 0x0001,   // 缺纸
  ribbonOut: 0x0002,  // 缺碳带/色带
  paused: 0x0004,     // 暂停
  headOpen: 0x0008,   // 打印头抬起
};

/**
 * 通过 TCP 发送 ZPL 到标签打印机（标准端口 9100），并轮询 ~HS 等待打印完成确认。
 *
 * - 不修改标签内容（不追加 ~PQ 命令），仅轮询状态，避免打印机不支持 ~PQ 时打印错误页；
 * - 打印队列（~HS 字段 9）清空且接收缓冲区（字段 8）为空视为打印完成；
 * - 检测常见错误：缺纸、缺碳带、暂停、打印头抬起；
 * - 设备完全不响应 ~HS（如普通打印机）时返回 confirmed: false，不判定为成功。
 *
 * 返回 { sent, confirmed, success, message | error, durationMs }
 */
function sendZplAndConfirm(ip, port, zplData, options = {}) {
  const {
    timeoutMs = 30000,       // 等待打印完成的整体超时
    pollIntervalMs = 500,    // ~HS 轮询间隔
    firstPollDelayMs = 400,  // 发送后首轮轮询延迟（给打印机解析任务的时间）
    noResponseMs = 5000,     // 数据已发送后，从未收到 ~HS 响应的宽限期
    queueGraceMs = 1500,     // 未观察到队列>0 时，接受「队列已空」的最短等待
  } = options;

  return new Promise((resolve) => {
    const client = new net.Socket();
    const started = Date.now();
    let settled = false;
    let connected = false;
    let firstResponseAt = 0;
    let idleSeen = false;   // 是否观察到打印机空闲（队列空）
    let sawQueue = false;   // 空闲后是否观察到任务入队（队列>0）
    let pausedCount = 0;    // 暂停位连续计数（热敏控温会短暂置位）
    let lineBuffer = '';
    let pollTimer = null;
    let responseTimer = null;
    let overallTimer = null;

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      clearInterval(pollTimer);
      clearTimeout(responseTimer);
      clearTimeout(overallTimer);
      client.destroy();
      resolve({ sent: true, durationMs: Date.now() - started, ...payload });
    };

    const fail = (error) => finish({ success: false, confirmed: false, error });

    // ~HS 错误条件字符（字段 5/6）：0 或 '0'(48) 视为无错误
    const hsErrorText = (hs) => {
      const charOf = (n) => (n === 0 || n === 48) ? '' : (n > 0 ? String.fromCharCode(n) : '');
      return (charOf(hs.errCode1) + charOf(hs.errCode2)).trim();
    };

    const handleLine = (line) => {
      const hs = parseHsResponse(line);
      if (!hs) return;

      if (!firstResponseAt) firstResponseAt = Date.now();

      const st = hs.printerStatus;
      if (st & HS_PRINTER_STATUS.paperOut) return fail('打印机缺纸，请装入标签纸后重试');
      if (st & HS_PRINTER_STATUS.ribbonOut) return fail('打印机碳带/色带用尽，请更换后重试');
      if (st & HS_PRINTER_STATUS.headOpen) return fail('打印头未合上（head up），请检查打印机');
      if (st & HS_PRINTER_STATUS.paused) {
        // 热敏打印头自动控温等场景暂停位会短暂置位，连续 3 次仍暂停才判定失败
        pausedCount++;
        if (pausedCount >= 3) return fail('打印机处于暂停状态，请解除暂停后重试');
        return;
      }
      pausedCount = 0;

      const q = hs.queueFormats;
      const recv = hs.recvFormats;

      if (q === 0 && recv === 0) {
        idleSeen = true;
        if (sawQueue) {
          // 本次任务已入队（空闲→队列>0）且队列已清空 → 打印完成
          const errText = hsErrorText(hs);
          if (errText) return fail(`打印机报告错误（错误码 ${errText}）`);
          return finish({ success: true, confirmed: true, message: '标签已打印完成（已确认出纸）' });
        }
        // 从未观察到任务入队：可能是打印极快，空闲且无错误持续到宽限期才判定完成
        if (Date.now() - started >= firstPollDelayMs + queueGraceMs) {
          const errText = hsErrorText(hs);
          if (errText) return fail(`打印机报告错误（错误码 ${errText}）`);
          return finish({ success: true, confirmed: true, message: '标签已打印完成（已确认出纸）' });
        }
      } else if (q > 0) {
        // 空闲后任务入队
        if (idleSeen) sawQueue = true;
      }
    };

    const onData = (chunk) => {
      lineBuffer += chunk.toString('ascii');
      let nl;
      while ((nl = lineBuffer.search(/[\r\n]/)) !== -1) {
        const line = lineBuffer.slice(0, nl).trim();
        lineBuffer = lineBuffer.slice(nl + 1);
        if (line) handleLine(line);
        if (settled) return;
      }
    };

    const pollHs = () => {
      if (!settled && client.writable) client.write('~HS\r\n', 'ascii');
    };

    // 数据已发送后：开始轮询 + 无响应/整体超时判定
    const startWaiting = () => {
      clearTimeout(overallTimer);
      overallTimer = setTimeout(() => {
        if (!settled) {
          fail(`打印超时（${timeoutMs / 1000} 秒），未能确认打印完成，请检查打印机状态（缺纸/卡纸/暂停）`);
        }
      }, timeoutMs);

      pollHs();
      pollTimer = setInterval(pollHs, pollIntervalMs);

      responseTimer = setTimeout(() => {
        if (!settled && !firstResponseAt) {
          finish({
            success: true,
            confirmed: false,
            message: '打印数据已发送，但打印机未响应 ZPL 状态查询，无法确认是否已出纸（设备可能不是 ZPL 兼容打印机）',
          });
        }
      }, noResponseMs);
    };

    client.setTimeout(8000); // 连接阶段兜底；连接后轮询持续有数据，不会误触发
    client.connect(port, ip, () => {
      connected = true;
      // 连接建立即启动整体超时兜底，防止 write 回调异常时 Promise 挂起
      overallTimer = setTimeout(() => {
        if (!settled) {
          fail(`打印超时（${timeoutMs / 1000} 秒），未能确认打印完成，请检查打印机状态（缺纸/卡纸/暂停）`);
        }
      }, timeoutMs);
      client.write(zplData, 'utf8', (err) => {
        if (err) {
          fail(`写入打印数据失败: ${err.message}`);
          return;
        }
        startWaiting();
      });
    });

    client.on('data', onData);
    client.on('timeout', () => {
      // 仅处理连接阶段超时；连接后的状态由轮询/无响应/整体超时逻辑判定
      if (!settled && !connected) {
        fail(`连接打印机超时（${ip}:${port}）`);
      }
    });
    client.on('error', (err) => {
      fail(`无法连接到打印机 ${ip}:${port} — ${err.code || err.message}`);
    });
  });
}

ipcMain.handle('print:send', async (event, zplData) => {
  try {
    const db = getDatabase();
    const printerIp = db.prepare("SELECT value FROM settings WHERE key = 'printer_ip'").get();
    const printerPort = db.prepare("SELECT value FROM settings WHERE key = 'printer_port'").get();
    const printerName = db.prepare("SELECT value FROM settings WHERE key = 'printer_name'").get();

    if (!printerIp || !printerIp.value) {
      return { success: false, error: '请先在设置中配置打印机的 IP 地址' };
    }

    const ip = printerIp.value.trim();
    const port = parseInt(printerPort?.value || '9100', 10);
    const name = printerName?.value || ip;

    console.log(`正在发送 ZPL 到打印机 ${name} (${ip}:${port})，等待打印完成确认...`);
    const result = await sendZplAndConfirm(ip, port, zplData);
    console.log(`打印结果: success=${result.success} confirmed=${result.confirmed} 耗时=${result.durationMs}ms`);

    if (!result.success) {
      return { success: false, confirmed: false, sent: true, error: result.error, printerName: name };
    }

    return {
      success: true,
      sent: true,
      confirmed: result.confirmed,
      durationMs: result.durationMs,
      printerName: name,
      message: result.confirmed
        ? `标签已打印完成（已确认出纸，耗时 ${(result.durationMs / 1000).toFixed(1)} 秒）`
        : '打印数据已发送，但未能确认打印机是否出纸（设备未响应 ZPL 状态查询，可能不是 ZPL 打印机）',
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * 生成测试标签 ZPL（含中文与条码，用于验证打印链路与中文兼容性）
 */
function buildTestZpl() {
  const ts = new Date().toLocaleString('zh-CN', { hour12: false });
  return [
    '^XA',
    '^CI28',
    '^CF0,36',
    '^FO40,40^FD打印机测试^FS',
    '^CF0,24',
    '^FO40,110^FDPrint Test / 中文验证^FS',
    '^FO40,170^BY3,3.0^BCN,60,Y,N,N^FD2026TEST01^FS',
    '^CF0,20',
    `^FO40,260^FD${ts}^FS`,
    '^XZ',
  ].join('\n');
}

/**
 * 测试 TCP 连通性并探测设备是否为 ZPL 打印机
 * 连接成功后发送 ZPL 状态查询指令（~HS），ZPL 打印机（如斑马）会返回状态数据
 * （形如 "011,0,0,000,0,0,..." 的逗号分隔状态串）
 *
 * 返回 { connected, zplDetected, latencyMs, success, message | error }
 */
function testPrinterConnection(ip, port) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    const started = Date.now();
    let finished = false;
    let latencyMs = 0;
    let connected = false;
    let zplDetected = false;
    let responseData = '';
    let lineBuffer = '';
    let timer = null;

    const finish = (payload) => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      client.destroy();
      resolve({ latencyMs, connected, zplDetected, ...payload });
    };

    timer = setTimeout(() => {
      if (connected) {
        finish({
          success: false,
          error: `已连接打印机，但 8 秒内未收到 ZPL 状态响应（${ip}:${port}，可能不是 ZPL 兼容打印机）`,
        });
      } else {
        finish({ success: false, error: `连接超时（${ip}:${port}，8 秒无响应）` });
      }
    }, 8000);

    // 静默超时 6 秒（斑马等 ZPL 打印机通常 1 秒内响应 ~HS）；8 秒兜底定时器仍会收尾
    client.setTimeout(6000);
    client.connect(port, ip, () => {
      connected = true;
      latencyMs = Date.now() - started;
      // 发送 ZPL 状态查询，ZPL 打印机（如斑马）会返回状态数据
      client.write('~HS\r\n', 'ascii');
    });

    client.on('data', (chunk) => {
      responseData += chunk.toString('ascii');
      lineBuffer += chunk.toString('ascii');
      let nl;
      while ((nl = lineBuffer.search(/[\r\n]/)) !== -1) {
        const line = lineBuffer.slice(0, nl).trim();
        lineBuffer = lineBuffer.slice(nl + 1);
        if (line && parseHsResponse(line)) {
          zplDetected = true;
          finish({ success: true, message: '连接成功，已检测到 ZPL 设备响应' });
          return;
        }
      }
      // 返回了大量数据但格式不像 ZPL 状态串，判定为非 ZPL 设备
      if (!zplDetected && responseData.length > 512) {
        finish({
          success: false,
          error: '已连接设备，但返回数据不是 ZPL 状态响应（可能不是 ZPL 兼容打印机，如斑马）',
        });
      }
    });

    client.on('timeout', () => {
      if (connected) {
        finish({
          success: false,
          error: '已连接打印机，但未收到 ZPL 状态响应（可能不是 ZPL 兼容打印机，如斑马）',
        });
      } else {
        finish({ success: false, error: `连接超时（${ip}:${port}）` });
      }
    });

    client.on('error', (err) => {
      finish({
        success: false,
        error: `无法连接到打印机 ${ip}:${port} — ${err.code || err.message}`,
      });
    });
  });
}

/**
 * 测试打印机连接（设置页「测试连接」/「打印测试标签」按钮）
 * 可传入 ip/port 覆盖已保存的设置（用于未保存时直接测试表单中的值）
 */
ipcMain.handle('print:test', async (event, options = {}) => {
  const db = getDatabase();
  const { ip: ipOverride, port: portOverride, sendTestLabel = false } = options || {};

  const printerIpRow = db.prepare("SELECT value FROM settings WHERE key = 'printer_ip'").get();
  const printerPortRow = db.prepare("SELECT value FROM settings WHERE key = 'printer_port'").get();
  const printerNameRow = db.prepare("SELECT value FROM settings WHERE key = 'printer_name'").get();

  const ip = (ipOverride || printerIpRow?.value || '').trim();
  const port = parseInt(portOverride || printerPortRow?.value || '9100', 10);
  const name = printerNameRow?.value || ip;

  if (!ip) {
    return { success: false, error: '请先填写打印机的 IP 地址', printerName: name };
  }
  if (isNaN(port) || port <= 0 || port > 65535) {
    return { success: false, error: `端口号无效: ${portOverride || printerPortRow?.value}`, printerName: name };
  }

  try {
    const result = await testPrinterConnection(ip, port);
    const { connected, zplDetected, latencyMs } = result;

    // 网络不通：连接失败
    if (!connected) {
      return { success: false, connected, zplDetected, error: result.error, printerName: name };
    }

    // 网络通了但设备不是 ZPL 打印机（如普通 HP 激光打印机）：判定为失败，
    // 避免用户误以为可以正常打印标签
    if (!zplDetected) {
      return {
        success: false,
        connected,
        zplDetected,
        error: result.error || '已连接打印机，但未检测到 ZPL 设备响应，标签可能无法正常打印',
        printerName: name,
      };
    }

    // 确认是 ZPL 设备；若需要，发送测试标签并等待打印完成确认
    if (sendTestLabel) {
      const sendResult = await sendZplAndConfirm(ip, port, buildTestZpl());
      if (!sendResult.success) {
        return {
          success: false,
          connected,
          zplDetected,
          error: sendResult.error,
          printerName: name,
        };
      }
      return {
        success: true,
        printerName: name,
        latencyMs,
        connected,
        zplDetected,
        labelSent: true,
        confirmed: sendResult.confirmed,
        message: sendResult.confirmed
          ? `连接成功（已检测到 ZPL 设备），测试标签已打印完成（耗时 ${(sendResult.durationMs / 1000).toFixed(1)} 秒）`
          : '测试标签数据已发送，但未收到打印完成确认（设备未响应 ZPL 状态查询）',
      };
    }

    return {
      success: true,
      printerName: name,
      latencyMs,
      connected,
      zplDetected,
      message: result.message,
    };
  } catch (err) {
    return { success: false, error: err.message, printerName: name };
  }
});

/**
 * 系统打印预览：将 HTML 转为 PDF 并用系统 PDF 查看器打开
 * 相比 webContents.print() 的系统打印对话框，本方式可以显示完整的打印预览
 */
ipcMain.handle('print:systemPreview', async (event, labelHtml) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'print-preview-'));
  let printWindow = null;

  try {
    printWindow = new BrowserWindow({
      width: 480,
      height: 600,
      show: false,
      title: '标签打印预览',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // 加载 HTML
    printWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(labelHtml)}`
    );

    // 等待页面加载完成
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('页面加载超时')), 15000);
      printWindow.webContents.on('did-finish-load', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // 生成 PDF
    const pdfBuffer = await printWindow.webContents.printToPDF({
      printBackground: true,
      // HTML 模板已自带内边距，无需额外 margins
      pageSize: { width: 220000, height: 160000 }, // 约 76×56mm
    });

    // 写入临时 PDF 文件
    const pdfPath = path.join(tmpDir, `label-${Date.now()}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);

    // 用系统默认 PDF 查看器打开（支持完整打印预览）
    const openError = await shell.openPath(pdfPath);
    if (openError) {
      return { success: false, error: `无法打开 PDF 查看器: ${openError}` };
    }

    return { success: true, message: 'PDF 已生成并在 PDF 查看器中打开' };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    // 关闭打印窗口
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.close();
    }
    // 清理临时目录（延迟以防 PDF 查看器还在读取）
    setTimeout(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }, 5000);
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
