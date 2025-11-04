import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * 試験用：イベントカレンダー以外のデータを削除
 * 削除対象：
 * - applications（申し込みデータ）
 * - user_dice_weekly（週次サイコロデータ）
 * - sync_logs（同期ログ）
 * - sync_inconsistencies（不整合データ）
 *
 * 保持対象：
 * - events（イベントカレンダー）
 * - users（ユーザー）
 */
export async function POST() {
  try {
    const session = await getSession();

    // 管理者チェック（セッションに管理者フラグがある場合）
    // ここでは簡易的にログイン済みであればOKとする
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    // トランザクションで削除
    const transaction = db.transaction(() => {
      // 申し込みデータを削除
      const applicationsDeleted = db.prepare('DELETE FROM applications').run();

      // 週次サイコロデータを削除
      const weeklyDiceDeleted = db.prepare('DELETE FROM user_dice_weekly').run();

      // 同期ログを削除
      const syncLogsDeleted = db.prepare('DELETE FROM sync_logs').run();

      // 不整合データを削除
      const inconsistenciesDeleted = db.prepare('DELETE FROM sync_inconsistencies').run();

      return {
        applications: applicationsDeleted.changes,
        weeklyDice: weeklyDiceDeleted.changes,
        syncLogs: syncLogsDeleted.changes,
        inconsistencies: inconsistenciesDeleted.changes,
      };
    });

    const result = transaction();

    console.log('データクリアを実行:', result);

    return NextResponse.json({
      success: true,
      message: 'データを削除しました',
      deleted: result,
    });
  } catch (error) {
    console.error('データ削除エラー:', error);
    return NextResponse.json(
      { error: 'データの削除に失敗しました' },
      { status: 500 }
    );
  }
}
