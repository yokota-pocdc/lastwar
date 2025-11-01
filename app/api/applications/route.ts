import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';
import { rollDice, calculateTotalScore } from '@/lib/lottery';
import { getRemainingTickets, useTicket } from '@/lib/tickets';

export const dynamic = 'force-dynamic';

// 申込作成
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { eventId, useTicket: wantsTicket, preferredTeam } = await request.json();

    // イベント存在確認
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
    if (!event) {
      return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
    }

    if (event.status !== 'open') {
      return NextResponse.json({ error: 'このイベントは受付終了しています' }, { status: 400 });
    }

    // 既に申込済みか確認
    const existing = db.prepare(
      'SELECT * FROM applications WHERE event_id = ? AND user_id = ?'
    ).get(eventId, session.userId);

    if (existing) {
      return NextResponse.json({ error: '既に申込済みです' }, { status: 400 });
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
      preferredTeam || 'any'
    );

    const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(result.lastInsertRowid);

    return NextResponse.json({ success: true, application });
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
