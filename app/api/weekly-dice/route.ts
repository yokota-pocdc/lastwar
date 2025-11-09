import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getWeeklyDice } from '@/lib/weekly-dice';
import { getEventWeek } from '@/lib/event-week';
import { getYear, getWeek } from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * 週単位のサイコロを取得
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventDate = searchParams.get('eventDate');
    const eventType = searchParams.get('eventType') as 'desert' | 'gap' | null;

    if (!eventDate) {
      return NextResponse.json({ error: 'eventDateが必要です' }, { status: 400 });
    }

    if (!eventType || (eventType !== 'desert' && eventType !== 'gap')) {
      return NextResponse.json({ error: 'eventTypeが必要です' }, { status: 400 });
    }

    // イベントが開催される週を取得（イベント日から計算）
    const eventWeek = getEventWeek(eventDate);
    const year = getYear(eventWeek.start);
    const week = getWeek(eventWeek.start, { weekStartsOn: 1 });

    const weeklyDice = getWeeklyDice(session.userId, year, week, eventType);

    return NextResponse.json({ weeklyDice });
  } catch (error) {
    console.error('Weekly dice fetch error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
