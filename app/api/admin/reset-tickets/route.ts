import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// 全ユーザーのチケットを2枚にリセット
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    // 全ユーザーのチケットを2枚にリセット
    const result = db.prepare(`
      UPDATE users
      SET tickets_remaining = 2
    `).run();

    return NextResponse.json({
      success: true,
      message: `全ユーザーのチケットを2枚にリセットしました`,
      affectedUsers: result.changes
    });
  } catch (error) {
    console.error('Ticket reset error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
