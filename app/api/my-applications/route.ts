import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// 現在のユーザーの申し込み済みイベントIDリストを取得
export async function GET() {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ eventIds: [] });
    }

    const applications = db.prepare(`
      SELECT DISTINCT event_id
      FROM applications
      WHERE user_id = ?
    `).all(session.userId) as { event_id: number }[];

    const eventIds = applications.map(app => app.event_id);

    return NextResponse.json({ eventIds });
  } catch (error) {
    console.error('Failed to fetch user applications:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
