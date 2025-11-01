import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';
import { syncCalendarEvents } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

// Googleカレンダーと同期
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    // 同期実行
    const events = await syncCalendarEvents(db);

    return NextResponse.json({
      success: true,
      syncedCount: events.length,
      events,
    });
  } catch (error) {
    console.error('Calendar sync error:', error);
    return NextResponse.json(
      { error: 'カレンダー同期に失敗しました' },
      { status: 500 }
    );
  }
}

// 同期ステータスを取得
export async function GET(request: NextRequest) {
  try {
    const events = db.prepare(`
      SELECT id, title, event_type, event_date, team, event_group, status
      FROM events
      WHERE google_event_id IS NOT NULL
      ORDER BY event_date ASC
    `).all();

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Failed to get sync status:', error);
    return NextResponse.json({ error: 'エラー' }, { status: 500 });
  }
}
