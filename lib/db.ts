import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'lottery.db');
console.log('Database path:', dbPath);
const db = new Database(dbPath);

// 外部キー制約を無効化（セッション不整合時のエラー回避）
db.pragma('foreign_keys = OFF');

// データベース初期化
export function initializeDatabase() {
  // ユーザーテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 不定期イベントテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS irregular_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      event_date TEXT NOT NULL,
      deadline TEXT NOT NULL,
      google_event_id TEXT UNIQUE,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'finished')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 不定期イベントテーブルのマイグレーション
  try {
    db.exec(`ALTER TABLE irregular_events ADD COLUMN google_event_id TEXT UNIQUE`);
  } catch (e) {
    // カラムが既に存在する場合は無視
  }

  // 不定期イベント参加テーブル
  // P: dice1-3で111-666の3桁数値、Q: sub_dice1-3で同点比較用、R: random_valueでシステムランダム
  db.exec(`
    CREATE TABLE IF NOT EXISTS irregular_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      dice1 INTEGER NOT NULL,
      dice2 INTEGER NOT NULL,
      dice3 INTEGER NOT NULL,
      sub_dice1 INTEGER NOT NULL,
      sub_dice2 INTEGER NOT NULL,
      sub_dice3 INTEGER NOT NULL,
      random_value INTEGER NOT NULL,
      rank INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES irregular_events(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(event_id, user_id)
    )
  `);

  // インデックス作成
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_irregular_events_date ON irregular_events(event_date);
    CREATE INDEX IF NOT EXISTS idx_irregular_applications_event ON irregular_applications(event_id);
    CREATE INDEX IF NOT EXISTS idx_irregular_applications_user ON irregular_applications(user_id);
  `);

  console.log('Database initialized successfully');
}

// データベースを初期化（モジュールロード時に自動実行）
initializeDatabase();

export default db;
