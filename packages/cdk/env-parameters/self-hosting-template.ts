import { StackInput } from '../lib/stack-input';

/**
 * 環境設定パラメータテンプレート
 *
 * 本フォークは閉域網（VPC + Private API + ALB+ECS Fargate Web）専用構成です。
 * インターネット公開コンポーネント（CloudFront、WAF、SAML、IP 許可リスト 等）は
 * 削除されています。
 *
 * 使用方法:
 * 1. このファイルをコピーして新しい環境設定ファイルを作成してください
 * 2. 各設定項目を自分の環境に合わせて変更してください
 * 3. センシティブな情報（認証情報、IPアドレスなど）は適切に管理してください
 */

export const selfHostingTemplateParams: Partial<StackInput> = {
  // ============================================================================
  // 基本設定
  // ============================================================================

  /**
   * 環境名
   * 必須: Yes
   * 例: 'prd', 'stg', 'dev'
   * この値はリソース名のプレフィックスとして使用されます
   */
  appEnv: 'your-environment-name',

  /**
   * ログレベル
   * オプション
   * 許可される値: 'DEBUG', 'INFO', 'WARN', 'ERROR'
   * デフォルト: 'INFO'
   */
  logLevel: 'INFO',

  // ============================================================================
  // Closed Network 設定（必須）
  // ============================================================================

  /**
   * 新規 VPC の CIDR
   * オプション
   * デフォルト: '10.1.0.0/16'
   */
  closedNetworkVpcCidr: '10.1.0.0/16',

  /**
   * Private Hosted Zone のドメイン名
   * 必須: Yes
   * ALB + ACM + Route53 で HTTPS を提供するために使用します
   * 例: 'genai.example.internal'
   */
  closedNetworkDomainName: 'genai.example.internal',

  /**
   * ACM 証明書 ARN
   * 必須: Yes
   * 注意: アプリのリージョン（modelRegion と同じ）で発行された証明書を指定してください。
   * us-east-1 ではありません（CloudFront を使わないため）。
   */
  closedNetworkCertificateArn:
    'arn:aws:acm:ap-northeast-1:123456789012:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',

  /**
   * 既存の Private Hosted Zone ID（任意）
   * オプション
   * 指定した場合は既存の Hosted Zone を利用し、ALB の A レコードはユーザーが
   * 別途作成してください。指定しなければスタックが新規 PrivateHostedZone を作成します。
   */
  // closedNetworkPrivateHostedZoneId: 'Z1234567890ABC',

  // ============================================================================
  // 認証設定
  // ============================================================================

  /**
   * セルフサインアップ有効化
   * オプション
   * デフォルト: false
   */
  selfSignUpEnabled: false,

  /**
   * サインアップ許可メールドメイン
   * オプション
   * デフォルト: null (全てのドメインを許可)
   */
  // allowedSignUpEmailDomains: ['example.go.jp'],

  /**
   * カスタムメール送信設定（Same-Account SES + Tenant）
   * オプション
   * 同一アカウントの検証済み SES Domain Identity を利用してメールを送信します。
   * SES は VPC エンドポイント経由で到達可能です。
   */
  // customEmailSender: {
  //   sesIdentityName: 'example.go.jp',
  //   fromAddress: 'noreply@example.go.jp',
  // },

  /**
   * Email MFA 必須化
   * オプション
   * デフォルト: false
   */
  // emailMfaRequired: true,

  /**
   * 再認証間隔（日数）
   * オプション
   * デフォルト: 7日
   * 設定可能範囲: 1〜365日
   */
  // reauthenticationIntervalDays: 7,

  // ============================================================================
  // フロントエンド設定
  // ============================================================================

  /**
   * 非表示ユースケース
   * オプション
   */
  // hiddenUseCases: {
  //   generate: false,    // テキスト生成
  //   translate: false,   // 翻訳
  //   image: false,       // 画像生成
  //   diagram: false,     // ダイアグラム生成
  // },

  /**
   * ホームページ用おすすめGovAI情報
   */
  govais_for_homepage: [
    // {
    //   title: 'サンプルアプリ',
    //   teamId: '00000000-0000-0000-0000-000000000000' as const,
    //   exAppId: 'your-app-id-here',
    //   description: 'このアプリの説明をここに記載',
    // },
  ],

  /**
   * サイドバー用おすすめGovAI情報
   */
  govais_for_sidebar: [
    // {
    //   title: 'サンプルアプリ',
    //   teamId: '00000000-0000-0000-0000-000000000000' as const,
    //   exAppId: 'your-app-id-here',
    // },
  ],

  // ============================================================================
  // モデル設定
  // ============================================================================

  /**
   * モデルリージョン
   * Closed Network ではアプリリージョンと同一でなければなりません。
   */
  modelRegion: 'ap-northeast-1',

  /**
   * モデルID一覧
   */
  modelIds: [
    'amazon.nova-lite-v1:0',
    'jp.anthropic.claude-haiku-4-5-20251001-v1:0',
    'jp.anthropic.claude-sonnet-4-5-20250929-v1:0',
  ],

  /**
   * 画像生成モデルID一覧
   */
  imageGenerationModelIds: ['amazon.nova-canvas-v1:0'],

  // ============================================================================
  // 監視設定
  // ============================================================================

  /**
   * 監視有効化
   * デフォルト: true
   */
  monitoring: true,

  /**
   * Slack通知設定
   */
  // slack: {
  //   enabled: false,
  //   workspaceId: 'T01234567',      // Slack Workspace ID
  //   channelId: 'C01234567',        // Slack Channel ID
  // },

  // ============================================================================
  // メンテナンスモード
  // ============================================================================

  /**
   * メンテナンスモード有効化
   * デフォルト: false
   */
  // maintenance: true
};