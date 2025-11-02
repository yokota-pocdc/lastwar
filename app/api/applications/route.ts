import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';
import { rollDice, calculateTotalScore } from '@/lib/lottery';
import { getRemainingTickets, useTicket } from '@/lib/tickets';
import { updateRealtimeRankings, getUserRanking } from '@/lib/realtime-lottery';
import { autoUpdateEventStatus, isEventOpen } from '@/lib/auto-lottery';

export const dynamic = 'force-dynamic';

// 申込作成
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { eventId, useTicket: wantsTicket } = await request.json();

    // 申込前に自動更新処理を実行
    autoUpdateEventStatus();

    // イベント存在確認
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
    if (!event) {
      return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
    }

    // 締め切り時刻チェック
    if (!isEventOpen(event.event_date, event.event_type, event.status, event.lottery_executed)) {
      const deadlineInfo = event.event_type === 'desert' ? '水曜日11:00' : '月曜日11:00';
      return NextResponse.json({
        error: `このイベントは受付終了しています（締切: ${deadlineInfo}）`
      }, { status: 400 });
    }

    // 既に申込済みか確認
    const existing = db.prepare(
      'SELECT * FROM applications WHERE event_id = ? AND user_id = ?'
    ).get(eventId, session.userId);

    if (existing) {
      return NextResponse.json({ error: '既に申込済みです' }, { status: 400 });
    }

    // 同じグループの別チームに申込済みか確認（相互排他）
    if (event.event_group) {
      const conflictingApplication = db.prepare(`
        SELECT a.*, e.team, e.event_group, e.title
        FROM applications a
        JOIN events e ON a.event_id = e.id
        WHERE a.user_id = ?
          AND e.event_group = ?
          AND e.team != ?
      `).get(session.userId, event.event_group, event.team) as any;

      if (conflictingApplication) {
        return NextResponse.json({
          error: `${event.event_group}のチーム${conflictingApplication.team}に既に申込済みです。同じグループのA/B両方には申し込めません。`
        }, { status: 400 });
      }
    }

    // サイコロを振る
    const { dice1, dice2, score: diceScore, isDoubles } = rollDice();

    // チケット処理
    let usedTicket = false;
    if (wantsTicket) {
      usedTicket = useTicket(session.userId);
      if (!usedTicket) {
        return NextResponse.json({ error: 'チケットが不足しています' }, { status: 400 });
      }
    }

    const totalScore = calculateTotalScore(diceScore, usedTicket);

    // 申込作成
    const result = db.prepare(`
      INSERT INTO applications (
        event_id, user_id, dice1, dice2, is_doubles, dice_score,
        used_ticket, total_score, preferred_team
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      session.userId,
      dice1,
      dice2,
      isDoubles ? 1 : 0,
      diceScore,
      usedTicket ? 1 : 0,
      totalScore,
      event.team
    );

    // リアルタイム順位を計算して全員のステータスを更新
    updateRealtimeRankings(eventId);

    // 更新された申込情報を取得
    const updatedApplication = db.prepare('SELECT * FROM applications WHERE id = ?').get(result.lastInsertRowid);

    // 現在の順位情報を取得
    const ranking = getUserRanking(eventId, session.userId);

    return NextResponse.json({
      success: true,
      application: updatedApplication,
      ranking: ranking
    });
  } catch (error) {
    console.error('Application creation error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// 自分の申込一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (eventId) {
      const application = db.prepare(`
        SELECT a.*, e.title, e.event_date, e.event_type
        FROM applications a
        JOIN events e ON a.event_id = e.id
        WHERE a.event_id = ? AND a.user_id = ?
      `).get(eventId, session.userId);

      return NextResponse.json({ application });
    }

    const applications = db.prepare(`
      SELECT a.*, e.title, e.event_date, e.event_type
      FROM applications a
      JOIN events e ON a.event_id = e.id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
    `).all(session.userId);

    return NextResponse.json({ applications });
  } catch (error) {
    console.error('Applications fetch error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
