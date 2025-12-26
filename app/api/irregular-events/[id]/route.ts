import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';
import { calculateRankings } from '@/lib/irregular-lottery';
import { createIrregularCalendarEvent, updateIrregularCalendarEvent, deleteCalendarEvent } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

interface IrregularEvent {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  deadline: string;
  google_event_id: string | null;
  status: string;
  created_at: string;
}

// 不定期イベント詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = parseInt(id);

    const event = db.prepare(`
      SELECT * FROM irregular_events WHERE id = ?
    `).get(eventId) as IrregularEvent | undefined;

    if (!event) {
      return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
    }

    // 参加者数を取得
    const participantsCount = db.prepare(`
      SELECT COUNT(*) as count FROM irregular_applications WHERE event_id = ?
    `).get(eventId) as { count: number };

    // 参加者一覧を取得（ランキング付き）
    const applications = db.prepare(`
      SELECT ia.*, COALESCE(u.name, '(不明)') as user_name
      FROM irregular_applications ia
      LEFT JOIN users u ON ia.user_id = u.id
      WHERE ia.event_id = ?
      ORDER BY ia.created_at ASC
    `).all(eventId) as any[];

    // ランキングを計算
    const rankedApplications = calculateRankings(applications);

    return NextResponse.json({
      event,
      participantsCount: participantsCount.count,
      applications: rankedApplications
    });
  } catch (error) {
    console.error('Irregular event detail fetch error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// 不定期イベント更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id } = await params;
    const eventId = parseInt(id);
    const data = await request.json();
    const { title, description, event_date, deadline, status } = data;

    // イベントの存在確認
    const existing = db.prepare(`
      SELECT * FROM irregular_events WHERE id = ?
    `).get(eventId) as IrregularEvent | undefined;

    if (!existing) {
      return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
    }

    // 締切日がイベント日より後でないことを確認
    if (deadline && event_date && new Date(deadline) > new Date(event_date)) {
      return NextResponse.json({ error: '締切日はイベント開始日より前に設定してください' }, { status: 400 });
    }

    // Googleカレンダーの更新または作成
    let calendarSynced = false;
    let newGoogleEventId: string | null = null;

    if (existing.google_event_id) {
      // 既存のカレンダーイベントを更新
      try {
        await updateIrregularCalendarEvent({
          googleEventId: existing.google_event_id,
          title: title || existing.title,
          eventDate: event_date || existing.event_date,
          deadline: deadline || existing.deadline,
          description: description !== undefined ? description : existing.description || undefined,
        });
        calendarSynced = true;
      } catch (calendarError) {
        console.error('Failed to update Google Calendar event:', calendarError);
        // カレンダー同期エラーでも更新は続行
      }
    } else {
      // Googleカレンダーに新規作成
      try {
        const calendarResult = await createIrregularCalendarEvent({
          title: title || existing.title,
          eventDate: event_date || existing.event_date,
          deadline: deadline || existing.deadline,
          description: description !== undefined ? description : existing.description || undefined,
        });
        newGoogleEventId = calendarResult.googleEventId || null;
        calendarSynced = true;
      } catch (calendarError) {
        console.error('Failed to create Google Calendar event:', calendarError);
        // カレンダー同期エラーでも更新は続行
      }
    }

    db.prepare(`
      UPDATE irregular_events
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          event_date = COALESCE(?, event_date),
          deadline = COALESCE(?, deadline),
          google_event_id = COALESCE(?, google_event_id),
          status = COALESCE(?, status)
      WHERE id = ?
    `).run(
      title || null,
      description !== undefined ? description : null,
      event_date || null,
      deadline || null,
      newGoogleEventId,
      status || null,
      eventId
    );

    const event = db.prepare('SELECT * FROM irregular_events WHERE id = ?').get(eventId);

    return NextResponse.json({
      success: true,
      event,
      calendarSynced
    });
  } catch (error) {
    console.error('Irregular event update error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// 不定期イベント削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id } = await params;
    const eventId = parseInt(id);

    // イベントの存在確認
    const existing = db.prepare(`
      SELECT * FROM irregular_events WHERE id = ?
    `).get(eventId) as IrregularEvent | undefined;

    if (!existing) {
      return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
    }

    // Googleカレンダーからイベントを削除
    let calendarDeleted = false;
    if (existing.google_event_id) {
      try {
        await deleteCalendarEvent(existing.google_event_id);
        calendarDeleted = true;
      } catch (calendarError) {
        console.error('Failed to delete Google Calendar event:', calendarError);
        // カレンダー同期エラーでも削除は続行
      }
    }

    // 参加申込があるかチェック
    const applicationsCount = db.prepare(`
      SELECT COUNT(*) as count FROM irregular_applications WHERE event_id = ?
    `).get(eventId) as { count: number };

    // 参加申込を削除
    db.prepare('DELETE FROM irregular_applications WHERE event_id = ?').run(eventId);

    // イベントを削除
    db.prepare('DELETE FROM irregular_events WHERE id = ?').run(eventId);

    return NextResponse.json({
      success: true,
      deletedApplicationsCount: applicationsCount.count,
      calendarDeleted
    });
  } catch (error) {
    console.error('Irregular event delete error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
