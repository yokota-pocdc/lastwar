#!/usr/bin/env tsx

/**
 * Google Calendar Webhook登録スクリプト
 *
 * 使い方:
 *   tsx scripts/register-webhook.ts register https://your-domain.com/api/webhooks/google-calendar
 *   tsx scripts/register-webhook.ts status
 *   tsx scripts/register-webhook.ts renew https://your-domain.com/api/webhooks/google-calendar
 *   tsx scripts/register-webhook.ts cleanup
 */

import { config } from 'dotenv';
import * as path from 'path';

// .env.localファイルを読み込む
const projectRoot = process.cwd();
config({ path: path.join(projectRoot, '.env.local') });

import {
  registerWebhook,
  getActiveWebhooks,
  renewWebhooksIfNeeded,
  cleanupExpiredWebhooks,
} from '../lib/webhook-manager';

async function main() {
  const args = process.argv.slice(2);
  const action = args[0];
  const webhookUrl = args[1];

  if (!action) {
    console.error('使い方:');
    console.error('  tsx scripts/register-webhook.ts register <webhook-url>');
    console.error('  tsx scripts/register-webhook.ts status');
    console.error('  tsx scripts/register-webhook.ts renew <webhook-url>');
    console.error('  tsx scripts/register-webhook.ts cleanup');
    process.exit(1);
  }

  try {
    switch (action) {
      case 'register':
        if (!webhookUrl) {
          console.error('❌ エラー: Webhook URLを指定してください');
          console.error('例: tsx scripts/register-webhook.ts register https://your-domain.com/api/webhooks/google-calendar');
          process.exit(1);
        }

        console.log('📝 Webhookを登録しています...');
        console.log(`   URL: ${webhookUrl}`);

        const channel = await registerWebhook(webhookUrl);

        console.log('✅ Webhook登録成功!');
        console.log(`   Channel ID: ${channel.channel_id}`);
        console.log(`   Resource ID: ${channel.resource_id}`);
        console.log(`   有効期限: ${new Date(channel.expiration).toLocaleString('ja-JP')}`);
        break;

      case 'status':
        console.log('📊 アクティブなWebhookを確認しています...');

        const activeWebhooks = getActiveWebhooks();

        if (activeWebhooks.length === 0) {
          console.log('ℹ️  アクティブなWebhookはありません');
        } else {
          console.log(`✅ ${activeWebhooks.length}件のアクティブなWebhook:`);
          activeWebhooks.forEach((webhook, index) => {
            const expiration = new Date(webhook.expiration);
            const now = new Date();
            const daysLeft = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            console.log(`\n  ${index + 1}. Channel ID: ${webhook.channel_id}`);
            console.log(`     Resource ID: ${webhook.resource_id}`);
            console.log(`     有効期限: ${expiration.toLocaleString('ja-JP')} (残り${daysLeft}日)`);
            console.log(`     ステータス: ${webhook.status}`);
          });
        }
        break;

      case 'renew':
        if (!webhookUrl) {
          console.error('❌ エラー: Webhook URLを指定してください');
          console.error('例: tsx scripts/register-webhook.ts renew https://your-domain.com/api/webhooks/google-calendar');
          process.exit(1);
        }

        console.log('🔄 Webhookを更新しています...');
        console.log(`   URL: ${webhookUrl}`);

        const renewResult = await renewWebhooksIfNeeded(webhookUrl);

        if (renewResult.renewed > 0) {
          console.log('✅ Webhook更新成功!');
          console.log(`   更新数: ${renewResult.renewed}`);
          if (renewResult.errors > 0) {
            console.log(`   ⚠️  エラー数: ${renewResult.errors}`);
          }
        } else {
          console.log('ℹ️  更新の必要なWebhookはありません');
          if (renewResult.errors > 0) {
            console.log(`   ⚠️  エラー数: ${renewResult.errors}`);
          }
        }
        break;

      case 'cleanup':
        console.log('🧹 期限切れのWebhookをクリーンアップしています...');

        const cleanupCount = await cleanupExpiredWebhooks();

        if (cleanupCount > 0) {
          console.log(`✅ ${cleanupCount}件のWebhookをクリーンアップしました`);
        } else {
          console.log('ℹ️  クリーンアップするWebhookはありません');
        }
        break;

      default:
        console.error(`❌ エラー: 不明なアクション "${action}"`);
        console.error('利用可能なアクション: register, status, renew, cleanup');
        process.exit(1);
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    if (error.stack) {
      console.error('\nスタックトレース:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
