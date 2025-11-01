import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getRemainingTickets } from '@/lib/tickets';

export const dynamic = 'force-dynamic';

// チケット残数取得
export async function GET() {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const remaining = getRemainingTickets(session.userId);

    return NextResponse.json({ tickets: remaining });
  } catch (error) {
    console.error('Tickets fetch error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
