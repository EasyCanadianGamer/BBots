const Database = require('better-sqlite3');
const fs   = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE  = path.join(DATA_DIR, 'bbots.db');
const OLD_JSON = path.join(DATA_DIR, 'config.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

// ── Tables ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS kv (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT NOT NULL,
    key      TEXT NOT NULL,
    value    TEXT NOT NULL,
    PRIMARY KEY (guild_id, key)
  );

  CREATE TABLE IF NOT EXISTS feature_flags (
    guild_id TEXT NOT NULL,
    feature  TEXT NOT NULL,
    enabled  INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (guild_id, feature)
  );

  CREATE TABLE IF NOT EXISTS auto_responders (
    id         TEXT PRIMARY KEY,
    guild_id   TEXT NOT NULL,
    trigger    TEXT NOT NULL,
    response   TEXT NOT NULL,
    match_type TEXT NOT NULL DEFAULT 'contains'
  );

  CREATE TABLE IF NOT EXISTS scheduled_announcements (
    id         TEXT PRIMARY KEY,
    guild_id   TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message    TEXT NOT NULL,
    cron       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS birthdays (
    guild_id TEXT NOT NULL,
    user_id  TEXT NOT NULL,
    month    INTEGER NOT NULL,
    day      INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS role_menus (
    id         TEXT PRIMARY KEY,
    guild_id   TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    title      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS role_menu_buttons (
    id      TEXT PRIMARY KEY,
    menu_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    label   TEXT NOT NULL,
    emoji   TEXT
  );

  CREATE TABLE IF NOT EXISTS xp (
    guild_id        TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    xp              INTEGER NOT NULL DEFAULT 0,
    level           INTEGER NOT NULL DEFAULT 0,
    last_message_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id    TEXT PRIMARY KEY,
    banner_url TEXT
  );

  CREATE TABLE IF NOT EXISTS notification_feeds (
    id        TEXT PRIMARY KEY,
    guild_id  TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    type      TEXT NOT NULL,
    source    TEXT NOT NULL,
    last_seen TEXT,
    role_ping TEXT
  );

  CREATE TABLE IF NOT EXISTS custom_commands (
    id        TEXT PRIMARY KEY,
    guild_id  TEXT NOT NULL,
    name      TEXT NOT NULL,
    response  TEXT NOT NULL,
    UNIQUE(guild_id, name)
  );
`);

// ── Prepared statements (KV) ──────────────────────────────────────────────────
const stmtGet = db.prepare('SELECT value FROM kv WHERE key = ?');
const stmtSet = db.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)');

// ── One-time migration from old data/config.json ──────────────────────────────
if (fs.existsSync(OLD_JSON)) {
  try {
    const old = JSON.parse(fs.readFileSync(OLD_JSON, 'utf8'));
    const migrate = db.transaction(() => {
      for (const [key, value] of Object.entries(old)) {
        stmtSet.run(key, JSON.stringify(value));
      }
    });
    migrate();
    fs.renameSync(OLD_JSON, OLD_JSON + '.migrated');
    console.log('[DB] Migrated data/config.json → data/bbots.db');
  } catch (err) {
    console.warn('[DB] Migration failed:', err.message);
  }
}

// ── KV API (backward compat) ──────────────────────────────────────────────────
function get(key) {
  const row = stmtGet.get(key);
  if (!row) return undefined;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function set(key, value) {
  stmtSet.run(key, JSON.stringify(value));
}

// ── Guild-scoped settings ─────────────────────────────────────────────────────
const stmtGuildGet = db.prepare('SELECT value FROM guild_settings WHERE guild_id = ? AND key = ?');
const stmtGuildSet = db.prepare('INSERT OR REPLACE INTO guild_settings (guild_id, key, value) VALUES (?, ?, ?)');

function guildGet(guildId, key) {
  const row = stmtGuildGet.get(guildId, key);
  if (!row) return undefined;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function guildSet(guildId, key, value) {
  stmtGuildSet.run(guildId, key, JSON.stringify(value));
}

// ── Feature flags ─────────────────────────────────────────────────────────────
const stmtFlagGet = db.prepare('SELECT enabled FROM feature_flags WHERE guild_id = ? AND feature = ?');
const stmtFlagSet = db.prepare('INSERT OR REPLACE INTO feature_flags (guild_id, feature, enabled) VALUES (?, ?, ?)');
const stmtFlagAll = db.prepare('SELECT feature, enabled FROM feature_flags WHERE guild_id = ?');

const ALL_FEATURES = ['auto_responder', 'scheduled_announcements', 'birthdays', 'role_menus', 'xp', 'notifications', 'ai', 'custom_commands'];

function isEnabled(guildId, feature) {
  const row = stmtFlagGet.get(guildId, feature);
  if (!row) return true; // default: enabled
  return row.enabled === 1;
}

function setEnabled(guildId, feature, enabled) {
  stmtFlagSet.run(guildId, feature, enabled ? 1 : 0);
}

function getAllFlags(guildId) {
  const rows = stmtFlagAll.all(guildId);
  const map = {};
  for (const f of ALL_FEATURES) map[f] = true; // defaults
  for (const row of rows) map[row.feature] = row.enabled === 1;
  return map;
}

// ── Expose raw db for complex queries ─────────────────────────────────────────
module.exports = { db, get, set, guildGet, guildSet, isEnabled, setEnabled, getAllFlags, ALL_FEATURES };
