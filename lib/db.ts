import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'lottery.db');
const db = new Database(dbPath);

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
      event_type TEXT NOT NULL CHECK(event_type IN ('desert', 'gap')),
      event_date TEXT NOT NULL,
      team TEXT CHECK(team IN ('A', 'B')),
      event_group TEXT,
      google_event_id TEXT UNIQUE,
      capacity INTEGER DEFAULT 30,
      participants_limit INTEGER DEFAULT 20,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'finished')),
      lottery_executed INTEGER DEFAULT 0,
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
    db.exec(`ALTER TABLE applications ADD COLUMN allow_alternative_team INTEGER DEFAULT 0`);
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
      is_doubles INTEGER DEFAULT 0,
      dice_score INTEGER NOT NULL,
      used_ticket INTEGER DEFAULT 0,
      total_score INTEGER NOT NULL,
      preferred_team TEXT CHECK(preferred_team IN ('A', 'B', 'any')),
      allow_alternative_team INTEGER DEFAULT 0,
      result_team TEXT CHECK(result_team IN ('A', 'B', NULL)),
      result_status TEXT CHECK(result_status IN ('participant', 'candidate', 'rejected', NULL)),
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

  console.log('Database initialized successfully');
}

// データベースを初期化（モジュールロード時に自動実行）
initializeDatabase();

export default db;
