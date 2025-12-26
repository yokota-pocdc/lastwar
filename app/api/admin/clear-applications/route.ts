import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// すべてのデータを削除（試験用）
export async function POST(request: NextRequest) {
  try {
    // すべてのデータを削除
    const transaction = db.transaction(() => {
      // 不定期イベント参加データを削除
      db.prepare('DELETE FROM irregular_applications').run();

      // 不定期イベントを削除
      db.prepare('DELETE FROM irregular_events').run();

      // ユーザー情報を削除
      db.prepare('DELETE FROM users').run();
    });

    transaction();

    // セッションcookieを削除
    const cookieStore = await cookies();
    cookieStore.delete('jfkh_event_session');

    return NextResponse.json({
      success: true,
      message: 'すべてのデータを削除しました'
    });
  } catch (error) {
    console.error('Clear applications error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
