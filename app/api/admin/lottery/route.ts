import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';
import { executeLottery, Application } from '@/lib/lottery';

export const dynamic = 'force-dynamic';

// 抽選実行
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { eventId } = await request.json();

    // イベント取得
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
    if (!event) {
      return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
    }

    if (event.lottery_executed) {
      return NextResponse.json({ error: '既に抽選実行済みです' }, { status: 400 });
    }

    // 申込一覧取得
    const applications = db.prepare(`
      SELECT id, user_id, total_score, created_at, preferred_team,
             allow_alternative_if_rejected, allow_alternative_if_candidate
      FROM applications
      WHERE event_id = ?
    `).all(eventId) as Application[];

    if (applications.length === 0) {
      return NextResponse.json({ error: '申込者がいません' }, { status: 400 });
    }

    // 抽選実行
    const results = executeLottery(
      applications,
      event.team_a_capacity,
      event.team_b_capacity,
      event.team_a_participants,
      event.team_b_participants,
      event.use_team_b === 1
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
        UPDATE events
        SET lottery_executed = 1, status = 'closed'
        WHERE id = ?
      `).run(eventId);
    });

    transaction();

    // 結果を取得して返す
    const finalResults = db.prepare(`
      SELECT a.*, u.name as user_name
      FROM applications a
      JOIN users u ON a.user_id = u.id
      WHERE a.event_id = ?
      ORDER BY a.total_score DESC, a.created_at ASC
    `).all(eventId);

    return NextResponse.json({
      success: true,
      results: finalResults
    });
  } catch (error) {
    console.error('Lottery execution error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
