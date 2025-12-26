import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// ユーザー登録/ログイン
export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: '名前を入力してください' }, { status: 400 });
    }

    const session = await getSession();

    // ユーザー取得または作成
    let user = db.prepare('SELECT * FROM users WHERE name = ?').get(name.trim()) as any;

    if (!user) {
      const result = db.prepare('INSERT INTO users (name) VALUES (?)').run(name.trim());
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as any;
      console.log('Created new user:', { id: user.id, name: user.name, idType: typeof user.id });
    } else {
      console.log('Found existing user:', { id: user.id, name: user.name, idType: typeof user.id });
    }

    // BigInt対策: 確実にnumber型に変換
    const userId = Number(user.id);

    session.userName = user.name;
    session.userId = userId;
    await session.save();

    console.log('Session saved:', { userId: session.userId, userName: session.userName });

    return NextResponse.json({ success: true, user: { id: userId, name: user.name } });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// セッション確認
export async function GET() {
  try {
    const session = await getSession();

    if (session.userId) {
      // ユーザーがDBに存在するか確認
      const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(session.userId) as any;

      if (user) {
        return NextResponse.json({
          authenticated: true,
          user: { id: user.id, name: user.name }
        });
      } else {
        // DBにユーザーが存在しない場合はセッションを破棄
        console.log('Session userId not found in DB, destroying session:', session.userId);
        session.destroy();
      }
    }

    return NextResponse.json({ authenticated: false });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// ログアウト
export async function DELETE() {
  try {
    const session = await getSession();
    session.destroy();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
