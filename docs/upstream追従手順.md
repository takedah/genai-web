# フォーク元（upstream）追従手順

本ドキュメントは、フォーク元 [digital-go-jp/genai-web](https://github.com/digital-go-jp/genai-web)（upstream）の更新を本プロジェクトへ取り込む手順と、衝突解決の判断基準をまとめたものです。

## 基本方針

- 取り込みは必ず **正式な `git merge upstream/main`（マージコミット）** で行う。squash マージやパッチ適用は使わない。
  - squash で取り込むと git の履歴上マージが記録されず（merge-base が進まず）、次回以降のマージで解決済みの衝突が再発する。2026-07 に一度この状態になり、履歴修復が必要になった（コミット `a7c0ca2`）。
- **`packages/web`（アプリコード）は upstream と完全一致（差分ゼロ）を維持する。** 挙動を変えたい場合はアプリコードを改変せず、CDK 側で渡す環境変数・パラメータで制御する。
  - 例: SAML 認証の無効化は、CDK 側で `VITE_APP_SAMLAUTH_ENABLED` を渡さないことで実現している（未定義 → フロントエンドはユーザープール認証にフォールバック）。
- CDK の閉域対応は `packages/cdk/lib/construct/closedNetwork/` と `packages/cdk/fargate-s3-server/` に隔離し、upstream ファイルへの直接編集は「呼び出しの差し替え・分岐の追加」程度に留める。

## 手順

### 1. upstream の更新確認

```bash
git fetch upstream
git log --oneline upstream/main --not main
```

何も表示されなければ追従不要。upstream は「Update from private repo」という squash PR 単位で更新される。

### 2. main から作業ブランチを作成してマージ

```bash
git checkout main && git pull origin main
git checkout -b merge-upstream-YYYYMMDD
git merge upstream/main
```

### 3. 衝突解決

衝突が出るのは「前回のマージ以降に upstream と本フォークの両方が変更したファイル」だけ。

- **`packages/web`**: 原則衝突しない（差分ゼロのため自動マージされる）。衝突したら upstream 版を採用する。解決後に以下が **空になること** を確認する。

  ```bash
  git diff upstream/main -- packages/web
  ```

- **`packages/cdk/lib` 配下**: 本フォークの閉域対応（`vpc` / `lambdaVpcProps` / `closedWeb` など）を維持しつつ、upstream の新規追加を取り込む。
- **upstream が新しい Lambda を追加した場合**: 閉域方針に合わせ、`lambdaVpcProps` パターン（`vpc` + `PRIVATE_ISOLATED` サブネット配置。`lib/construct/api.ts` 参照）を適用する。
- どちらの変更か迷ったら、前回マージ時点からの差分を両側で確認する。

  ```bash
  MB=$(git merge-base HEAD upstream/main)
  git diff $MB HEAD -- <file>           # フォーク側の変更
  git diff $MB upstream/main -- <file>  # upstream 側の変更
  ```

### 4. 依存関係の更新

`package.json` が変わっていた場合は lockfile を更新する。

```bash
npm install
```

### 5. 検証

**必ず Node 22.22.2（`mise.toml` / `engines` の指定バージョン）で実行すること。** Node 26 などで web テストを実行すると、Node 本体の実験的 `localStorage` グローバルが jsdom のものを覆い隠し、コードと無関係に大量失敗する。

```bash
npm run cdk:test
npm run web:test
npm run common:test

# packages/cdk で
npx tsc --noEmit
CDK_DEFAULT_ACCOUNT=123456789012 npx cdk synth --all --quiet --context env=-selfHostingProd

# リポジトリルートで
npm run web:build
```

### 6. コミット・main へのマージ・後片付け

```bash
git commit   # マージコミット。取り込んだ内容と採否の判断を本文に書いておくと次回の参考になる
git checkout main
git merge merge-upstream-YYYYMMDD   # fast-forward で良い
git push origin main
git branch -d merge-upstream-YYYYMMDD
```

PR レビューを挟む場合は、`git push origin merge-upstream-YYYYMMDD` してから PR を作成し、マージ後にブランチを削除する。

## 差分の意図台帳（upstream から意図的に変えている点）

衝突解決やレビューの際は、以下に該当するかで採否を判断する。

### 不採用の機能（upstream 側で変更が来ても取り込まない）

| 機能 | 理由 |
|---|---|
| SAML 認証（`samlAuthEnabled` ほか関連スキーマ・CfnOutput） | 閉域構成では Cognito Hosted UI が使えない。web 側コードは upstream のまま、環境変数を渡さないことで無効化 |
| WAF（`allowedIpV4/V6AddressRanges`、`allowedCountryCodes`） | CloudFront を使わない閉域構成では不要。SG と VPC エンドポイントポリシーで制御 |
| CloudFront カスタムドメイン（`useHostedZone` / `hostName` / `domainName` / `certificateArn`） | 閉域では内部 ALB + Private Hosted Zone を使用（`closedNetworkDomainName` ほか） |
| Bedrock Flows（`flows`） | 未使用のため。Bedrock Agents Classic 削除（2026-07）と同方針 |
| `vpcIdForInvokeExApp` / `invoke-exapp-lambda-vpc` による専用 VPC | 全 Lambda を閉域 VPC（`ClosedVpc`）内に配置するため不要 |
| `RetrieveKnowledgeBaseRequest` 型（`packages/types`） | 参照箇所がなく、Bedrock Agents 系の削除に伴い除去 |
| `transcribe:StartStreamTranscriptionWebSocket` のポリシー付与 | フロントエンドに呼び出し箇所がなく未使用 |

### 削除済みの upstream ファイル（modify/delete 衝突が出たら削除を維持）

- `packages/cdk/lib/app-domain-stack.ts` — フォークが削除したスキーマ項目（カスタムドメイン）に依存するため復活不可
- `packages/cdk/lib/cloud-front-waf-stack.ts` — 同上（WAF）

なお `common-web-acl.ts` と `invoke-exapp-lambda-vpc.ts` は依存がないため、衝突回避目的で **未使用のまま残している**（どこからも参照しない）。

### upstream 由来の既知の問題（追従しない・修正もしない）

upstream と同一ファイルを維持するため、以下は放置する（upstream 側で直れば自然に解消）。

- `packages/cdk/lambda/invokeExApp.ts`: `tsc --noEmit` で型エラー（`responseBody: unknown` へのプロパティアクセス）。CI（vitest）には影響しない
- `packages/cdk/lib/construct/bedrock-inference-profiles.ts` / `invoke-exapp-lambda-vpc.ts`: biome lint の警告・エラー。CI の lint 対象外

## 関連ドキュメント

- [閉域ネットワーク対応の変更点](./閉域ネットワーク対応の変更点.md) — 閉域対応で変更した AWS リソースの全体像
- [デプロイ手順](./デプロイ手順.md)
