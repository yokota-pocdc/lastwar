import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// イベント詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(params.id);

    if (!event) {
      return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
    }

    // 申込者数を取得
    const applications = db.prepare(`
      SELECT COUNT(*) as count FROM applications WHERE event_id = ?
    `).get(params.id) as { count: number };

    return NextResponse.json({
      event,
      applicationsCount: applications.count
    });
  } catch (error) {
    console.error('Event fetch error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// イベント削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    // 申込がある場合は削除不可
    const applications = db.prepare(
      'SELECT COUNT(*) as count FROM applications WHERE event_id = ?'
    ).get(params.id) as { count: number };

    if (applications.count > 0) {
      return NextResponse.json({
        error: '申込者がいるため削除できません'
      }, { status: 400 });
    }

    db.prepare('DELETE FROM events WHERE id = ?').run(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Event deletion error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
