import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

interface IrregularEvent {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  deadline: string;
  status: string;
  created_at: string;
  participants_count?: number;
}

// 不定期イベント一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'open', 'closed', 'finished' or null for all
    const includeParticipants = searchParams.get('includeParticipants') === 'true';

    let query = 'SELECT * FROM irregular_events';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY event_date ASC';

    const events = db.prepare(query).all(...params) as IrregularEvent[];

    // 参加者数を含める場合
    if (includeParticipants) {
      for (const event of events) {
        const count = db.prepare(`
          SELECT COUNT(*) as count FROM irregular_applications WHERE event_id = ?
        `).get(event.id) as { count: number };
        event.participants_count = count.count;
      }
    }

    // 締切日を過ぎているがstatusがopenのイベントをclosedに更新
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE irregular_events
      SET status = 'closed'
      WHERE status = 'open' AND datetime(deadline) < datetime(?)
    `).run(now);

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Irregular events fetch error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// 不定期イベント作成（管理者機能）
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const data = await request.json();
    const { title, description, event_date, deadline } = data;

    if (!title || !event_date || !deadline) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    // 締切日がイベント日より後でないことを確認
    if (new Date(deadline) > new Date(event_date)) {
      return NextResponse.json({ error: '締切日はイベント開始日より前に設定してください' }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO irregular_events (title, description, event_date, deadline, status)
      VALUES (?, ?, ?, ?, 'open')
    `).run(title, description || null, event_date, deadline);

    const event = db.prepare('SELECT * FROM irregular_events WHERE id = ?').get(result.lastInsertRowid);

    return NextResponse.json({
      success: true,
      event
    });
  } catch (error) {
    console.error('Irregular event creation error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
