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
- **upstream が Lambda ランタイム（`Runtime.NODEJS_XX_X`）を上げた場合**: フォーク側で追加した construct にも取りこぼしがないか確認する。バージョンが 1 種類に揃っていれば OK。

  ```bash
  grep -rn 'NODEJS_[0-9]*_X' packages/cdk --include='*.ts' | grep -o 'NODEJS_[0-9]*_X' | sort | uniq -c
  ```

  `packages/cdk/fargate-s3-server/Dockerfile` のベースイメージ（`node:XX-slim`）はフォーク独自ファイルなので自動では追随しない。**Lambda ランタイムと同じメジャーバージョンに手動で合わせる**（ビルド／実行の 2 ステージとも）。併せて `docs/閉域ネットワーク対応の変更点.md` のベースイメージの記述も更新すること。変更すると次回 `cdk deploy` でコンテナイメージが再ビルドされる。
- どちらの変更か迷ったら、前回マージ時点からの差分を両側で確認する。

  ```bash
  MB=$(git merge-base HEAD upstream/main)
  git diff $MB HEAD -- <file>           # フォーク側の変更
  git diff $MB upstream/main -- <file>  # upstream 側の変更
  ```

### 4. ツールチェーン（Node / npm）の更新

upstream は Node / npm の指定バージョンも上げてくる（`.node-version` / `mise.toml` / `package.json` の `engines` / `.github/*.yaml.example`）。`engineStrict: true` のため、指定と違うバージョンでは `npm install` 自体が失敗する。マージ後に必ずローカルのツールチェーンを入れ直す。

```bash
git diff HEAD^ HEAD -- .node-version mise.toml package.json   # バージョン変更の有無を確認
mise install                                                  # mise.toml のバージョンを導入
node -v && npm -v                                             # mise.toml と一致することを確認
```

### 5. 依存関係の更新

`package.json` が変わっていた場合は lockfile を更新する。

```bash
npm install
git status --porcelain package-lock.json   # 差分が出なければ upstream の lockfile と整合している
```

### 6. 検証

**必ず `mise.toml` / `engines` の指定バージョンの Node で実行すること。** 指定より新しい Node（Node 26 など）で web テストを実行すると、Node 本体の実験的 `localStorage` グローバルが jsdom のものを覆い隠し、コードと無関係に大量失敗する。

```bash
npm run cdk:test
npm run web:test
npm run common:test

# packages/cdk で
npx tsc --noEmit
CDK_DEFAULT_ACCOUNT=123456789012 npx cdk synth --all --quiet --context env=-selfHostingProd

# リポジトリルートで
npm run web:build

# packages/web が upstream と完全一致していること（何も出力されなければ OK）
git diff upstream/main -- packages/web
```

マージでテンプレートが変わると `tests/stacks.snapshot.test.ts` が落ちる。**これは想定どおり**で、差分こそがレビュー対象になる。内容を確認して意図した変更であれば更新する。

```bash
# packages/cdk で。差分を確認してから更新する
npx vitest run tests/stacks.snapshot.test.ts   # 差分を表示
npx vitest run tests/stacks.snapshot.test.ts -u # 妥当と判断したら更新
```

想定外のリソースが増減していないか（インターネット向けリソースが復活していないか、Lambda が VPC 外に出ていないか等）をここで確認する。

`npx tsc --noEmit` と `npm run cdk:lint` はマージ前から失敗している（[upstream 由来の既知の問題](#upstream-由来の既知の問題追従しない修正もしない)）。**新しく増えていないこと** を確認できれば良い。判断に迷ったら、マージ前のコミットを別 worktree に取り出して同じコマンドを流し、件数を比較する。

```bash
git worktree add /tmp/pre-merge <マージ前のコミット>
(cd /tmp/pre-merge/packages/cdk && npx biome lint lib lambda --reporter=summary)
git worktree remove /tmp/pre-merge --force
```

> **`npm run web:format` / `npm run web:format:test` は実行しない。** 名前に反して中身は `biome format --write` で、upstream の web 配下のファイルを書き換えてしまい「`packages/web` は差分ゼロ」の方針が壊れる。誤って実行したら `git checkout -- packages/web` で戻す。

### 7. コミット・main へのマージ・後片付け

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

upstream と同一ファイルを維持するため、以下は放置する（upstream 側で直れば自然に解消）。いずれもマージ前から発生しているもので、追従作業では **件数が増えていないこと** だけを確認する。

- `packages/cdk/lambda/invokeExApp.ts`: `npx tsc --noEmit` で型エラー 3 件（`responseBody: unknown` へのプロパティアクセス）。テスト（vitest）とデプロイには影響しない
- `npm run cdk:lint`（`biome lint lib && biome lint lambda`）はエラーで終了する。2026-09 時点でエラー 4 件・警告 50 件・info 6 件。エラーの内訳は `lambda/createMessages.ts` の `noControlCharactersInRegex` 2 件、`lambda/utils/bedrockApi.ts` の `noImplicitAnyLet` 1 件、`lambda/utils/models.ts` の `noDoubleEquals` 1 件で、すべて upstream 由来のファイル。GitHub Actions の CI（`.github/genai-ci-cdk.yaml.example`）は lint を実行しないため、デプロイはブロックされない

## 取り込み履歴

| 日付 | upstream | 取り込み内容 | 備考 |
|---|---|---|---|
| 2026-07-06 | PR #31 | — | squash で取り込んでいた履歴を修復（`a7c0ca2`）。Bedrock Agents Classic の依存を削除 |
| 2026-09-12 | PR #43（`v1.3.12`） | Node 24.18.0 / npm 12.0.1 への更新、Lambda ランタイム `NODEJS_24_X` 化、`appEnv` のバリデーション強化、`validationErrorMessage` ユーティリティ追加、依存パッケージ更新（jsdom 30 / biome 2.5.7 ほか） | 衝突なしで自動マージ。`packages/web` は差分ゼロを維持 |

## 関連ドキュメント

- [閉域ネットワーク対応の変更点](./閉域ネットワーク対応の変更点.md) — 閉域対応で変更した AWS リソースの全体像
- [デプロイ手順](./デプロイ手順.md)
