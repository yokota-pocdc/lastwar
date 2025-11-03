import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// 現在のユーザーの申し込みデータを取得
export async function GET() {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ applications: [], eventIds: [] });
    }

    const applications = db.prepare(`
      SELECT id, event_id, result_status, result_team, total_score, created_at
      FROM applications
      WHERE user_id = ?
    `).all(session.userId) as Array<{
      id: number;
      event_id: number;
      result_status: string | null;
      result_team: string | null;
      total_score: number;
      created_at: string;
    }>;

    const eventIds = applications.map(app => app.event_id);

    return NextResponse.json({ applications, eventIds });
  } catch (error) {
    console.error('Failed to fetch user applications:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
