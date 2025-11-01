import db from './db';
import { executeLottery, Application } from './lottery';

/**
 * イベントの締め切り日時を計算（開始日時の前日0時）
 */
export function getDeadline(eventDate: string): Date {
  const eventDateTime = new Date(eventDate);
  const deadline = new Date(eventDateTime);
  deadline.setDate(deadline.getDate() - 1); // 前日
  deadline.setHours(0, 0, 0, 0); // 0時に設定
  return deadline;
}

/**
 * イベントのステータスを自動更新し、必要に応じて抽選を実行
 */
export function autoUpdateEventStatus(): void {
  const now = new Date();

  // 締め切り時刻を過ぎた、openのイベントを取得
  const openEvents = db.prepare(`
    SELECT * FROM events WHERE status = 'open'
  `).all() as any[];

  for (const event of openEvents) {
    const deadline = getDeadline(event.event_date);

    // 締め切り時刻を過ぎている場合
    if (now >= deadline) {
      console.log(`イベント "${event.title}" (ID: ${event.id}) が締め切り時刻を過ぎました`);

      // ステータスをclosedに変更
      db.prepare(`
        UPDATE events SET status = 'closed' WHERE id = ?
      `).run(event.id);

      // 未抽選の場合は抽選を実行
      if (!event.lottery_executed) {
        try {
          autoExecuteLottery(event.id);
          console.log(`イベント "${event.title}" (ID: ${event.id}) の抽選を自動実行しました`);
        } catch (error) {
          console.error(`イベント "${event.title}" (ID: ${event.id}) の抽選実行に失敗:`, error);
        }
      }
    }
  }
}

/**
 * 指定されたイベントIDの抽選を自動実行
 */
function autoExecuteLottery(eventId: number): void {
  // イベント取得
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
  if (!event) {
    throw new Error('イベントが見つかりません');
  }

  if (event.lottery_executed) {
    throw new Error('既に抽選実行済みです');
  }

  // 申込一覧取得
  const applications = db.prepare(`
    SELECT id, user_id, total_score, created_at, preferred_team
    FROM applications
    WHERE event_id = ?
  `).all(eventId) as Application[];

  if (applications.length === 0) {
    console.log(`イベント "${event.title}" (ID: ${eventId}) には申込者がいません`);
    // 申込者がいない場合も抽選済みにマーク
    db.prepare(`
      UPDATE events SET lottery_executed = 1 WHERE id = ?
    `).run(eventId);
    return;
  }

  // 抽選実行
  const results = executeLottery(
    applications,
    event.capacity || 30,        // デフォルト30人
    event.capacity || 30,
    event.participants_limit || 20,  // デフォルト20人
    event.participants_limit || 20,
    true  // 常に2チーム編成
  );

  // 結果を保存
  const updateStmt = db.prepare(`
    UPDATE applications
    SET result_team = ?, result_status = ?
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    for (const result of results) {
      updateStmt.run(result.resultTeam, result.resultStatus, result.applicationId);
    }

    // イベントを抽選済みに
    db.prepare(`
      UPDATE events SET lottery_executed = 1 WHERE id = ?
    `).run(eventId);
  });

  transaction();
}

/**
 * イベントが申込可能かどうかをチェック
 */
export function isEventOpen(eventDate: string, status: string, lotteryExecuted: boolean): boolean {
  if (status !== 'open' || lotteryExecuted) {
    return false;
  }

  const now = new Date();
  const deadline = getDeadline(eventDate);

  return now < deadline;
}
