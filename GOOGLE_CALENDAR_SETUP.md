# Google Calendar API 連携ガイド

## 📋 概要

このアプリはGoogleカレンダーからイベントを自動的に取り込みます。

### イベント命名規則

Googleカレンダーに以下の形式でイベントを作成してください：

```
砂漠A [任意のテキスト]
砂漠B [任意のテキスト]
狭間A [任意のテキスト]
狭間B [任意のテキスト]
```

**例:**
- `砂漠A 第1回` → 2025/01/15 20:00
- `砂漠B 第1回` → 2025/01/16 21:00
- `狭間A 1月度` → 2025/01/20 20:00
- `狭間B 1月度` → 2025/01/21 21:00

---

## 🔧 Google Cloud Console での設定

### 1. Google Cloud プロジェクトの作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成
   - プロジェクト名: `lastwar-lottery`（任意）
3. プロジェクトを選択

---

### 2. Google Calendar API を有効化

1. 左メニュー → 「APIとサービス」 → 「ライブラリ」
2. 「Google Calendar API」を検索
3. 「有効にする」をクリック

---

### 3. サービスアカウントの作成

1. 左メニュー → 「APIとサービス」 → 「認証情報」
2. 「認証情報を作成」 → 「サービスアカウント」
3. サービスアカウントの詳細:
   - 名前: `lastwar-calendar-reader`
   - ID: 自動生成
   - 説明: `Read calendar events for lottery app`
4. 「作成して続行」
5. ロールは設定不要 → 「続行」
6. 「完了」

---

### 4. サービスアカウントキーの作成

1. 作成したサービスアカウントをクリック
2. 「キー」タブ → 「鍵を追加」 → 「新しい鍵を作成」
3. キーのタイプ: **JSON**
4. 「作成」→ JSONファイルがダウンロードされる
5. **このファイルを安全に保管してください**

---

### 5. Googleカレンダーの共有設定

1. [Google Calendar](https://calendar.google.com/) を開く
2. 使用するカレンダーの設定を開く
3. 「特定のユーザーと共有」
4. サービスアカウントのメールアドレスを追加
   - メールアドレス: `lastwar-calendar-reader@[プロジェクトID].iam.gserviceaccount.com`
   - 権限: **予定の表示（すべての予定の詳細）**
5. 「送信」

---

### 6. カレンダーIDの取得

1. カレンダーの設定 → 「カレンダーの統合」
2. **カレンダーID** をコピー
   - 例: `abc123@group.calendar.google.com`
   - または: `あなたのGmail@gmail.com`

---

## 🔑 環境変数の設定

### サーバーに環境変数を設定

#### 方法1: .env.local ファイル（開発環境）

プロジェクトルートに `.env.local` ファイルを作成:

```bash
# Google Calendar API
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com
GOOGLE_SERVICE_ACCOUNT_EMAIL=lastwar-calendar-reader@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...(長い文字列)...=\n-----END PRIVATE KEY-----\n"

# Session
SESSION_SECRET=your_random_secret_key_at_least_32_characters_long
NODE_ENV=production
```

**GOOGLE_PRIVATE_KEYの設定方法:**

ダウンロードしたJSONファイルから `private_key` をコピーして、改行を `\n` に置き換えます。

```bash
# JSONファイルからprivate_keyを抽出（Linuxの場合）
cat downloaded-key.json | jq -r '.private_key'
```

または手動でコピー:
```json
{
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQI...=\n-----END PRIVATE KEY-----\n"
}
```

#### 方法2: 環境変数として直接設定（本番環境）

```bash
# サーバーにSSH接続
cd /home/ec2-user/lastwar

# .env.local を編集
nano .env.local
```

以下を貼り付け（実際の値に置き換える）:
```
GOOGLE_CALENDAR_ID=abc123@group.calendar.google.com
GOOGLE_SERVICE_ACCOUNT_EMAIL=lastwar-calendar-reader@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...(省略)...=\n-----END PRIVATE KEY-----\n"
SESSION_SECRET=your_random_secret_key
NODE_ENV=production
```

保存: `Ctrl+X` → `Y` → `Enter`

---

## 🧪 動作確認

### イベントが取り込まれるかテスト

```bash
# アプリを再起動
pm2 restart lastwar

# ログを確認
pm2 logs lastwar

# ブラウザでアクセス
# イベント一覧にGoogleカレンダーのイベントが表示されればOK
```

---

## 📅 Googleカレンダーでのイベント作成例

### 砂漠の戦場

**イベント1:**
- タイトル: `砂漠A 第1回`
- 日時: 2025年1月15日 20:00-22:00

**イベント2:**
- タイトル: `砂漠B 第1回`
- 日時: 2025年1月16日 21:00-23:00

### 狭間の戦場

**イベント3:**
- タイトル: `狭間A 1月度`
- 日時: 2025年1月20日 20:00-22:00

**イベント4:**
- タイトル: `狭間B 1月度`
- 日時: 2025年1月21日 21:00-23:00

---

## 🔄 同期の仕組み

- アプリ起動時に自動同期
- 1時間ごとに自動同期（cron）
- 手動同期ボタン（管理画面に追加予定）

---

## ⚠️ トラブルシューティング

### イベントが表示されない

1. **カレンダーIDが正しいか確認**
   ```bash
   echo $GOOGLE_CALENDAR_ID
   ```

2. **サービスアカウントに共有権限があるか確認**
   - Googleカレンダー → 設定 → 共有設定

3. **private_keyの改行が正しいか確認**
   - `\n` が含まれているか
   - ダブルクォートで囲まれているか

4. **ログを確認**
   ```bash
   pm2 logs lastwar --lines 100
   ```

---

## 🔒 セキュリティ

- ✅ サービスアカウントのJSONファイルは `.gitignore` に追加済み
- ✅ 環境変数は `.env.local` で管理（Gitにコミットされない）
- ✅ サービスアカウントには最小権限のみ付与

---

## 📚 参考リンク

- [Google Calendar API ドキュメント](https://developers.google.com/calendar/api/guides/overview)
- [サービスアカウント認証](https://cloud.google.com/iam/docs/service-accounts)
- [googleapis Node.js クライアント](https://github.com/googleapis/google-api-nodejs-client)
