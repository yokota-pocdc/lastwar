import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// イベント一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM形式

    let query = 'SELECT * FROM events';
    let params: any[] = [];

    if (month) {
      query += ' WHERE strftime("%Y-%m", event_date) = ?';
      params.push(month);
    }

    query += ' ORDER BY event_date ASC';

    const events = db.prepare(query).all(...params);

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Events fetch error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// イベント作成（管理者機能）
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const data = await request.json();
    const { title, event_type, event_date, use_team_b } = data;

    if (!title || !event_type || !event_date) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO events (title, event_type, event_date, use_team_b)
      VALUES (?, ?, ?, ?)
    `).run(title, event_type, event_date, use_team_b ? 1 : 0);

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('Event creation error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
