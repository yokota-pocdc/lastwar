import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// イベントカレンダー以外のデータ（申し込みデータ）を削除
export async function POST(request: NextRequest) {
  try {
    // すべての申し込みデータを削除し、イベントの抽選状態とチケットをリセット
    const transaction = db.transaction(() => {
      // すべての申し込みデータを削除
      db.prepare('DELETE FROM applications').run();

      // すべてのイベントの抽選フラグをリセット
      db.prepare(`
        UPDATE events
        SET lottery_executed = 0
      `).run();

      // すべてのユーザーのチケット残数を2枚にリセット
      db.prepare(`
        UPDATE users
        SET tickets_remaining = 2
      `).run();
    });

    transaction();

    return NextResponse.json({
      success: true,
      message: 'すべての申し込みデータを削除しました'
    });
  } catch (error) {
    console.error('Clear applications error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
