import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  registerWebhook,
  stopWebhook,
  getActiveWebhooks,
  cleanupExpiredWebhooks,
  renewWebhooksIfNeeded,
} from '@/lib/webhook-manager';

export const dynamic = 'force-dynamic';

// Webhook状態の取得
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const activeWebhooks = getActiveWebhooks();

    return NextResponse.json({
      active: activeWebhooks.length > 0,
      webhooks: activeWebhooks,
    });
  } catch (error: any) {
    console.error('Failed to get webhook status:', error);
    return NextResponse.json(
      { error: 'Webhook状態の取得に失敗しました', message: error.message },
      { status: 500 }
    );
  }
}

// Webhookの登録
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { action, webhookUrl } = await request.json();

    if (action === 'register') {
      if (!webhookUrl) {
        return NextResponse.json(
          { error: 'webhookUrlが必要です' },
          { status: 400 }
        );
      }

      const channel = await registerWebhook(webhookUrl);

      return NextResponse.json({
        success: true,
        action: 'registered',
        channel,
      });
    }

    if (action === 'cleanup') {
      const count = await cleanupExpiredWebhooks();

      return NextResponse.json({
        success: true,
        action: 'cleaned_up',
        count,
      });
    }

    if (action === 'renew') {
      if (!webhookUrl) {
        return NextResponse.json(
          { error: 'webhookUrlが必要です' },
          { status: 400 }
        );
      }

      const result = await renewWebhooksIfNeeded(webhookUrl);

      return NextResponse.json({
        success: true,
        action: 'renewed',
        ...result,
      });
    }

    return NextResponse.json(
      { error: '不正なアクションです' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Webhook operation error:', error);
    return NextResponse.json(
      { error: 'Webhook操作に失敗しました', message: error.message },
      { status: 500 }
    );
  }
}

// Webhookの停止
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { channelId, resourceId } = await request.json();

    if (!channelId || !resourceId) {
      return NextResponse.json(
        { error: 'channelIdとresourceIdが必要です' },
        { status: 400 }
      );
    }

    await stopWebhook(channelId, resourceId);

    return NextResponse.json({
      success: true,
      action: 'stopped',
    });
  } catch (error: any) {
    console.error('Webhook stop error:', error);
    return NextResponse.json(
      { error: 'Webhook停止に失敗しました', message: error.message },
      { status: 500 }
    );
  }
}
