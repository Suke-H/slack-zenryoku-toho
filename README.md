# slack-zenryoku-toho

Slackチャンネルで `@bot 筋トレしたよ` と送るだけで活動を記録するBot。
データはSlack Canvasに保存するのでサーバー側にDBは不要。

---

## フォルダ構成

```
.
├── src/
│   ├── index.ts        # 起動・Slack Boltのルーティング
│   ├── types.ts        # 型定義
│   ├── canvas.ts       # Canvas読み書き・データのパース/シリアライズ
│   └── handler.ts      # メッセージ解釈・記録・閲覧ロジック
├── terraform/
│   ├── main.tf         # GCPリソース定義（WIF・SA・Artifact Registry）
│   ├── variables.tf    # 変数定義
│   ├── outputs.tf      # GitHub Secretsに設定する値の出力
│   └── terraform.tfvars.example
├── .github/
│   └── workflows/
│       └── deploy.yml  # mainブランチpush時にCloud Runへ自動デプロイ
├── Dockerfile          # Cloud Run用（マルチステージビルド）
├── package.json
├── tsconfig.json
└── .env.example
```

---

## データ形式

Slack Canvas 1枚にプレーンテキストで保存する。

```
1: 筋トレ
2: 掃除

202605
- 1 12 2 - -
```

- 上部：活動マスタ（番号: 名前）
- 下部：年月ブロック、スペース区切りで日付ごとの活動番号
- 同日複数活動は番号を連結（例: `12` = 筋トレ+掃除）
- 活動なしは `-`

---

## 使い方

**記録**
```
@bot 筋トレしたよ         → 即記録（今月3回目）
@bot ランニングした       → 未登録なら登録確認 → はい/いいえ
```

**閲覧**
```
@bot 今月見せて
@bot 先月見せて
@bot 4月見せて
@bot 先週の筋トレ見せて
```

---

## セットアップ

### 1. Slack App作成

1. https://api.slack.com/apps → **Create New App** → From scratch
2. **OAuth & Permissions** → Bot Token Scopes に以下を追加：
   ```
   canvases:read
   canvases:write
   chat:write
   app_mentions:read
   channels:history
   ```
3. **Install to Workspace** → `Bot User OAuth Token`（`xoxb-...`）をコピー
4. **Basic Information** → `Signing Secret` をコピー
5. **Event Subscriptions** → Enable → Subscribe to bot events：
   ```
   app_mention
   ```
   Request URL は後でCloud RunのURLが発行されてから設定する

### 2. Secret Managerに環境変数を登録

```bash
echo -n "xoxb-..." | gcloud secrets create SLACK_BOT_TOKEN --data-file=-
echo -n "your-signing-secret" | gcloud secrets create SLACK_SIGNING_SECRET --data-file=-
```

### 3. Terraformでインフラ構築

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars を自分の値で編集

terraform init
terraform plan
terraform apply
```

`apply`完了後に出力される値を GitHub の Settings → Secrets → Actions に登録する：

| Secret名 | 値 |
|---|---|
| `PROJECT_ID` | 出力の `PROJECT_ID` |
| `SA_EMAIL` | 出力の `SA_EMAIL` |
| `WIF_PROVIDER` | 出力の `WIF_PROVIDER` |
| `ARTIFACT_REGISTRY_REPO_NAME` | 出力の `ARTIFACT_REGISTRY_REPO_NAME` |

### 4. ローカル起動（動作確認）

```bash
npm install
cp .env.example .env
# .env に SLACK_BOT_TOKEN と SLACK_SIGNING_SECRET を記入
npm run dev
```

### 5. デプロイ

`main`ブランチにpushすると `.github/workflows/deploy.yml` が自動でCloud Runにデプロイする。

デプロイ後に発行されるCloud RunのURLをSlack AppのRequest URLに設定する：
```
https://<Cloud RunのURL>/slack/events
```

---

## 注意事項

- Canvas APIはフリープランでも使えるが、チャンネルごとに1枚のみ
- `pending`（yes/no待ち状態）はメモリ管理のためCloud Runの再起動でリセットされる。再度メッセージを送れば再開できる
- 環境変数はSecret Manager経由でCloud Runに渡しているため、`.env`はローカル専用
