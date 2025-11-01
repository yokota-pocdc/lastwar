# Nginx リバースプロキシ & SSL 設定ガイド

## 環境
- OS: Amazon Linux 2023
- アプリケーションディレクトリ: `/home/ec2-user/lastwar`
- Node.jsアプリポート: `3000`

---

## 📋 前提条件

1. ✅ ドメイン名を取得済み（例: `example.com`）
2. ✅ DNSレコードでドメインをサーバーのIPアドレスに向けている
3. ✅ ポート80/443がセキュリティグループで開放されている

### セキュリティグループの確認

AWS EC2コンソール → セキュリティグループ → インバウンドルール

必要なルール:
```
HTTP  (80)   → 0.0.0.0/0
HTTPS (443)  → 0.0.0.0/0
SSH   (22)   → あなたのIP
```

---

## 🚀 セットアップ手順

### ステップ1: Nginxのインストール

```bash
# Nginxをインストール
sudo dnf install -y nginx

# Nginxを起動
sudo systemctl start nginx

# 自動起動を有効化
sudo systemctl enable nginx

# ステータス確認
sudo systemctl status nginx
```

**確認:** ブラウザで `http://あなたのサーバーIP` にアクセスし、Nginxのウェルカムページが表示されればOK

---

### ステップ2: Nginxの設定ファイルを作成

```bash
# 設定ファイルを作成
sudo nano /etc/nginx/conf.d/lastwar.conf
```

以下を貼り付け（**your-domain.com を実際のドメインに置き換える**）:

```nginx
# HTTP (ポート80) - 後でHTTPSにリダイレクトします
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    # アクセスログ
    access_log /var/log/nginx/lastwar-access.log;
    error_log /var/log/nginx/lastwar-error.log;

    # Node.jsアプリへプロキシ
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # タイムアウト設定
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

保存して終了: `Ctrl + X` → `Y` → `Enter`

---

### ステップ3: 設定をテスト

```bash
# 設定ファイルの文法チェック
sudo nginx -t

# 期待される出力:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

---

### ステップ4: Nginxを再起動

```bash
sudo systemctl restart nginx
```

**確認:** ブラウザで `http://your-domain.com` にアクセスし、アプリが表示されればOK

---

### ステップ5: SSL証明書の取得（Let's Encrypt）

#### 5-1. Certbotのインストール

```bash
# EPELリポジトリを有効化
sudo dnf install -y epel-release

# Certbotとnginxプラグインをインストール
sudo dnf install -y certbot python3-certbot-nginx
```

#### 5-2. SSL証明書を取得

```bash
# 証明書を取得（your-domain.comを実際のドメインに置き換える）
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

**対話形式の質問:**

1. **メールアドレスを入力**: SSL証明書の更新通知用
2. **利用規約に同意**: `Y`
3. **メールリストへの登録**: `N`（任意）
4. **HTTPトラフィックのリダイレクト**: `2`（すべてHTTPSにリダイレクト）を選択

成功すると以下のメッセージが表示されます:
```
Congratulations! You have successfully enabled HTTPS on https://your-domain.com
```

---

### ステップ6: 自動更新の設定

Let's Encryptの証明書は90日で期限切れになるため、自動更新を設定します。

```bash
# 自動更新のテスト（実際には更新しない）
sudo certbot renew --dry-run

# 成功すればOK
```

**自動更新タイマーの確認:**
```bash
# タイマーが有効か確認
sudo systemctl list-timers | grep certbot

# 自動更新タイマーを有効化（Amazon Linux 2023では既定で有効）
sudo systemctl enable certbot-renew.timer
sudo systemctl start certbot-renew.timer
```

---

## 🎉 完了！

以下のURLでアクセスできます:
- **HTTP**: `http://your-domain.com` → 自動的にHTTPSにリダイレクト
- **HTTPS**: `https://your-domain.com` ✅

---

## 🔧 Nginxの最終設定（Certbot適用後）

Certbotが自動的に設定を書き換えます。確認してみましょう:

```bash
sudo cat /etc/nginx/conf.d/lastwar.conf
```

以下のような内容になっているはずです:

```nginx
server {
    server_name your-domain.com www.your-domain.com;

    access_log /var/log/nginx/lastwar-access.log;
    error_log /var/log/nginx/lastwar-error.log;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = www.your-domain.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    if ($host = your-domain.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;
    return 404; # managed by Certbot
}
```

---

## 🛠️ 便利なコマンド

### Nginxの管理

```bash
# 設定をリロード（ダウンタイムなし）
sudo systemctl reload nginx

# 再起動
sudo systemctl restart nginx

# 停止
sudo systemctl stop nginx

# 起動
sudo systemctl start nginx

# ステータス確認
sudo systemctl status nginx

# エラーログを確認
sudo tail -f /var/log/nginx/lastwar-error.log

# アクセスログを確認
sudo tail -f /var/log/nginx/lastwar-access.log
```

### SSL証明書の管理

```bash
# 証明書の情報を表示
sudo certbot certificates

# 手動で更新
sudo certbot renew

# 特定のドメインのみ更新
sudo certbot renew --cert-name your-domain.com

# 証明書を削除
sudo certbot delete --cert-name your-domain.com
```

---

## ⚠️ トラブルシューティング

### 問題1: 502 Bad Gateway

**原因:** Node.jsアプリが起動していない

**解決:**
```bash
# PM2のステータス確認
pm2 status

# アプリが停止している場合
pm2 start npm --name "lastwar" -- start

# または再起動
pm2 restart lastwar
```

---

### 問題2: ERR_SSL_PROTOCOL_ERROR

**原因:** SSL証明書が正しく設定されていない

**解決:**
```bash
# Nginx設定を確認
sudo nginx -t

# Nginxを再起動
sudo systemctl restart nginx

# SSL証明書を確認
sudo certbot certificates
```

---

### 問題3: セキュリティグループでポート80/443が開いていない

**解決:**
1. AWS EC2コンソールを開く
2. インスタンスのセキュリティグループを選択
3. インバウンドルールを編集
4. HTTP (80) と HTTPS (443) を `0.0.0.0/0` から許可

---

### 問題4: ドメインがサーバーIPを向いていない

**確認:**
```bash
# DNSを確認
nslookup your-domain.com

# またはdigコマンド
dig your-domain.com +short
```

サーバーのIPアドレスが表示されればOK

---

## 🔒 セキュリティ強化（オプション）

### ファイアウォール設定

```bash
# firewalldをインストール（必要に応じて）
sudo dnf install -y firewalld
sudo systemctl start firewalld
sudo systemctl enable firewalld

# HTTP/HTTPSを許可
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### SSLの強化

`/etc/nginx/conf.d/lastwar.conf` に以下を追加:

```nginx
# HTTPSセクション内に追加
server {
    ...

    # セキュリティヘッダー
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    ...
}
```

適用:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## ✅ 完了チェックリスト

- [ ] Nginxがインストールされ起動している
- [ ] リバースプロキシが動作している（HTTPでアクセス可能）
- [ ] SSL証明書が取得できた
- [ ] HTTPSでアクセス可能
- [ ] HTTPが自動的にHTTPSにリダイレクトされる
- [ ] 証明書の自動更新が設定されている
- [ ] ログが正常に記録されている

---

## 📚 参考情報

- [Nginx公式ドキュメント](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Certbot](https://certbot.eff.org/)

---

お疲れ様でした！これで本番環境の準備が完了です 🎉
