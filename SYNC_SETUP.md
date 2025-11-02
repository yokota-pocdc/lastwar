# Google Calendar 同期システム セットアップガイド

## 概要

このシステムは、ローカルデータベースとGoogle Calendarの間で双方向同期を行い、不整合を検出・修復する機能を提供します。

### 主な機能

1. **トランザクションログ**: すべての同期操作を記録し、失敗時のリトライを可能にします
2. **双方向同期**:
   - DB → Google: 孤立イベント（google_event_idがnull）をGoogle Calendarに作成
   - Google → DB: Google CalendarのイベントをローカルDBに同期
3. **不整合検出**: 4種類の不整合パターンを検出
   - `missing_in_google`: DBにあるがGoogleにないイベント
   - `missing_in_db`: GoogleにあるがDBにないイベント
   - `orphan`: google_event_idがnullの将来のイベント
   - `data_mismatch`: タイトルや日時が異なるイベント
4. **Webhook (Push通知)**: Google Calendarの変更をリアルタイムで検知

### クイックスタート

本番環境でWebhookを登録する最も簡単な方法:

```bash
# 1. サーバーにSSHログイン
ssh user@your-server

# 2. プロジェクトディレクトリへ移動
cd /path/to/lastwar

# 3. Webhookを登録（公開URLを指定）
npm run webhook:register https://jfkh.add3.cloud/api/webhooks/google-calendar

# 4. 登録状態を確認
npm run webhook:status
```

**利用可能なコマンド:**
- `npm run webhook:register <url>` - Webhookを登録
- `npm run webhook:status` - Webhook状態を確認
- `npm run webhook:renew <url>` - Webhookを更新
- `npm run webhook:cleanup` - 期限切れWebhookをクリーンアップ

## 1. データベースマイグレーション

まず、必要なテーブルを作成します。

```bash
node scripts/migrate.js
```

これにより以下のテーブルが作成されます:
- `sync_logs`: 同期操作のトランザクションログ
- `webhook_channels`: Webhook登録情報
- `sync_inconsistencies`: 検出された不整合の記録

## 2. 環境変数の設定

`.env.local` ファイルに以下を追加してください（既に設定済みの場合はスキップ）:

```env
# Google Calendar API
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com

# Webhook用の公開URL（本番環境でのみ必要）
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

## 3. API エンドポイント

### 3.1 不整合の検出と修復

#### 不整合の検出
```bash
GET /api/sync/inconsistencies
```

レスポンス例:
```json
{
  "summary": {
    "missingInGoogle": 2,
    "missingInDB": 1,
    "orphanEvents": 3,
    "dataMismatches": 1,
    "total": 7
  },
  "details": {
    "missingInGoogle": [...],
    "missingInDB": [...],
    "orphanEvents": [...],
    "dataMismatches": [...]
  }
}
```

#### 双方向同期の実行
```bash
POST /api/sync/inconsistencies
```

レスポンス例:
```json
{
  "success": true,
  "googleToDB": {
    "created": 1,
    "updated": 2,
    "errors": []
  },
  "dbToGoogle": {
    "created": 3,
    "updated": 0,
    "errors": []
  },
  "inconsistencies": {
    "missingInGoogle": [],
    "missingInDB": [],
    "orphanEvents": [],
    "dataMismatches": []
  }
}
```

### 3.2 Webhook管理

#### Webhookの状態確認
```bash
GET /api/sync/webhook
```

#### Webhookの登録
```bash
POST /api/sync/webhook
Content-Type: application/json

{
  "action": "register",
  "webhookUrl": "https://your-domain.com/api/webhooks/google-calendar"
}
```

**重要**: Webhook URLは以下の要件を満たす必要があります:
- HTTPS必須（HTTPは不可）
- 公開アクセス可能なURL
- Google Calendarからアクセス可能

#### Webhookの更新（期限切れ前の更新）
```bash
POST /api/sync/webhook
Content-Type: application/json

{
  "action": "renew",
  "webhookUrl": "https://your-domain.com/api/webhooks/google-calendar"
}
```

#### 期限切れWebhookのクリーンアップ
```bash
POST /api/sync/webhook
Content-Type: application/json

{
  "action": "cleanup"
}
```

#### Webhookの停止
```bash
DELETE /api/sync/webhook
Content-Type: application/json

