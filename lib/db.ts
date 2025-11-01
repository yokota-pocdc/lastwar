import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'lottery.db');
const db = new Database(dbPath);

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
      team_a_capacity INTEGER DEFAULT 30,
      team_b_capacity INTEGER DEFAULT 30,
      team_a_participants INTEGER DEFAULT 20,
      team_b_participants INTEGER DEFAULT 20,
      use_team_b INTEGER DEFAULT 1,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'finished')),
      lottery_executed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
      result_team TEXT CHECK(result_team IN ('A', 'B', NULL)),
      result_status TEXT CHECK(result_status IN ('participant', 'candidate', 'rejected', NULL)),
      rerolled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(event_id, user_id)
    )
  `);

  // インデックス作成
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
    CREATE INDEX IF NOT EXISTS idx_applications_event ON applications(event_id);
    CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
  `);

  console.log('Database initialized successfully');
}

export default db;
