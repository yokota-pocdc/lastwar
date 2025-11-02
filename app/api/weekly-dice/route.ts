import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getWeeklyDiceByEventDate } from '@/lib/weekly-dice';

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

    if (!eventDate) {
      return NextResponse.json({ error: 'eventDateが必要です' }, { status: 400 });
    }

    const weeklyDice = getWeeklyDiceByEventDate(session.userId, eventDate);

    return NextResponse.json({ weeklyDice });
  } catch (error) {
    console.error('Weekly dice fetch error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
