# ラストウォー 抽選アプリ

砂漠の戦場・狭間の戦場の参加者抽選システム

## 主な機能

### ユーザー機能
- **簡易ログイン**: URLクエリまたはフォーム入力で名前を登録（セッション永続化）
- **カレンダー表示**: 月別でイベントを確認
- **参加申込**: サイコロ2個を振って申し込み
- **サイコロシステム**:
  - 各サイコロ: 1-6のランダム値
  - ゾロ目ボーナス: 合計値×2
  - 振り直し: 1回まで可能（高い方を自動採用）
- **絶対参加チケット**:
  - 毎月2枚付与
  - 使用すると+12点
  - 毎月1日に自動リセット

### 管理機能
- **イベント作成**: 砂漠・狭間の戦場イベントを作成
- **抽選実行**: ワンクリックで自動抽選
- **結果表示**: 順位付き結果一覧
- **CSV出力**: 結果をExcel等で開けるCSV形式で出力

### 抽選ロジック
- サイコロ出目 + チケットボーナス(0 or 12) = 合計スコア
- 合計スコア降順でソート
- 同点の場合は申込登録時刻が早い方を優先
- チームA/Bごとに参加者・候補者を自動振り分け

## セットアップ

### 必要環境
- Node.js 18以上
- npm または yarn

### インストール

```bash
# 依存関係のインストール
npm install

# データベース初期化
npm run init-db

# 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:3000 にアクセス

### URLクエリログイン

名前をURLに含めることで自動ログイン:
```
http://localhost:3000?name=太郎
```

## プロジェクト構造

```
lastwar/
├── app/
│   ├── api/              # APIルート
│   │   ├── auth/         # 認証
│   │   ├── events/       # イベント管理
│   │   ├── applications/ # 参加申込
│   │   ├── tickets/      # チケット
│   │   └── admin/        # 管理者API
│   ├── admin/            # 管理画面
│   └── page.tsx          # トップページ
├── components/           # Reactコンポーネント
│   ├── Calendar.tsx      # カレンダー表示
│   ├── EventModal.tsx    # イベント詳細モーダル
│   ├── DiceRoller.tsx    # サイコロ機能
│   ├── Header.tsx        # ヘッダー
│   └── LoginForm.tsx     # ログインフォーム
├── lib/
│   ├── db.ts             # データベース
│   ├── session.ts        # セッション管理
│   ├── lottery.ts        # 抽選ロジック
│   └── tickets.ts        # チケット管理
└── lottery.db            # SQLiteデータベース（自動生成）
```

## データベーススキーマ

### users（ユーザー）
- id: ユーザーID
- name: 名前
- tickets_remaining: 残チケット数
- tickets_reset_date: 次回リセット日

### events（イベント）
- id: イベントID
- title: タイトル
- event_type: 'desert' | 'gap'
- event_date: 開催日
- use_team_b: チームB使用フラグ
- status: 'open' | 'closed' | 'finished'
- lottery_executed: 抽選実行済みフラグ

### applications（申込）
- id: 申込ID
- event_id: イベントID
- user_id: ユーザーID
- dice1, dice2: サイコロの目
- dice_score: サイコロスコア
- used_ticket: チケット使用フラグ
- total_score: 合計スコア
- result_team: 抽選結果チーム
- result_status: 'participant' | 'candidate' | 'rejected'
- rerolled: 振り直し済みフラグ

## 使い方

### 1. ユーザーとしての利用

1. トップページにアクセス
2. 名前を入力してログイン
3. カレンダーからイベントを選択
4. サイコロを振って参加申込
5. チケットを使うか選択（任意）
6. 必要に応じて1回振り直し可能

### 2. 管理者としての利用

1. 右上の「管理画面」をクリック
2. 「新規イベント作成」でイベント作成
3. 申込期限が来たら「抽選実行」
4. 「結果表示」で順位確認
5. 「CSV出力」で参加者リストをダウンロード

## 技術スタック

- **フロントエンド**: Next.js 14 (App Router), React, TypeScript
- **スタイリング**: Tailwind CSS
- **バックエンド**: Next.js API Routes
- **データベース**: SQLite (better-sqlite3)
- **セッション**: iron-session
- **日付処理**: date-fns

## 本番環境デプロイ

### Vercelにデプロイ

```bash
# Vercelにデプロイ
npx vercel

# 環境変数設定（Vercelダッシュボードで）
SESSION_SECRET=your_secret_key_at_least_32_characters
```

**注意**: SQLiteはファイルベースのため、Vercelのような静的ホスティングでは永続化されません。
本番環境ではPostgreSQLなどのクラウドDBへの移行を推奨します。

### VPS/VirtualServerにデプロイ

```bash
# ビルド
npm run build

# 本番起動
npm start
```

## ライセンス

MIT

## 作成者

ラストウォー連盟管理者向けツール
