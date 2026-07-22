const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;
let initPromise = null;

function getDbPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'box_label.db');
}

/** 内箱默认字段 */
const INNER_FIELDS = JSON.stringify([
  { key: 'supplier_code', label: '供应商代码', type: 'text', required: true, sort_order: 1 },
  { key: 'material_code', label: '物料编码', type: 'text', required: true, sort_order: 2 },
  { key: 'alloy_status', label: '合金状态', type: 'text', required: false, sort_order: 3 },
  { key: 'specification', label: '规格', type: 'text', required: true, sort_order: 4 },
  { key: 'batch_no', label: '批号', type: 'text', required: true, sort_order: 5 },
  { key: 'length', label: '长度', type: 'number', required: false, sort_order: 6 },
  { key: 'net_weight', label: '净重', type: 'number', required: true, sort_order: 7 },
  { key: 'gross_weight', label: '毛重', type: 'number', required: true, sort_order: 8 },
]);

/** 外箱默认字段 */
const OUTER_FIELDS = JSON.stringify([
  { key: 'supplier_code', label: '供应商代码', type: 'text', required: true, sort_order: 1 },
  { key: 'material_code', label: '物料编码', type: 'text', required: true, sort_order: 2 },
  { key: 'alloy_status', label: '合金状态', type: 'text', required: false, sort_order: 3 },
  { key: 'specification', label: '规格', type: 'text', required: true, sort_order: 4 },
  { key: 'batch_no', label: '批号', type: 'text', required: true, sort_order: 5 },
  { key: 'length', label: '长度', type: 'number', required: false, sort_order: 6 },
  { key: 'net_weight', label: '净重', type: 'number', required: true, sort_order: 7 },
  { key: 'gross_weight', label: '毛重', type: 'number', required: true, sort_order: 8 },
]);

async function initDatabase() {
  if (initPromise) return initPromise;

  initPromise = new Promise(async (resolve, reject) => {
    try {
      const SQL = await initSqlJs();
      const dbPath = getDbPath();
      const dbDir = path.dirname(dbPath);

      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      let buffer = null;
      if (fs.existsSync(dbPath)) {
        buffer = fs.readFileSync(dbPath);
      }

      db = new SQL.Database(buffer);
      db.run('PRAGMA foreign_keys = ON');

      // 创建箱牌表
      db.run(`
        CREATE TABLE IF NOT EXISTS box_labels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          box_number TEXT UNIQUE NOT NULL,
          box_type TEXT DEFAULT 'inner' CHECK(box_type IN ('inner', 'outer')),
          custom_fields TEXT DEFAULT '{}',
          qr_content TEXT DEFAULT '',
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'printed')),
          print_count INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now', 'localtime')),
          printed_at TEXT
        )
      `);

      // 迁移：添加 box_type 列
      const tableInfo = db.exec("PRAGMA table_info(box_labels)");
      const columns = tableInfo[0]?.values.map(v => v[1]) || [];
      if (!columns.includes('box_type')) {
        db.run("ALTER TABLE box_labels ADD COLUMN box_type TEXT DEFAULT 'inner'");
      }

      // 创建打印日志表
      db.run(`
        CREATE TABLE IF NOT EXISTS print_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          box_label_id INTEGER NOT NULL,
          printer_name TEXT DEFAULT '',
          printed_at TEXT DEFAULT (datetime('now', 'localtime')),
          status TEXT DEFAULT 'success' CHECK(status IN ('success', 'failed')),
          FOREIGN KEY (box_label_id) REFERENCES box_labels(id) ON DELETE CASCADE
        )
      `);

      // 创建设置表
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT DEFAULT ''
        )
      `);

      // 插入默认设置
      const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
      insertSetting.run(['printer_name', '']);
      insertSetting.run(['label_width', '100']);
      insertSetting.run(['label_height', '75']);
      insertSetting.run(['company_name', '我的公司']);
      insertSetting.run(['company_logo', '']);
      insertSetting.run(['label_template', 'factory']);

      // 插入内箱/外箱字段定义
      const hasInner = db.exec("SELECT value FROM settings WHERE key = 'field_definitions_inner'");
      if (!hasInner.length) insertSetting.run(['field_definitions_inner', INNER_FIELDS]);

      const hasOuter = db.exec("SELECT value FROM settings WHERE key = 'field_definitions_outer'");
      if (!hasOuter.length) insertSetting.run(['field_definitions_outer', OUTER_FIELDS]);

      insertSetting.free();
      saveDatabase();
      console.log('数据库初始化成功:', dbPath);
      resolve();
    } catch (err) {
      console.error('数据库初始化失败:', err);
      reject(err);
    }
  });

  return initPromise;
}

function saveDatabase() {
  if (!db) return;
  const dbPath = getDbPath();
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function getDatabase() {
  if (!db) throw new Error('数据库未初始化');
  return {
    prepare: (sql) => {
      const stmt = db.prepare(sql);
      return {
        run: (...params) => {
          const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
          stmt.bind(bindParams); stmt.step(); stmt.free(); saveDatabase();
          const result = db.exec("SELECT last_insert_rowid() as id");
          return { lastInsertRowid: result[0]?.values[0]?.[0] || null };
        },
        get: (...params) => {
          const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
          stmt.bind(bindParams);
          const result = stmt.step() ? stmt.getAsObject() : null; stmt.free();
          return result;
        },
        all: (...params) => {
          const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
          stmt.bind(bindParams);
          const results = [];
          while (stmt.step()) results.push(stmt.getAsObject());
          stmt.free();
          return results;
        },
      };
    },
    exec: (sql) => { db.run(sql); saveDatabase(); },
  };
}

module.exports = { initDatabase, getDatabase };
