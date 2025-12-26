import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';
import { rollThreeDice, generateRandomValue, calculateRankings, formatScore } from '@/lib/irregular-lottery';

export const dynamic = 'force-dynamic';

interface IrregularEvent {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  deadline: string;
  status: string;
  created_at: string;
}

interface IrregularApplication {
  id: number;
  event_id: number;
  user_id: number;
  dice1: number;
  dice2: number;
  dice3: number;
  sub_dice1: number;
  sub_dice2: number;
  sub_dice3: number;
  random_value: number;
  rank: number | null;
  created_at: string;
}

// 参加申込情報取得
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json({ error: 'イベントIDが必要です' }, { status: 400 });
    }

    // ユーザーの参加情報を取得
    const application = db.prepare(`
      SELECT * FROM irregular_applications
      WHERE event_id = ? AND user_id = ?
    `).get(parseInt(eventId), session.userId) as IrregularApplication | undefined;

    if (!application) {
      return NextResponse.json({ applied: false });
    }

    // 全参加者を取得してランキングを計算
    const allApplications = db.prepare(`
      SELECT ia.*, COALESCE(u.name, '(不明)') as user_name
      FROM irregular_applications ia
      LEFT JOIN users u ON ia.user_id = u.id
      WHERE ia.event_id = ?
    `).all(parseInt(eventId)) as any[];

    const rankedApplications = calculateRankings(allApplications);
    const userRankedApp = rankedApplications.find(a => a.user_id === session.userId);

    return NextResponse.json({
      applied: true,
      application: {
        ...application,
        mainScore: formatScore(application.dice1, application.dice2, application.dice3),
        subScore: formatScore(application.sub_dice1, application.sub_dice2, application.sub_dice3),
        rank: userRankedApp?.rank || null
      },
      totalParticipants: allApplications.length
    });
  } catch (error) {
    console.error('Irregular application fetch error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// 参加申込（サイコロを振る）
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const data = await request.json();
    const { eventId } = data;

    if (!eventId) {
      return NextResponse.json({ error: 'イベントIDが必要です' }, { status: 400 });
    }

    // イベントの存在と状態を確認
    const event = db.prepare(`
      SELECT * FROM irregular_events WHERE id = ?
    `).get(eventId) as IrregularEvent | undefined;

    if (!event) {
      return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
    }

    if (event.status !== 'open') {
      return NextResponse.json({ error: 'このイベントは募集を終了しています' }, { status: 400 });
    }

    // 締切日を確認
    const now = new Date();
    const deadline = new Date(event.deadline);
    if (now > deadline) {
      // ステータスを更新
      db.prepare(`
        UPDATE irregular_events SET status = 'closed' WHERE id = ?
      `).run(eventId);
      return NextResponse.json({ error: '締め切りを過ぎています' }, { status: 400 });
    }

    // 既に参加しているかチェック
    const existing = db.prepare(`
      SELECT * FROM irregular_applications
      WHERE event_id = ? AND user_id = ?
    `).get(eventId, session.userId);

    if (existing) {
      return NextResponse.json({ error: '既にこのイベントに参加しています' }, { status: 400 });
    }

    // サイコロを振る（P: メインスコア用）
    const mainDice = rollThreeDice();
    // サイコロを振る（Q: サブスコア用）
    const subDice = rollThreeDice();
    // システムランダム値を生成（R: 最終決定用）
    const randomValue = generateRandomValue();

    // 参加情報を登録
    const result = db.prepare(`
      INSERT INTO irregular_applications (
        event_id, user_id,
        dice1, dice2, dice3,
        sub_dice1, sub_dice2, sub_dice3,
        random_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      session.userId,
      mainDice.dice1, mainDice.dice2, mainDice.dice3,
      subDice.dice1, subDice.dice2, subDice.dice3,
      randomValue
    );

    // 全参加者を取得してランキングを計算
    const allApplications = db.prepare(`
      SELECT ia.*, COALESCE(u.name, '(不明)') as user_name
      FROM irregular_applications ia
      LEFT JOIN users u ON ia.user_id = u.id
      WHERE ia.event_id = ?
    `).all(eventId) as any[];

    const rankedApplications = calculateRankings(allApplications);
    const userRankedApp = rankedApplications.find(a => a.user_id === session.userId);

    return NextResponse.json({
      success: true,
      application: {
        id: result.lastInsertRowid,
        eventId,
        mainScore: formatScore(mainDice.dice1, mainDice.dice2, mainDice.dice3),
        subScore: formatScore(subDice.dice1, subDice.dice2, subDice.dice3),
        dice: {
          main: mainDice,
          sub: subDice
        },
        rank: userRankedApp?.rank || null
      },
      totalParticipants: allApplications.length
    });
  } catch (error) {
    console.error('Irregular application error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
