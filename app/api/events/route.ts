import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';
import { createCalendarEvent, parseEventType } from '@/lib/google-calendar';

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
    const { title, event_date } = data;

    if (!title || !event_date) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    // タイトルからイベントタイプを自動判定
    const parsed = parseEventType(title);
    if (!parsed.type || !parsed.team || !parsed.group) {
      return NextResponse.json({
        error: 'タイトルに「砂漠A」「砂漠B」「狭間A」「狭間B」のいずれかを含めてください'
      }, { status: 400 });
    }

    // Googleカレンダーにイベントを作成
    let googleEventId = null;
    let googleHtmlLink = null;
    try {
      const gcalResult = await createCalendarEvent({
        title,
        eventType: parsed.type,
        team: parsed.team,
        eventDate: event_date,
      });
      googleEventId = gcalResult.googleEventId;
      googleHtmlLink = gcalResult.htmlLink;
    } catch (gcalError) {
      console.error('Google Calendar creation failed, proceeding with local event:', gcalError);
      // Googleカレンダー作成失敗してもローカルイベントは作成する
    }

    // ローカルDBにイベントを作成
    const result = db.prepare(`
      INSERT INTO events (
        title, event_type, team, event_group, event_date,
        google_event_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'open')
    `).run(title, parsed.type, parsed.team, parsed.group, event_date, googleEventId);

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);

    return NextResponse.json({
      success: true,
      event,
      googleCalendarLink: googleHtmlLink
    });
  } catch (error) {
    console.error('Event creation error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
