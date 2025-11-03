#!/usr/bin/env node
/**
 * user_dice_weeklyテーブルの外部キー制約を削除
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'lottery.db');
const db = new Database(dbPath);

console.log('🔄 外部キー制約を削除中...');

try {
  // 既存データをバックアップ
  const existingData = db.prepare('SELECT * FROM user_dice_weekly').all();
  console.log(`📊 既存データ: ${existingData.length}件`);

  // テーブルを削除
  db.exec('DROP TABLE IF EXISTS user_dice_weekly');
  console.log('✓ 既存テーブルを削除');

  // 外部キー制約なしで再作成
  db.exec(`
    CREATE TABLE user_dice_weekly (
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
  console.log('✓ テーブルを再作成（外部キー制約なし）');

  // インデックスを再作成
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_dice_weekly_user_year_week
    ON user_dice_weekly(user_id, year, week)
  `);
  console.log('✓ インデックスを再作成');

  // データを復元
  if (existingData.length > 0) {
    const insert = db.prepare(`
      INSERT INTO user_dice_weekly
      (id, user_id, year, week, dice1, dice2, dice_score, is_doubles, used_ticket, total_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((data) => {
      for (const row of data) {
        insert.run(
          row.id, row.user_id, row.year, row.week,
          row.dice1, row.dice2, row.dice_score,
          row.is_doubles, row.used_ticket, row.total_score,
          row.created_at, row.updated_at
        );
      }
    });

    transaction(existingData);
    console.log(`✓ データを復元: ${existingData.length}件`);
  }

  console.log('✅ 完了！');
  db.close();
  process.exit(0);
} catch (error) {
  console.error('❌ エラー:', error);
  db.close();
  process.exit(1);
}
