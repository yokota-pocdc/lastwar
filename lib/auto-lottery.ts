import db from './db';
import { executeLottery, Application } from './lottery';
import { startOfWeek, addDays } from 'date-fns';

/**
 * イベントの締め切り日時を計算
 * - 砂漠: 日曜日 20:59:59
 * - 狭間: 火曜日 20:59:59
 * イベントが属する週の締切日時
 */
export function getDeadline(eventDate: string, eventType: 'desert' | 'gap'): Date {
  const eventDateTime = new Date(eventDate);

  // イベントが属する週の月曜日0時を取得
  const weekStart = startOfWeek(eventDateTime, { weekStartsOn: 1 }); // 月曜始まり

  if (eventType === 'gap') {
    // 狭間: 火曜日 20:59:59（月曜 + 1日）
    const deadline = addDays(weekStart, 1);
    deadline.setHours(20, 59, 59, 999);
    return deadline;
  } else {
    // 砂漠: 日曜日 20:59:59（月曜 + 6日 = 次の日曜）
    const deadline = addDays(weekStart, 6);
    deadline.setHours(20, 59, 59, 999);
    return deadline;
  }
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
    const deadline = getDeadline(event.event_date, event.event_type);

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
  // 参加者20名 + 候補者10名 = 合計30名
  const totalCapacity = 30;      // 総枠（参加者+候補者）
  const participantsOnly = 20;   // 参加者枠のみ

  const results = executeLottery(
    applications,
    totalCapacity,           // チームA総枠: 30名
    totalCapacity,           // チームB総枠: 30名
    participantsOnly,        // チームA参加者: 20名（残り10名は候補者）
    participantsOnly,        // チームB参加者: 20名（残り10名は候補者）
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
export function isEventOpen(eventDate: string, eventType: 'desert' | 'gap', status: string, lotteryExecuted: boolean): boolean {
  if (status !== 'open' || lotteryExecuted) {
    return false;
  }

  const now = new Date();
  const deadline = getDeadline(eventDate, eventType);

  return now < deadline;
}
