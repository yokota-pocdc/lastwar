# デプロイガイド

## 📋 目次

1. [ローカル開発環境](#ローカル開発環境)
2. [Vercelへのデプロイ（推奨）](#vercelへのデプロイ推奨)
3. [VPS/レンタルサーバーへのデプロイ](#vpsレンタルサーバーへのデプロイ)
4. [PostgreSQLへの移行](#postgresqlへの移行)

---

## ローカル開発環境

### セットアップ

```bash
# リポジトリをクローン
git clone <repository-url>
cd lastwar

# 依存パッケージをインストール
npm install

# データベースを初期化
npm run init-db

# 開発サーバーを起動
npm run dev
```

ブラウザで http://localhost:3000 にアクセス

### 環境変数（オプション）

`.env.local` ファイルを作成：

```bash
# セッション暗号化キー（32文字以上）
SESSION_SECRET=your_random_secret_key_at_least_32_characters_long

# Node環境
NODE_ENV=development
```

---

## Vercelへのデプロイ（推奨）

### ⚠️ 重要な注意事項

**SQLiteはVercelでは永続化されません！** Vercelは関数ごとに一時的なファイルシステムを使用するため、SQLiteデータベースはデプロイごとにリセットされます。

**本番環境では必ずPostgreSQLなどのクラウドDBを使用してください。**

### 手順

#### 1. Vercelアカウント作成

https://vercel.com にアクセスしてアカウント作成（GitHub連携推奨）

#### 2. プロジェクトをインポート

```bash
# Vercel CLIをインストール（オプション）
npm install -g vercel

# プロジェクトをデプロイ
vercel
```

または、Vercelダッシュボードから：
1. 「New Project」をクリック
2. GitHubリポジトリを選択
3. ブランチ `claude/lastwars-lottery-app-011CUgaUc9JC5ye5UUHz8PAt` を選択
4. 「Deploy」をクリック

#### 3. 環境変数を設定

Vercelダッシュボード → Settings → Environment Variables

```
SESSION_SECRET = your_random_secret_key_at_least_32_characters_long
NODE_ENV = production
```

#### 4. PostgreSQLへ移行（必須）

下記の「PostgreSQLへの移行」セクションを参照

---

## VPS/レンタルサーバーへのデプロイ

### 推奨環境

- **OS**: Ubuntu 22.04 LTS
- **Node.js**: 18.x 以上
- **メモリ**: 512MB以上
- **ストレージ**: 1GB以上

### 手順

#### 1. サーバーにSSH接続

```bash
ssh user@your-server-ip
```

#### 2. Node.jsをインストール

```bash
# Node.js 18.xをインストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 確認
node -v
npm -v
```

#### 3. プロジェクトをクローン

```bash
cd /var/www
sudo git clone <repository-url> lastwar
cd lastwar
sudo chown -R $USER:$USER .
```

#### 4. 依存パッケージをインストール

```bash
npm install
```

#### 5. 環境変数を設定

```bash
# .env.localファイルを作成
nano .env.local
```

以下を記載：
```
SESSION_SECRET=your_random_secret_key_at_least_32_characters_long
NODE_ENV=production
```

#### 6. データベースを初期化

```bash
npm run init-db
```

#### 7. ビルド

```bash
npm run build
```

#### 8. PM2で起動（自動再起動対応）

```bash
# PM2をインストール
sudo npm install -g pm2

# アプリを起動
pm2 start npm --name "lastwar-lottery" -- start

# 自動起動を設定
pm2 startup
pm2 save
```

#### 9. Nginxをリバースプロキシとして設定

```bash
# Nginxをインストール
sudo apt-get install nginx

# 設定ファイルを作成
sudo nano /etc/nginx/sites-available/lastwar
```

以下を記載：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

有効化：
```bash
sudo ln -s /etc/nginx/sites-available/lastwar /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 10. SSL証明書（Let's Encrypt）

```bash
# Certbotをインストール
sudo apt-get install certbot python3-certbot-nginx

# 証明書を取得
sudo certbot --nginx -d your-domain.com
```

---

## PostgreSQLへの移行

### 推奨クラウドDB

- **Vercel Postgres** (推奨、Vercelと統合)
- **Supabase** (無料プラン有り)
- **Neon** (無料プラン有り)
- **Railway** (無料プラン有り)

### Vercel Postgresの場合

#### 1. Vercel PostgresをプロジェクトにAdd

Vercelダッシュボード → Storage → Create Database → Postgres

#### 2. 環境変数を自動取得

接続情報は自動的に環境変数に設定されます：
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

#### 3. データベースライブラリをインストール

```bash
npm install pg
npm uninstall better-sqlite3
```

#### 4. `lib/db.ts` を修正

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function initializeDatabase() {
  const client = await pool.connect();

  try {
    // ユーザーテーブル
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        tickets_remaining INTEGER DEFAULT 2,
        tickets_reset_date TEXT DEFAULT (CURRENT_DATE + INTERVAL '1 month'),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // イベントテーブル
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        event_type TEXT NOT NULL CHECK(event_type IN ('desert', 'gap')),
        event_date TEXT NOT NULL,
        team_a_capacity INTEGER DEFAULT 30,
        team_b_capacity INTEGER DEFAULT 30,
        team_a_participants INTEGER DEFAULT 20,
        team_b_participants INTEGER DEFAULT 20,
        use_team_b INTEGER DEFAULT 1,
        status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'finished')),
        lottery_executed INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 参加申込テーブル
    await client.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        dice1 INTEGER NOT NULL,
        dice2 INTEGER NOT NULL,
        is_doubles INTEGER DEFAULT 0,
        dice_score INTEGER NOT NULL,
        used_ticket INTEGER DEFAULT 0,
        total_score INTEGER NOT NULL,
        preferred_team TEXT CHECK(preferred_team IN ('A', 'B')),
        result_team TEXT CHECK(result_team IN ('A', 'B', NULL)),
        result_status TEXT CHECK(result_status IN ('participant', 'candidate', 'rejected', NULL)),
        rerolled INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(event_id, user_id)
      )
    `);

    // インデックス作成
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
      CREATE INDEX IF NOT EXISTS idx_applications_event ON applications(event_id);
      CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
    `);

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

export default { query, initializeDatabase };
```

#### 5. クエリをPostgreSQL形式に変更

SQLiteとPostgreSQLの違いを修正：

**SQLite:**
```javascript
db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
```

**PostgreSQL:**
```javascript
await db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

すべてのAPIルートで`db.prepare().run/get/all()`を`await db.query()`に変更する必要があります。

#### 6. デプロイ

```bash
# ビルド
npm run build

# Vercelにデプロイ
vercel --prod
```

---

## 本番環境チェックリスト

### セキュリティ

- [ ] `SESSION_SECRET`を強力なランダム文字列に設定
- [ ] HTTPS/SSL証明書を設定
- [ ] 環境変数をGitにコミットしない（.gitignoreに.env*を追加済み）
- [ ] データベースへのアクセスを制限

### パフォーマンス

- [ ] `npm run build`で本番ビルドを実行
- [ ] 画像を最適化
- [ ] CDNを使用（Vercelは自動）

### 監視

- [ ] エラーログを監視
- [ ] データベースバックアップを設定
- [ ] アップタイム監視（UptimeRobot等）

---

## トラブルシューティング

### Vercelでデータが消える

→ **原因**: SQLiteはVercelで永続化されない
→ **解決**: PostgreSQLに移行

### ビルドエラー

```bash
# キャッシュをクリア
rm -rf .next node_modules
npm install
npm run build
```

### セッションが保存されない

→ **原因**: SESSION_SECRETが未設定
→ **解決**: 環境変数を設定

### データベースエラー

```bash
# データベースを再初期化
npm run init-db
```

---

## サポート

問題が発生した場合：
1. ログを確認
2. GitHub Issuesで検索
3. 新しいIssueを作成

---

## 参考リンク

- [Next.js デプロイメント](https://nextjs.org/docs/deployment)
- [Vercel ドキュメント](https://vercel.com/docs)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [PM2 ドキュメント](https://pm2.keymetrics.io/)
