#!/bin/bash
# ステージング環境起動スクリプト
# 使用方法: ./start-staging.sh

# ステージング用のポート（本番と異なるポートを使用）
STAGING_PORT=3001

# ステージング用のデータベースファイル（本番と分離する場合）
export DATABASE_PATH="./data/staging.db"

# basePathを/stageに設定
export NEXT_PUBLIC_BASE_PATH="/stage"

# ビルド（初回または変更があった場合）
echo "Building staging environment..."
npm run build

# 起動
echo "Starting staging server on port $STAGING_PORT..."
PORT=$STAGING_PORT npm run start
