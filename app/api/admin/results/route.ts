import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// 抽選結果取得
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json({ error: 'イベントIDが必要です' }, { status: 400 });
    }

    const results = db.prepare(`
      SELECT
        a.*,
        COALESCE(u.name, '(削除されたユーザー)') as user_name,
        e.title as event_title
      FROM applications a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN events e ON a.event_id = e.id
      WHERE a.event_id = ?
      ORDER BY a.total_score DESC, a.created_at ASC
    `).all(eventId);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Results fetch error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
