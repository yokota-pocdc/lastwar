import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// イベントカレンダー以外のデータ（申し込み、ユーザー、サイコロ履歴）を削除
export async function POST(request: NextRequest) {
  try {
    // すべてのデータを削除し、イベントの抽選状態をリセット
    const transaction = db.transaction(() => {
      // すべての申し込みデータを削除
      db.prepare('DELETE FROM applications').run();

      // すべての週単位サイコロ履歴を削除
      db.prepare('DELETE FROM user_dice_weekly').run();

      // すべてのユーザー情報を削除
      db.prepare('DELETE FROM users').run();

      // すべてのイベントの抽選フラグをリセット
      db.prepare(`
        UPDATE events
        SET lottery_executed = 0
      `).run();
    });

    transaction();

    return NextResponse.json({
      success: true,
      message: 'すべてのユーザーデータを削除しました（申し込み、ユーザー、サイコロ履歴）'
    });
  } catch (error) {
    console.error('Clear applications error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
