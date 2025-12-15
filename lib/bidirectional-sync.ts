import db from './db';
import {
  fetchCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from './google-calendar';
import { createSyncLog, markSyncSuccess, markSyncFailed } from './sync-transaction';

interface Event {
  id: number;
  title: string;
  event_type: 'desert' | 'gap';
  team: 'A' | 'B';
  event_date: string;
  event_group: string;
  google_event_id?: string;
  status: string;
}

interface InconsistencyRecord {
  event_id?: number;
  google_event_id?: string;
  inconsistency_type: 'missing_in_db' | 'missing_in_google' | 'data_mismatch' | 'orphan';
  details: any;
}

/**
 * 不整合を記録
 */
export function recordInconsistency(record: InconsistencyRecord): void {
  db.prepare(`
    INSERT INTO sync_inconsistencies (
      event_id, google_event_id, inconsistency_type, details, status
    ) VALUES (?, ?, ?, ?, 'detected')
  `).run(
    record.event_id || null,
    record.google_event_id || null,
    record.inconsistency_type,
    JSON.stringify(record.details)
  );
}

/**
 * 不整合を解決済みとしてマーク
 */
export function markInconsistencyResolved(id: number): void {
  db.prepare(`
    UPDATE sync_inconsistencies
    SET status = 'resolved', resolved_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), id);
}

/**
 * 不整合を検出
 */
export async function detectInconsistencies(): Promise<{
  missingInGoogle: Event[];
  missingInDB: any[];
  orphanEvents: Event[];
  dataMismatches: Array<{ db: Event; google: any }>;
}> {
  // Googleカレンダーからイベントを取得
  const googleEvents = await fetchCalendarEvents();
  const googleEventMap = new Map(
    googleEvents.filter(e => e?.googleEventId).map(e => [e!.googleEventId, e])
  );

  // DBからイベントを取得（終了イベントを除外）
  const dbEvents = db.prepare(`
    SELECT * FROM events
    WHERE datetime(event_date) > datetime('now', '-30 days')
      AND status != 'finished'
  `).all() as Event[];

  // 終了イベントのgoogle_event_idも取得（missingInDB判定で除外するため）
  const finishedEventGoogleIds = new Set(
    (db.prepare(`
      SELECT google_event_id FROM events
      WHERE status = 'finished' AND google_event_id IS NOT NULL
    `).all() as { google_event_id: string }[]).map(e => e.google_event_id)
  );

  // 1. DB側にあるがGoogleカレンダー側にないイベント
  const missingInGoogle = dbEvents.filter(event => {
    if (!event.google_event_id) return false; // google_event_idがnullなら除外
    return !googleEventMap.has(event.google_event_id);
  });

  // 2. Googleカレンダー側にあるがDB側にないイベント
  // 終了イベントは除外する（Googleカレンダーに残っていても正常）
  const dbGoogleIds = new Set(
    dbEvents.filter(e => e.google_event_id).map(e => e.google_event_id)
  );
  const missingInDB = googleEvents.filter(e =>
    e && e.googleEventId &&
    !dbGoogleIds.has(e.googleEventId) &&
    !finishedEventGoogleIds.has(e.googleEventId)
  );

  // 3. google_event_idがnullの孤立イベント（将来のイベントのみ）
  const orphanEvents = dbEvents.filter(event => {
    if (event.google_event_id) return false;
    const eventDate = new Date(event.event_date);
    const now = new Date();
    return eventDate > now; // 将来のイベントのみ
  });

  // 4. データの不一致（タイトルや日時が異なる）
  const dataMismatches: Array<{ db: Event; google: any }> = [];
  for (const dbEvent of dbEvents) {
    if (!dbEvent.google_event_id) continue;
    const googleEvent = googleEventMap.get(dbEvent.google_event_id);
    if (!googleEvent) continue;

    // 日時やタイトルの比較
    const dbDate = new Date(dbEvent.event_date).toISOString();
    const googleDate = new Date(googleEvent.eventDate).toISOString();

    if (dbEvent.title !== googleEvent.title || dbDate !== googleDate) {
      dataMismatches.push({ db: dbEvent, google: googleEvent });
    }
  }

  // 不整合を記録
  for (const event of missingInGoogle) {
    recordInconsistency({
      event_id: event.id,
      google_event_id: event.google_event_id,
      inconsistency_type: 'missing_in_google',
      details: event,
    });
  }

  for (const event of missingInDB) {
    if (!event || !event.googleEventId) continue;
    recordInconsistency({
      google_event_id: event.googleEventId,
      inconsistency_type: 'missing_in_db',
      details: event,
    });
  }

  for (const event of orphanEvents) {
    recordInconsistency({
      event_id: event.id,
      inconsistency_type: 'orphan',
      details: event,
    });
  }

  for (const mismatch of dataMismatches) {
    recordInconsistency({
      event_id: mismatch.db.id,
      google_event_id: mismatch.db.google_event_id,
      inconsistency_type: 'data_mismatch',
      details: mismatch,
    });
  }

  return {
    missingInGoogle,
    missingInDB,
    orphanEvents,
    dataMismatches,
  };
}

/**
 * DBからGoogleへの同期（孤立イベントの修復）
 */
export async function syncDBToGoogle(): Promise<{
  created: number;
  updated: number;
  errors: Array<{ event: Event; error: string }>;
}> {
  const orphanEvents = db.prepare(`
    SELECT * FROM events
    WHERE google_event_id IS NULL
      AND datetime(event_date) > datetime('now')
      AND status = 'open'
  `).all() as Event[];

  let created = 0;
  const errors: Array<{ event: Event; error: string }> = [];

  for (const event of orphanEvents) {
    const logId = createSyncLog({
      operationType: 'create',
      entityId: event.id,
      direction: 'db_to_google',
      dataSnapshot: event,
    });

    try {
      // Googleカレンダー用のタイトル生成
      const typeLabel = event.event_type === 'desert' ? '砂漠' : '狭間';
      const calendarTitle = `${event.title} (${typeLabel}${event.team})`;

      const result = await createCalendarEvent({
        title: calendarTitle,
        eventType: event.event_type,
        team: event.team,
        eventDate: event.event_date,
      });

      // DBを更新
      if (result.googleEventId) {
        db.prepare(`
          UPDATE events
          SET google_event_id = ?
          WHERE id = ?
        `).run(result.googleEventId, event.id);

        markSyncSuccess(logId, result.googleEventId);
        created++;
      } else {
        throw new Error('Google Event IDが取得できませんでした');
      }
    } catch (error: any) {
      markSyncFailed(logId, error.message);
      errors.push({ event, error: error.message });
    }
  }

  return { created, updated: 0, errors };
}

/**
 * GoogleからDBへの同期（既存機能を改善）
 */
export async function syncGoogleToDB(): Promise<{
  created: number;
  updated: number;
  errors: Array<{ google: any; error: string }>;
}> {
  const googleEvents = await fetchCalendarEvents();
  let created = 0;
  let updated = 0;
  const errors: Array<{ google: any; error: string }> = [];

  for (const googleEvent of googleEvents) {
    if (!googleEvent || !googleEvent.googleEventId) continue;

    try {
      const existing = db.prepare(`
        SELECT * FROM events WHERE google_event_id = ?
      `).get(googleEvent.googleEventId) as Event | undefined;

      if (!existing) {
        // 新規作成
        const logId = createSyncLog({
          operationType: 'create',
          googleEventId: googleEvent.googleEventId,
          direction: 'google_to_db',
          dataSnapshot: googleEvent,
        });

        const result = db.prepare(`
          INSERT INTO events (
            title, event_type, team, event_group, event_date,
            google_event_id, status, use_team_b
          ) VALUES (?, ?, ?, ?, ?, ?, 'open', 0)
        `).run(
          googleEvent.title,
          googleEvent.eventType,
          googleEvent.team,
          googleEvent.group,
          googleEvent.eventDate,
          googleEvent.googleEventId
        );

        markSyncSuccess(logId);
        created++;
      } else {
        // 更新
        const logId = createSyncLog({
          operationType: 'update',
          entityId: existing.id,
          googleEventId: googleEvent.googleEventId,
          direction: 'google_to_db',
          dataSnapshot: googleEvent,
        });

        db.prepare(`
          UPDATE events
          SET title = ?, event_date = ?, event_type = ?, team = ?, event_group = ?
          WHERE google_event_id = ?
        `).run(
          googleEvent.title,
          googleEvent.eventDate,
          googleEvent.eventType,
          googleEvent.team,
          googleEvent.group,
          googleEvent.googleEventId
        );

        markSyncSuccess(logId);
        updated++;
      }
    } catch (error: any) {
      errors.push({ google: googleEvent, error: error.message });
    }
  }

  return { created, updated, errors };
}

/**
 * 双方向同期の実行
 */
export async function performBidirectionalSync(): Promise<{
  googleToDB: { created: number; updated: number; errors: any[] };
  dbToGoogle: { created: number; updated: number; errors: any[] };
  inconsistencies: Awaited<ReturnType<typeof detectInconsistencies>>;
}> {
  // 1. Googleから DBへの同期
  const googleToDB = await syncGoogleToDB();

  // 2. DBから Googleへの同期
  const dbToGoogle = await syncDBToGoogle();

  // 3. 不整合の検出
  const inconsistencies = await detectInconsistencies();

  return {
    googleToDB,
    dbToGoogle,
    inconsistencies,
  };
}
