import db from './db';

export type OperationType = 'create' | 'update' | 'delete';
export type SyncDirection = 'db_to_google' | 'google_to_db';
export type SyncStatus = 'pending' | 'success' | 'failed' | 'retrying';

interface SyncLogParams {
  operationType: OperationType;
  entityId?: number;
  googleEventId?: string;
  direction: SyncDirection;
  dataSnapshot?: any;
}

interface SyncLog {
  id: number;
  operation_type: OperationType;
  entity_type: string;
  entity_id?: number;
  google_event_id?: string;
  status: SyncStatus;
  direction: SyncDirection;
  data_snapshot?: string;
  error_message?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

/**
 * 同期ログを作成
 */
export function createSyncLog(params: SyncLogParams): number {
  const result = db.prepare(`
    INSERT INTO sync_logs (
      operation_type, entity_type, entity_id, google_event_id,
      status, direction, data_snapshot
    ) VALUES (?, 'event', ?, ?, 'pending', ?, ?)
  `).run(
    params.operationType,
    params.entityId || null,
    params.googleEventId || null,
    params.direction,
    params.dataSnapshot ? JSON.stringify(params.dataSnapshot) : null
  );

  return result.lastInsertRowid as number;
}

/**
 * 同期ログを成功としてマーク
 */
export function markSyncSuccess(logId: number, googleEventId?: string): void {
  const updates: any = {
    status: 'success',
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (googleEventId) {
    db.prepare(`
      UPDATE sync_logs
      SET status = ?, google_event_id = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(updates.status, googleEventId, updates.completed_at, updates.updated_at, logId);
  } else {
    db.prepare(`
      UPDATE sync_logs
      SET status = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(updates.status, updates.completed_at, updates.updated_at, logId);
  }
}

/**
 * 同期ログを失敗としてマーク
 */
export function markSyncFailed(logId: number, errorMessage: string): void {
  db.prepare(`
    UPDATE sync_logs
    SET status = 'failed', error_message = ?, updated_at = ?
    WHERE id = ?
  `).run(errorMessage, new Date().toISOString(), logId);
}

/**
 * 同期ログをリトライ中としてマーク
 */
export function markSyncRetrying(logId: number): void {
  db.prepare(`
    UPDATE sync_logs
    SET status = 'retrying', retry_count = retry_count + 1, updated_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), logId);
}

/**
 * 失敗した同期ログを取得
 */
export function getFailedSyncLogs(maxRetries: number = 3): SyncLog[] {
  return db.prepare(`
    SELECT * FROM sync_logs
    WHERE status IN ('failed', 'retrying')
      AND retry_count < ?
    ORDER BY created_at ASC
    LIMIT 100
  `).all(maxRetries) as SyncLog[];
}

/**
 * 保留中の同期ログを取得
 */
export function getPendingSyncLogs(): SyncLog[] {
  return db.prepare(`
    SELECT * FROM sync_logs
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 100
  `).all() as SyncLog[];
}

/**
 * 同期ログの統計を取得
 */
export function getSyncLogStats() {
  const stats = db.prepare(`
    SELECT
      status,
      direction,
      COUNT(*) as count
    FROM sync_logs
    WHERE created_at > datetime('now', '-7 days')
    GROUP BY status, direction
  `).all() as Array<{ status: string; direction: string; count: number }>;

  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM sync_logs
    WHERE created_at > datetime('now', '-7 days')
  `).get() as { count: number };

  return {
    stats,
    total: total.count,
  };
}

/**
 * 古い同期ログを削除（クリーンアップ）
 */
export function cleanupOldSyncLogs(daysToKeep: number = 30): number {
  const result = db.prepare(`
    DELETE FROM sync_logs
    WHERE created_at < datetime('now', '-' || ? || ' days')
      AND status = 'success'
  `).run(daysToKeep);

  return result.changes;
}

/**
 * トランザクション付き同期実行
 */
export async function executeWithTransactionLog<T>(
  params: SyncLogParams,
  operation: () => Promise<T>
): Promise<T> {
  const logId = createSyncLog(params);

  try {
    const result = await operation();

    // 成功時、google_event_idが返却されている場合は記録
    const googleEventId = (result as any)?.googleEventId || params.googleEventId;
    markSyncSuccess(logId, googleEventId);

    return result;
  } catch (error: any) {
    markSyncFailed(logId, error.message || String(error));
    throw error;
  }
}

/**
 * リトライ可能な同期ログを処理
 */
export async function processRetryableSyncLogs(
  handler: (log: SyncLog) => Promise<void>,
  maxRetries: number = 3
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const logs = getFailedSyncLogs(maxRetries);
  let succeeded = 0;
  let failed = 0;

  for (const log of logs) {
    markSyncRetrying(log.id);

    try {
      await handler(log);
      markSyncSuccess(log.id);
      succeeded++;
    } catch (error: any) {
      markSyncFailed(log.id, error.message || String(error));
      failed++;
    }
  }

  return {
    processed: logs.length,
    succeeded,
    failed,
  };
}
