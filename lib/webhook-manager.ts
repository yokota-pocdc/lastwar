import { google } from 'googleapis';
import db from './db';
import { v4 as uuidv4 } from 'uuid';

// Google Calendar APIクライアントの初期化
function getCalendarClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  return google.calendar({ version: 'v3', auth });
}

interface WebhookChannel {
  id: number;
  channel_id: string;
  resource_id: string;
  expiration: string;
  status: 'active' | 'expired' | 'stopped';
}

/**
 * Google Calendar Push通知を登録
 */
export async function registerWebhook(webhookUrl: string): Promise<WebhookChannel> {
  const calendar = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!calendarId) {
    throw new Error('GOOGLE_CALENDAR_ID is not set');
  }

  // ユニークなチャンネルIDを生成
  const channelId = `lastwar-calendar-${uuidv4()}`;

  // 7日間の有効期限（最大1週間）
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + 7);

  try {
    // Push通知を登録
    const response = await calendar.events.watch({
      calendarId,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        expiration: expiration.getTime().toString(),
      },
    });

    console.log('✅ Webhook registered:', response.data);

    // データベースに記録
    const result = db.prepare(`
      INSERT INTO webhook_channels (
        channel_id, resource_id, expiration, status
      ) VALUES (?, ?, ?, 'active')
    `).run(
      response.data.id,
      response.data.resourceId,
      new Date(Number(response.data.expiration)).toISOString()
    );

    return {
      id: result.lastInsertRowid as number,
      channel_id: response.data.id!,
      resource_id: response.data.resourceId!,
      expiration: new Date(Number(response.data.expiration)).toISOString(),
      status: 'active',
    };
  } catch (error: any) {
    console.error('Failed to register webhook:', error);
    throw new Error(`Webhook registration failed: ${error.message}`);
  }
}

/**
 * Webhook登録を停止
 */
export async function stopWebhook(channelId: string, resourceId: string): Promise<void> {
  const calendar = getCalendarClient();

  try {
    await calendar.channels.stop({
      requestBody: {
        id: channelId,
        resourceId: resourceId,
      },
    });

    // データベースを更新
    db.prepare(`
      UPDATE webhook_channels
      SET status = 'stopped', updated_at = ?
      WHERE channel_id = ?
    `).run(new Date().toISOString(), channelId);

    console.log('✅ Webhook stopped:', channelId);
  } catch (error: any) {
    console.error('Failed to stop webhook:', error);
    throw new Error(`Webhook stop failed: ${error.message}`);
  }
}

/**
 * 有効なWebhookチャンネルを取得
 */
export function getActiveWebhooks(): WebhookChannel[] {
  return db.prepare(`
    SELECT * FROM webhook_channels
    WHERE status = 'active'
      AND datetime(expiration) > datetime('now')
    ORDER BY expiration DESC
  `).all() as WebhookChannel[];
}

/**
 * 期限切れのWebhookを検出
 */
export function getExpiredWebhooks(): WebhookChannel[] {
  return db.prepare(`
    SELECT * FROM webhook_channels
    WHERE status = 'active'
      AND datetime(expiration) <= datetime('now')
  `).all() as WebhookChannel[];
}

/**
 * 期限切れのWebhookをクリーンアップ
 */
export async function cleanupExpiredWebhooks(): Promise<number> {
  const expired = getExpiredWebhooks();

  for (const webhook of expired) {
    try {
      await stopWebhook(webhook.channel_id, webhook.resource_id);
    } catch (error) {
      console.error('Failed to stop expired webhook:', webhook.channel_id, error);
      // 停止に失敗してもデータベースは更新
      db.prepare(`
        UPDATE webhook_channels
        SET status = 'expired', updated_at = ?
        WHERE channel_id = ?
      `).run(new Date().toISOString(), webhook.channel_id);
    }
  }

  return expired.length;
}

/**
 * Webhookを自動更新（有効期限の1日前に再登録）
 */
export async function renewWebhooksIfNeeded(webhookUrl: string): Promise<{
  renewed: number;
  errors: number;
}> {
  const channels = db.prepare(`
    SELECT * FROM webhook_channels
    WHERE status = 'active'
      AND datetime(expiration) <= datetime('now', '+1 day')
  `).all() as WebhookChannel[];

  let renewed = 0;
  let errors = 0;

  for (const channel of channels) {
    try {
      // 古いチャンネルを停止
      await stopWebhook(channel.channel_id, channel.resource_id);

      // 新しいチャンネルを登録
      await registerWebhook(webhookUrl);

      renewed++;
    } catch (error) {
      console.error('Failed to renew webhook:', channel.channel_id, error);
      errors++;
    }
  }

  return { renewed, errors };
}