{
  "channelId": "channel-id-from-registration",
  "resourceId": "resource-id-from-registration"
}
```

### 3.3 Webhook受信エンドポイント

Google Calendarからの通知を受信します:
```
POST /api/webhooks/google-calendar
```

このエンドポイントは自動的にGoogle → DB同期をトリガーします。

## 4. 使用シナリオ

### シナリオ1: 初回セットアップ

```bash
# 1. マイグレーション実行
node scripts/migrate.js

# 2. 既存の不整合を確認
curl http://localhost:3000/api/sync/inconsistencies

# 3. 双方向同期を実行
curl -X POST http://localhost:3000/api/sync/inconsistencies

# 4. Webhook登録（本番環境のみ）
curl -X POST http://localhost:3000/api/sync/webhook \
  -H "Content-Type: application/json" \
  -d '{"action": "register", "webhookUrl": "https://your-domain.com/api/webhooks/google-calendar"}'
```

### シナリオ2: 定期的な不整合チェック

cron やスケジューラーを使って定期実行:

```bash
# 毎日3時に不整合をチェックして修復
0 3 * * * curl -X POST http://localhost:3000/api/sync/inconsistencies
```

### シナリオ3: 手動での不整合修復

管理画面から実行する場合:

```javascript
// 不整合を検出
const checkResult = await fetch('/api/sync/inconsistencies');
const inconsistencies = await checkResult.json();

if (inconsistencies.summary.total > 0) {
  console.log('不整合が検出されました:', inconsistencies.summary);

  // 修復を実行
  const syncResult = await fetch('/api/sync/inconsistencies', { method: 'POST' });
  const result = await syncResult.json();
  console.log('修復結果:', result);
}
```

## 5. Webhookのセットアップ（本番環境）

### 5.1 前提条件

- アプリケーションが HTTPS で公開されている
- ドメイン名が設定されている（例: `https://lastwar.example.com`）
- Google Calendar APIで通知が有効化されている

### 5.2 Webhook登録手順

1. `.env.local` に公開URLを設定:
```env
NEXT_PUBLIC_BASE_URL=https://lastwar.example.com
```

2. アプリケーションをデプロイ

3. Webhookを登録:

**方法1: サーバーサイドスクリプト（推奨）**
```bash
# サーバーにSSHログイン後、プロジェクトディレクトリで実行
npm run webhook:register https://jfkh.add3.cloud/api/webhooks/google-calendar

# または直接実行
tsx scripts/register-webhook.ts register https://jfkh.add3.cloud/api/webhooks/google-calendar
```

**方法2: API経由（認証が必要）**
```bash
# ブラウザでログイン後、セッションCookieを取得して実行
curl -X POST https://lastwar.example.com/api/sync/webhook \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-session-cookie" \
  -d '{
    "action": "register",
    "webhookUrl": "https://lastwar.example.com/api/webhooks/google-calendar"
  }'
```

4. 登録結果を確認:
```bash
# サーバーサイドスクリプト
npm run webhook:status

# または API経由
curl https://lastwar.example.com/api/sync/webhook \
  -H "Cookie: session=your-session-cookie"
```

### 5.3 Webhook更新（有効期限前）

Webhookは最大7日間有効です。期限切れ前に更新する必要があります:

**方法1: サーバーサイドスクリプト（推奨）**
```bash
# Webhookを更新
npm run webhook:renew https://jfkh.add3.cloud/api/webhooks/google-calendar

# または直接実行
tsx scripts/register-webhook.ts renew https://jfkh.add3.cloud/api/webhooks/google-calendar
```

**方法2: API経由**
```bash
# 期限が近いWebhookを自動更新
curl -X POST https://lastwar.example.com/api/sync/webhook \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-session-cookie" \
  -d '{
    "action": "renew",
    "webhookUrl": "https://lastwar.example.com/api/webhooks/google-calendar"
  }'
```

**推奨: cron で毎日自動更新を実行**

crontabに以下を追加（プロジェクトディレクトリへの絶対パスを使用）:
```bash
# 毎日2時にWebhookを更新（必要な場合のみ）
0 2 * * * cd /path/to/lastwar && npm run webhook:renew https://jfkh.add3.cloud/api/webhooks/google-calendar >> /var/log/webhook-renew.log 2>&1
```

## 6. 開発環境での注意事項

### ローカル開発時の制限

