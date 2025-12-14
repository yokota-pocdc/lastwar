import Database from 'better-sqlite3';
import path from 'path';

// DATABASE_PATH環境変数でデータベースパスを指定可能（ステージング環境用）
const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.join(process.cwd(), 'lottery.db');
const db = new Database(dbPath);

console.log('Using database:', dbPath);

// 外部キー制約を無効化（user_dice_weeklyのFKエラーを回避）
db.pragma('foreign_keys = OFF');

// データベース初期化
export function initializeDatabase() {
  // ユーザーテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      tickets_remaining INTEGER DEFAULT 2,
      tickets_reset_date TEXT DEFAULT (date('now', 'start of month', '+1 month')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // イベントテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN ('desert', 'gap', 'irregular')),
      event_date TEXT NOT NULL,
      team TEXT CHECK(team IN ('A', 'B', NULL)),
      event_group TEXT,
      google_event_id TEXT UNIQUE,
      capacity INTEGER DEFAULT 30,
      participants_limit INTEGER DEFAULT 20,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'finished')),
      lottery_executed INTEGER DEFAULT 0,
      use_team_b INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 既存のカラムをマイグレーション
  try {
    db.exec(`ALTER TABLE events ADD COLUMN team TEXT CHECK(team IN ('A', 'B'))`);
  } catch (e) {
    // カラムが既に存在する場合は無視
  }

  try {
    db.exec(`ALTER TABLE events ADD COLUMN event_group TEXT`);
  } catch (e) {
    // カラムが既に存在する場合は無視
  }

  try {
    db.exec(`ALTER TABLE events ADD COLUMN google_event_id TEXT UNIQUE`);
  } catch (e) {
    // カラムが既に存在する場合は無視
  }

  try {
    db.exec(`ALTER TABLE events ADD COLUMN use_team_b INTEGER DEFAULT 1`);
  } catch (e) {
    // カラムが既に存在する場合は無視
  }

  // applications用マイグレーション
  try {
    db.exec(`ALTER TABLE applications ADD COLUMN dice3 INTEGER`);
  } catch (e) {
    // カラムが既に存在する場合は無視
  }

  try {
    db.exec(`ALTER TABLE applications ADD COLUMN result_rank INTEGER`);
  } catch (e) {
    // カラムが既に存在する場合は無視
  }

  // user_dice_weekly用マイグレーション
  try {
    db.exec(`ALTER TABLE user_dice_weekly ADD COLUMN dice3 INTEGER`);
  } catch (e) {
    // カラムが既に存在する場合は無視
  }

  // 参加申込テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      dice1 INTEGER NOT NULL,
      dice2 INTEGER NOT NULL,
      dice3 INTEGER,
      is_doubles INTEGER DEFAULT 0,
      dice_score INTEGER NOT NULL,
      used_ticket INTEGER DEFAULT 0,
      total_score INTEGER NOT NULL,
      preferred_team TEXT CHECK(preferred_team IN ('A', 'B', 'any', NULL)),
      result_team TEXT CHECK(result_team IN ('A', 'B', NULL)),
      result_status TEXT CHECK(result_status IN ('participant', 'candidate', 'rejected', NULL)),
      result_rank INTEGER,
      rerolled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(event_id, user_id)
    )
  `);

  // 週単位のサイコロ履歴テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_dice_weekly (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      week INTEGER NOT NULL,
      dice1 INTEGER NOT NULL,
      dice2 INTEGER NOT NULL,
      dice3 INTEGER,
      dice_score INTEGER NOT NULL,
      is_doubles INTEGER DEFAULT 0,
      used_ticket INTEGER DEFAULT 0,
      total_score INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, year, week)
    )
  `);

  // インデックス作成
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
    CREATE INDEX IF NOT EXISTS idx_applications_event ON applications(event_id);
    CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_dice_weekly_user_year_week ON user_dice_weekly(user_id, year, week);
  `);

  // トランザクションログテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL CHECK(operation_type IN ('create', 'update', 'delete')),
      entity_type TEXT NOT NULL DEFAULT 'event',
      entity_id INTEGER,
      google_event_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'success', 'failed', 'retrying')),
      direction TEXT NOT NULL CHECK(direction IN ('db_to_google', 'google_to_db')),
      data_snapshot TEXT,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )
  `);

  // Webhookチャンネル管理テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT UNIQUE NOT NULL,
      resource_id TEXT NOT NULL,
      expiration DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'expired', 'stopped')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 不整合検出テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_inconsistencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER,
      google_event_id TEXT,
      inconsistency_type TEXT NOT NULL CHECK(inconsistency_type IN ('missing_in_db', 'missing_in_google', 'data_mismatch', 'orphan')),
      details TEXT,
      status TEXT NOT NULL DEFAULT 'detected' CHECK(status IN ('detected', 'resolved', 'ignored')),
      detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME
    )
  `);

  // sync関連インデックス
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
    CREATE INDEX IF NOT EXISTS idx_sync_logs_entity ON sync_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_sync_logs_google_event ON sync_logs(google_event_id);
    CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_sync_inconsistencies_status ON sync_inconsistencies(status);
    CREATE INDEX IF NOT EXISTS idx_sync_inconsistencies_type ON sync_inconsistencies(inconsistency_type);
  `);

  console.log('Database initialized successfully');
}

// データベースを初期化（モジュールロード時に自動実行）
initializeDatabase();

export default db;
