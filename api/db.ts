/**
 * Database connection and initialization using sql.js (pure JS SQLite)
 */
import initSqlJs, { type Database } from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.join(__dirname, 'data', 'mikus.db')
const DATA_DIR = path.join(__dirname, 'data')

let db: Database

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  capacity INTEGER NOT NULL DEFAULT 104857600,
  used_capacity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'local',
  config TEXT NOT NULL DEFAULT '{}',
  is_default INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  user_id TEXT NOT NULL,
  cover TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER DEFAULT 0,
  height INTEGER DEFAULT 0,
  url TEXT NOT NULL,
  thumbnail_url TEXT DEFAULT '',
  strategy_id TEXT NOT NULL,
  album_id TEXT DEFAULT NULL,
  user_id TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'private',
  hash TEXT DEFAULT '',
  links TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (strategy_id) REFERENCES strategies(id),
  FOREIGN KEY (album_id) REFERENCES albums(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS image_tags (
  image_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (image_id, tag_id),
  FOREIGN KEY (image_id) REFERENCES images(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'string',
  description TEXT DEFAULT '',
  is_public INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  target_name TEXT,
  detail TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`

let saveTimer: ReturnType<typeof setTimeout> | null = null
const SAVE_DELAY = 2000 // Debounce: save to disk 2s after last write

function saveDbToFile() {
  if (!db) return
  try {
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(DB_PATH, buffer)
  } catch (err) {
    console.error('Failed to save database:', err)
  }
}

/** Schedule a debounced save — coalesces rapid writes into one disk flush */
export function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    saveDbToFile()
  }, SAVE_DELAY)
}

/** Force immediate save — call before process exit or critical operations */
export function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  saveDbToFile()
}

function loadDbFromFile(): Uint8Array | null {
  try {
    if (fs.existsSync(DB_PATH)) {
      return fs.readFileSync(DB_PATH)
    }
  } catch (err) {
    console.error('Failed to load database:', err)
  }
  return null
}

function insertDefaultData() {
  // Check if default strategy already exists
  const existing = db.exec("SELECT id FROM strategies WHERE id = 'default-local'")
  if (existing.length > 0 && existing[0].values.length > 0) return

  // Insert default local storage strategy
  db.run(
    `INSERT INTO strategies (id, name, type, config, is_default, status) VALUES (?, ?, ?, ?, ?, ?)`,
    ['default-local', '本地存储', 'local', '{}', 1, 'active']
  )

  // Insert default settings
  const defaultSettings = [
    ['site_name', 'Mikus图床', 'string', '站点名称', 1],
    ['site_description', '一个简洁的图床系统', 'string', '站点描述', 1],
    ['max_file_size', '10485760', 'number', '最大文件大小(字节)', 1],
    ['allowed_types', 'jpg,jpeg,png,gif,webp,svg,bmp,ico', 'string', '允许的文件类型', 1],
    ['enable_compress', 'true', 'boolean', '启用压缩', 0],
    ['compress_quality', '80', 'number', '压缩质量(1-100)', 0],
    ['enable_watermark', 'false', 'boolean', '启用水印', 0],
    ['watermark_text', 'Mikus图床', 'string', '水印文字', 0],
    ['watermark_position', 'bottom-right', 'string', '水印位置', 0],
    ['watermark_opacity', '0.3', 'number', '水印透明度(0-1)', 0],
    ['enable_thumbnail', 'true', 'boolean', '启用缩略图', 0],
    ['thumbnail_max_width', '300', 'number', '缩略图最大宽度', 0],
    ['default_strategy', 'default-local', 'string', '默认存储策略', 0],
    ['base_url', 'http://localhost:5173', 'string', '站点基础URL', 0],
    ['jwt_secret', 'mikus-secret-key-2024', 'string', 'JWT密钥', 0],
    ['register_enabled', 'true', 'boolean', '开放注册', 1],
    ['default_capacity', '104857600', 'number', '默认用户容量(字节)', 0],
    ['user_isolation', 'true', 'boolean', '用户隔离（普通用户只能看到自己的图片）', 1],
    ['site_created_at', new Date().toISOString(), 'string', '站点创建时间', 0],
  ]

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO settings (key, value, type, description, is_public) VALUES (?, ?, ?, ?, ?)`
  )
  for (const setting of defaultSettings) {
    stmt.bind(setting)
    stmt.step()
    stmt.reset()
  }
  stmt.free()

  saveDbToFile()
}

export async function initDb(): Promise<Database> {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  const SQL = await initSqlJs()
  const data = loadDbFromFile()

  if (data) {
    db = new SQL.Database(data)
  } else {
    db = new SQL.Database()
  }

  // Create tables
  db.run(CREATE_TABLES_SQL)

  // Lightweight migrations for existing databases
  const imageColumns = db.exec('PRAGMA table_info(images)')
  const hasThumbnailUrl = imageColumns.length > 0 && imageColumns[0].values.some((row) => row[1] === 'thumbnail_url')
  if (!hasThumbnailUrl) {
    db.run("ALTER TABLE images ADD COLUMN thumbnail_url TEXT DEFAULT ''")
    saveDbToFile()
  }

  // Insert default data
  insertDefaultData()

  // Auto-save interval (every 30 seconds as safety net)
  setInterval(saveDbToFile, 30000)

  // Flush on process exit to avoid data loss
  process.on('exit', flushSave)
  process.on('SIGINT', () => { flushSave(); process.exit(0) })
  process.on('SIGTERM', () => { flushSave(); process.exit(0) })

  console.log('Database initialized successfully')
  return db
}

export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.')
  }
  return db
}

/**
 * Execute a parameterized query and return results in the same format as db.exec()
 * sql.js's db.exec() does NOT support parameter binding, so we use prepare/bind/step
 */
export function query(sql: string, params: any[] = []): Database.QueryResult[] {
  const d = getDb()
  if (params.length === 0) {
    return d.exec(sql)
  }

  const stmt = d.prepare(sql)
  const bindResult = stmt.bind(params)
  if (!bindResult) {
    stmt.free()
    console.error('Query bind failed:', sql, params)
    return []
  }

  const results: Database.QueryResult[] = []
  let hasColumns = false

  while (stmt.step()) {
    if (!hasColumns) {
      const columnNames = stmt.getColumnNames()
      results.push({ columns: columnNames, values: [] })
      hasColumns = true
    }
    // stmt.get() without args returns the entire row as array
    const row = stmt.get()
    results[0].values.push(row as unknown as Database.SqlValue[])
  }

  stmt.free()
  return results
}

export { saveDbToFile }

// ── Settings cache ──────────────────────────────────────────────────
let settingsCache: Map<string, string> | null = null

function loadSettingsCache(): Map<string, string> {
  if (settingsCache) return settingsCache
  settingsCache = new Map<string, string>()
  const result = db.exec('SELECT key, value FROM settings')
  if (result.length > 0) {
    for (const row of result[0].values) {
      settingsCache.set(row[0] as string, row[1] as string)
    }
  }
  return settingsCache
}

/** Invalidate settings cache — call after updating settings */
export function invalidateSettingsCache() {
  settingsCache = null
}

/** Get a setting value from cache (no DB query) */
export function getCachedSetting(key: string): string | null {
  return loadSettingsCache().get(key) ?? null
}

/** Get base URL from cache */
export function getCachedBaseUrl(): string {
  return getCachedSetting('base_url') || process.env.BASE_URL || 'http://localhost:5173'
}
