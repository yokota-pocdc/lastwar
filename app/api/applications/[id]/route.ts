import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';
import { updateRealtimeRankings } from '@/lib/realtime-lottery';
import { refundTicket } from '@/lib/tickets';
import { deleteWeeklyDice } from '@/lib/weekly-dice';
import { getEventWeek } from '@/lib/event-week';
import { getYear, getWeek } from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * 申し込みの取り消し
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const applicationId = parseInt(params.id);

    // 申込情報を取得して、自分の申込かチェック
    const application = db.prepare(`
      SELECT a.*, e.event_date, e.event_type, e.lottery_executed
      FROM applications a
      JOIN events e ON a.event_id = e.id
      WHERE a.id = ?
    `).get(applicationId) as any;

    if (!application) {
      return NextResponse.json({ error: '申込が見つかりません' }, { status: 404 });
    }

    if (application.user_id !== session.userId) {
      return NextResponse.json({ error: '他人の申込は削除できません' }, { status: 403 });
    }

    // 抽選実行済みの場合は削除不可
    if (application.lottery_executed) {
      return NextResponse.json(
        { error: '抽選実行後の申し込みは取り消しできません' },
        { status: 400 }
      );
    }

    // チケットを使用していた場合は返却
    if (application.used_ticket) {
      refundTicket(session.userId);
    }

    // イベント週の情報を取得して、週別サイコロ記録を削除
    const eventWeek = getEventWeek(application.event_date);
    const year = getYear(eventWeek.start);
    const week = getWeek(eventWeek.start, { weekStartsOn: 1 });
    deleteWeeklyDice(session.userId, year, week, application.event_type);

    // 申し込みを削除
    db.prepare('DELETE FROM applications WHERE id = ?').run(applicationId);

    // リアルタイムランキングを更新
    updateRealtimeRankings(application.event_id);

    return NextResponse.json({
      success: true,
      message: '申し込みを取り消しました',
    });
  } catch (error) {
    console.error('Application deletion error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
