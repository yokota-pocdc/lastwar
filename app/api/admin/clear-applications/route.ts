import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// すべてのデータを削除（試験用）
export async function POST(request: NextRequest) {
  try {
    // すべてのデータを削除（Googleカレンダーから再同期可能）
    const transaction = db.transaction(() => {
      // すべての申し込みデータを削除
      db.prepare('DELETE FROM applications').run();

      // すべての週単位サイコロ履歴を削除
      db.prepare('DELETE FROM user_dice_weekly').run();

      // すべてのユーザー情報を削除
      db.prepare('DELETE FROM users').run();

      // すべてのイベントデータを削除
      db.prepare('DELETE FROM events').run();
    });

    transaction();

    // セッションcookieを削除
    const cookieStore = await cookies();
    cookieStore.delete('lastwar_lottery_session');

    return NextResponse.json({
      success: true,
      message: 'すべてのデータを削除しました（申し込み、ユーザー、サイコロ履歴、イベント）'
    });
  } catch (error) {
    console.error('Clear applications error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
