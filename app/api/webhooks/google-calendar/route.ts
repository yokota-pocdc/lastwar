import { NextRequest, NextResponse } from 'next/server';
import { syncGoogleToDB } from '@/lib/bidirectional-sync';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Google Calendar Webhook受信エンドポイント
 *
 * Google Calendar Push Notificationsからの通知を受け取る
 * https://developers.google.com/calendar/api/guides/push
 */
export async function POST(request: NextRequest) {
  try {
    // Webhookヘッダーを確認
    const channelId = request.headers.get('x-goog-channel-id');
    const resourceState = request.headers.get('x-goog-resource-state');
    const resourceId = request.headers.get('x-goog-resource-id');

    console.log('📩 Webhook received:', {
      channelId,
      resourceState,
      resourceId,
      url: request.url,
    });

    // sync通知の場合は初回確認なので何もしない
    if (resourceState === 'sync') {
      return NextResponse.json({ success: true, action: 'sync_acknowledged' });
    }

    // exists通知の場合は変更があったので同期を実行
    if (resourceState === 'exists') {
      console.log('🔄 Calendar change detected, triggering sync...');

      // 非同期で同期を実行（Webhookのレスポンスをブロックしない）
      syncGoogleToDB()
        .then(result => {
          console.log('✅ Webhook-triggered sync completed:', result);
        })
        .catch(error => {
          console.error('❌ Webhook-triggered sync failed:', error);
        });

      return NextResponse.json({ success: true, action: 'sync_triggered' });
    }

    return NextResponse.json({ success: true, action: 'no_action' });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    // Webhookは200を返さないとGoogleがリトライし続けるので、
    // エラーでも200を返す
    return NextResponse.json({ error: error.message }, { status: 200 });
  }
}

/**
 * Webhook検証用（オプション）
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Google Calendar Webhook Endpoint',
    status: 'active',
  });
}
