import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';
import { deleteCalendarEvent, updateCalendarEvent } from '@/lib/google-calendar';
import { getWeek, getYear } from 'date-fns';

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

// イベント更新
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await request.json();
    const { title, event_type, event_date } = body;

    if (!title || !event_type || !event_date) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    // イベントタイプとチームを分離（例: "desert-a" -> type: "desert", team: "A"）
    const [type, teamLower] = event_type.split('-');
    const team = teamLower.toUpperCase();

    if (!['desert', 'gap'].includes(type) || !['A', 'B'].includes(team)) {
      return NextResponse.json({ error: '不正なイベントタイプです' }, { status: 400 });
    }

    // 週番号を計算してイベントグループを生成
    const eventDateTime = new Date(event_date);
    const year = getYear(eventDateTime);
    const week = getWeek(eventDateTime, { weekStartsOn: 1 });
    const baseGroup = type === 'desert' ? '砂漠' : '狭間';
    const eventGroup = `${baseGroup}-${year}W${week.toString().padStart(2, '0')}`;

    // 既存イベントを取得
    const existingEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(params.id) as any;

    if (!existingEvent) {
      return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
    }

    // Googleカレンダーを更新
    if (existingEvent.google_event_id) {
      try {
        await updateCalendarEvent({
          googleEventId: existingEvent.google_event_id,
          title,
          eventType: type as 'desert' | 'gap',
          team: team as 'A' | 'B',
          eventDate: event_date,
        });
      } catch (error) {
        console.error('Failed to update Google Calendar event:', error);
        // Googleカレンダーの更新に失敗してもDBは更新する
      }
    }

    // データベースを更新
    db.prepare(`
      UPDATE events
      SET title = ?, event_type = ?, team = ?, event_date = ?, event_group = ?
      WHERE id = ?
    `).run(title, type, team, event_date, eventGroup, params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Event update error:', error);
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

    // イベント情報を取得（Googleカレンダー削除用）
    const event = db.prepare('SELECT google_event_id FROM events WHERE id = ?').get(params.id) as { google_event_id?: string } | undefined;

    // Googleカレンダーから削除
    if (event?.google_event_id) {
      try {
        await deleteCalendarEvent(event.google_event_id);
        console.log(`Deleted event from Google Calendar: ${event.google_event_id}`);
      } catch (error) {
        console.error('Failed to delete from Google Calendar:', error);
        // Googleカレンダーの削除に失敗してもDBからは削除する
      }
    }

    // データベースから削除
    db.prepare('DELETE FROM events WHERE id = ?').run(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Event deletion error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
