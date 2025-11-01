import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';
import { rollDice, calculateTotalScore } from '@/lib/lottery';

export const dynamic = 'force-dynamic';

// サイコロ振り直し
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const application = db.prepare(`
      SELECT * FROM applications WHERE id = ? AND user_id = ?
    `).get(params.id, session.userId) as any;

    if (!application) {
      return NextResponse.json({ error: '申込が見つかりません' }, { status: 404 });
    }

    if (application.rerolled) {
      return NextResponse.json({ error: '既に振り直し済みです' }, { status: 400 });
    }

    // イベントが受付中か確認
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(application.event_id) as any;
    if (event.status !== 'open') {
      return NextResponse.json({ error: '受付終了後は振り直しできません' }, { status: 400 });
    }

    // 新しいサイコロを振る
    const { dice1: newDice1, dice2: newDice2, score: newDiceScore, isDoubles: newIsDoubles } = rollDice();
    const newTotalScore = calculateTotalScore(newDiceScore, application.used_ticket === 1);

    // より高いスコアを採用
    if (newTotalScore > application.total_score) {
      db.prepare(`
        UPDATE applications
        SET dice1 = ?, dice2 = ?, is_doubles = ?, dice_score = ?,
            total_score = ?, rerolled = 1
        WHERE id = ?
      `).run(newDice1, newDice2, newIsDoubles ? 1 : 0, newDiceScore, newTotalScore, params.id);

      const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(params.id);
      return NextResponse.json({
        success: true,
        improved: true,
        application: updated
      });
    } else {
      // スコアが改善されなかったが、振り直しフラグは立てる
      db.prepare('UPDATE applications SET rerolled = 1 WHERE id = ?').run(params.id);

      return NextResponse.json({
        success: true,
        improved: false,
        message: '前回のスコアの方が高かったため、そのまま維持されました',
        newDice: { dice1: newDice1, dice2: newDice2, score: newDiceScore }
      });
    }
  } catch (error) {
    console.error('Reroll error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
