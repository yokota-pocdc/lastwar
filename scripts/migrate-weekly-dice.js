const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'lottery.db');
const db = new Database(dbPath);

console.log('🔄 Running weekly dice table migration...');

try {
  // マイグレーションSQLを読み込み
  const migrationSQL = fs.readFileSync(
    path.join(__dirname, 'add-weekly-dice-table.sql'),
    'utf8'
  );

  // トランザクションで実行
  db.exec(migrationSQL);

  console.log('✅ Migration completed successfully!');
  console.log('\nCreated table:');
  console.log('  - user_dice_weekly');

  // テーブルの存在を確認
  const table = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name = 'user_dice_weekly'
  `).get();

  if (table) {
    console.log('\n✓ Verified table:', table.name);

    // カラム情報を表示
    const columns = db.prepare(`PRAGMA table_info(user_dice_weekly)`).all();
    console.log('\nColumns:');
    columns.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });
  } else {
    console.error('❌ Table verification failed');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
