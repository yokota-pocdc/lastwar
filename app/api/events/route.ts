import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';
import { createCalendarEvent, parseEventType } from '@/lib/google-calendar';
import { getWeek, getYear } from 'date-fns';
import { autoUpdateEventStatus } from '@/lib/auto-lottery';

export const dynamic = 'force-dynamic';

// イベント一覧取得
export async function GET(request: NextRequest) {
  try {
    // イベント取得前に自動更新処理を実行
    autoUpdateEventStatus();

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
    const { title, event_type, event_date } = data;

    if (!title || !event_type || !event_date) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    // 非定期イベントの場合
    if (event_type === 'irregular') {
      // イベントグループ名を生成
      const date = new Date(event_date);
      const year = getYear(date);
      const week = getWeek(date, { weekStartsOn: 1 }); // 月曜始まり
      const eventGroup = `不定期-${year}W${week.toString().padStart(2, '0')}`;

      // Google Calendar用のタイトル
      const calendarTitle = `${title} (不定期)`;

      // Googleカレンダーにイベントを作成
      let googleEventId = null;
      let googleHtmlLink = null;
      try {
        const gcalResult = await createCalendarEvent({
          title: calendarTitle,
          eventType: 'irregular',
          team: null,
          eventDate: event_date,
        });
        googleEventId = gcalResult.googleEventId;
        googleHtmlLink = gcalResult.htmlLink;
      } catch (gcalError) {
        console.error('Google Calendar creation failed, proceeding with local event:', gcalError);
      }

      // ローカルDBにイベントを作成（非定期イベントはteam=null, capacity/participants_limit=null）
      const result = db.prepare(`
        INSERT INTO events (
          title, event_type, team, event_group, event_date,
          google_event_id, status, capacity, participants_limit
        ) VALUES (?, 'irregular', NULL, ?, ?, ?, 'open', NULL, NULL)
      `).run(title, eventGroup, event_date, googleEventId);

      const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);

      return NextResponse.json({
        success: true,
        event,
        googleCalendarLink: googleHtmlLink
      });
    }

    // 定期イベント（砂漠/狭間）の場合
    // event_type から type と team を分離
    // 例: 'desert-a' -> type='desert', team='A'
    const [baseType, teamLetter] = event_type.split('-');
    const type = baseType as 'desert' | 'gap';
    const team = teamLetter.toUpperCase() as 'A' | 'B';

    if (!['desert', 'gap'].includes(type) || !['A', 'B'].includes(team)) {
      return NextResponse.json({
        error: '不正なイベント種別です'
      }, { status: 400 });
    }

    // イベントグループ名を生成（週番号を含む）
    // 例: "砂漠-2025W01"
    const date = new Date(event_date);
    const year = getYear(date);
    const week = getWeek(date, { weekStartsOn: 1 }); // 月曜始まり
    const baseGroup = type === 'desert' ? '砂漠' : '狭間';
    const eventGroup = `${baseGroup}-${year}W${week.toString().padStart(2, '0')}`;

    // Google Calendar用のタイトルを生成
    // 例: "第1回 (砂漠A)"
    const typeLabel = type === 'desert' ? '砂漠' : '狭間';
    const calendarTitle = `${title} (${typeLabel}${team})`;

    // Googleカレンダーにイベントを作成
    let googleEventId = null;
    let googleHtmlLink = null;
    try {
      const gcalResult = await createCalendarEvent({
        title: calendarTitle,
        eventType: type,
        team: team,
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
    `).run(title, type, team, eventGroup, event_date, googleEventId);

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