- **Webhookは使用不可**: localhost はHTTPSの公開URLではないため、Webhookを登録できません
- **手動同期のみ**: `/api/sync/inconsistencies` への POST リクエストで手動同期を実行してください

### ngrok を使った開発環境でのWebhookテスト

ローカル開発でもWebhookをテストしたい場合、ngrokを使用できます:

```bash
# ngrokをインストール（未インストールの場合）
npm install -g ngrok

# Next.jsアプリを起動
npm run dev

# 別のターミナルでngrokを起動
ngrok http 3000
```

ngrokが提供するHTTPS URLを使ってWebhookを登録:
```bash
curl -X POST http://localhost:3000/api/sync/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "action": "register",
    "webhookUrl": "https://xxxx-xx-xx-xx-xx.ngrok.io/api/webhooks/google-calendar"
  }'
```

**注意**: ngrokの無料版は URL が毎回変わるため、テスト時のみ使用してください。

## 7. トラブルシューティング

### 問題: Webhook登録に失敗する

**エラー**: `Channel creation failed`

**原因**:
- URLがHTTPSではない
- URLが公開アクセスできない
- Google Calendar APIで通知が有効化されていない

**解決策**:
1. URLがHTTPSで始まることを確認
2. URLが外部からアクセス可能か確認（curl でテスト）
3. Google Cloud Consoleで Calendar APIの設定を確認

### 問題: 同期が失敗する

**エラー**: `sync_logs` テーブルに `failed` ステータスのレコードがある

**確認方法**:
```sql
SELECT * FROM sync_logs WHERE status = 'failed' ORDER BY created_at DESC LIMIT 10;
```

**原因**:
- Google Calendar APIの認証エラー
- ネットワークエラー
- データ形式の問題

**解決策**:
1. `error_message` カラムを確認
2. Google Calendar APIの認証情報を確認
3. リトライ処理が実行されているか確認

### 問題: 不整合が解消されない

**症状**: 同期を実行しても不整合が残る

**確認方法**:
```bash
# 不整合の詳細を確認
curl http://localhost:3000/api/sync/inconsistencies | jq '.details'
```

**解決策**:
1. `sync_inconsistencies` テーブルを確認:
```sql
SELECT * FROM sync_inconsistencies WHERE status = 'detected' ORDER BY created_at DESC;
```

2. 手動で修正が必要な場合:
   - `missing_in_google`: イベントを再作成するかDBから削除
   - `missing_in_db`: Googleから削除するかDBに追加
   - `orphan`: google_event_idを手動で設定
   - `data_mismatch`: どちらを正とするか判断して修正

## 8. データベースクエリ例

### 同期ログの統計を確認

```sql
SELECT
  status,
  direction,
  COUNT(*) as count
FROM sync_logs
WHERE created_at > datetime('now', '-7 days')
GROUP BY status, direction;
```

### 失敗した同期操作を確認

```sql
SELECT
  id,
  operation_type,
  direction,
  error_message,
  retry_count,
  created_at
FROM sync_logs
WHERE status IN ('failed', 'retrying')
ORDER BY created_at DESC
LIMIT 20;
```

### アクティブなWebhookを確認

```sql
SELECT * FROM webhook_channels WHERE status = 'active';
```

### 不整合の履歴を確認

```sql
SELECT
  inconsistency_type,
  COUNT(*) as count
FROM sync_inconsistencies
GROUP BY inconsistency_type;
```

## 9. ベストプラクティス

1. **定期的な同期**: cron で毎日1回不整合チェックと修復を実行
2. **Webhook更新**: 有効期限の2日前に自動更新を実行
3. **ログの確認**: 週次で `sync_logs` を確認し、エラーがないかチェック
4. **古いログの削除**: 月次で30日以前のログを削除してDBサイズを管理

```javascript
// 古いログを削除する例
import { cleanupOldSyncLogs } from '@/lib/sync-transaction';

// 30日以前の成功ログを削除
const deletedCount = cleanupOldSyncLogs(30);
console.log(`${deletedCount}件の古いログを削除しました`);
```

## 10. セキュリティ考慮事項

- Webhook受信エンドポイントは認証不要ですが、リクエストヘッダーでGoogle Calendarからの通知であることを検証しています
- 管理用APIエンドポイント（`/api/sync/*`）はセッション認証が必要です
- Google Calendar APIの認証情報（サービスアカウント）は環境変数で管理し、Gitにコミットしないでください
