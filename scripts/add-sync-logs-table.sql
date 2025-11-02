-- トランザクションログテーブル
CREATE TABLE IF NOT EXISTS sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_type TEXT NOT NULL CHECK(operation_type IN ('create', 'update', 'delete')),
  entity_type TEXT NOT NULL DEFAULT 'event',
  entity_id INTEGER,
  google_event_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'success', 'failed', 'retrying')),
  direction TEXT NOT NULL CHECK(direction IN ('db_to_google', 'google_to_db')),
  data_snapshot TEXT,  -- JSON形式でデータを保存
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_entity ON sync_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_google_event ON sync_logs(google_event_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at);

-- Webhookチャンネル管理テーブル
CREATE TABLE IF NOT EXISTS webhook_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT UNIQUE NOT NULL,
  resource_id TEXT NOT NULL,
  expiration DATETIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'expired', 'stopped')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 不整合検出テーブル
CREATE TABLE IF NOT EXISTS sync_inconsistencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER,
  google_event_id TEXT,
  inconsistency_type TEXT NOT NULL CHECK(inconsistency_type IN ('missing_in_db', 'missing_in_google', 'data_mismatch', 'orphan')),
  details TEXT,  -- JSON形式で詳細情報を保存
  status TEXT NOT NULL DEFAULT 'detected' CHECK(status IN ('detected', 'resolved', 'ignored')),
  detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_sync_inconsistencies_status ON sync_inconsistencies(status);
CREATE INDEX IF NOT EXISTS idx_sync_inconsistencies_type ON sync_inconsistencies(inconsistency_type);
