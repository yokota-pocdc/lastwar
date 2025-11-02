const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'lottery.db');
const db = new Database(dbPath);

console.log('🔄 Running database migration...');

try {
  // マイグレーションSQLを読み込み
  const migrationSQL = fs.readFileSync(
    path.join(__dirname, 'add-sync-logs-table.sql'),
    'utf8'
  );

  // トランザクションで実行
  db.exec(migrationSQL);

  console.log('✅ Migration completed successfully!');
  console.log('\nCreated tables:');
  console.log('  - sync_logs');
  console.log('  - webhook_channels');
  console.log('  - sync_inconsistencies');

  // テーブルの存在を確認
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name IN ('sync_logs', 'webhook_channels', 'sync_inconsistencies')
    ORDER BY name
  `).all();

  console.log('\nVerified tables:', tables.map(t => t.name).join(', '));

} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
