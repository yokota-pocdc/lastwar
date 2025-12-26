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
    }

    session.userName = user.name;
    session.userId = user.id;
    await session.save();

    return NextResponse.json({ success: true, user: { id: user.id, name: user.name } });
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
      return NextResponse.json({
        authenticated: true,
        user: { id: session.userId, name: session.userName }
      });
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
