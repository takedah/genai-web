import { aws_chatbot as chatbot, Duration } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { FargateService } from 'aws-cdk-lib/aws-ecs';
import {
  ApplicationLoadBalancer,
  ApplicationTargetGroup,
  HttpCodeElb,
  HttpCodeTarget,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface MonitoringProps {
  encryptionKey: kms.IKey;
  appEnvName: string;

  // Slack設定（オプション）
  slackEnabled: boolean;
  slackChannelId?: string;
  slackWorkspaceId?: string;

  // 閉域構成のフロントエンド配信レイヤー（ALB + ECS Fargate）の監視対象（オプション）
  alb?: ApplicationLoadBalancer;
  albTargetGroup?: ApplicationTargetGroup;
  fargateService?: FargateService;
}

const PERIOD_MINUTES = 10;
const THRESHOLD = 3;

export class Monitoring extends Construct {
  public readonly alertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringProps) {
    super(scope, id);

    // CloudWatch Alarms作成
    // 既存のMonitoringStackと同じ設定を移植
    // Note: alarmNameは指定せず、CDKに自動生成させることで名前の重複を回避
    const highErrorRateAlarm = new cloudwatch.Alarm(this, 'ExAppHighErrorRate', {
      alarmDescription:
        `[環境: ${props.appEnvName}] GovAI ExAppでエラーが多発しています！\n` +
        `閾値: ${PERIOD_MINUTES}分間に${THRESHOLD}件以上のエラー\n` +
        '確認事項:\n' +
        '- CloudWatchログでエラー詳細を確認\n' +
        '- 外部API（Gemini等）の稼働状況確認\n' +
        '- ネットワーク接続状況確認\n' +
        '- ExAppエンドポイントの応答確認\n' +
        'メトリクス: GenAI/ExApp/Errors.ExAppErrors',
      metric: new cloudwatch.Metric({
        namespace: `GenAI/ExApp/Errors-${props.appEnvName}`,
        metricName: 'ExAppErrors',
        statistic: cloudwatch.Stats.SUM,
        period: Duration.minutes(PERIOD_MINUTES),
      }),
      threshold: THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const serverErrorAlarm = new cloudwatch.Alarm(this, 'ExAppServerError', {
      alarmDescription:
        `[環境: ${props.appEnvName}] GovAI ExAppでサーバーエラー（5xx）が発生しています!\n` +
        `閾値: ${PERIOD_MINUTES}分間に${THRESHOLD}件以上の5xxエラー\n` +
        '対応方法:\n' +
        '- ExAppサーバーの稼働確認（CPU・メモリ使用率）\n' +
        '- ExAppアプリケーションログの確認\n' +
        '- データベース接続状況の確認\n' +
        '- ExAppのヘルスチェックエンドポイント確認\n' +
        '- 必要に応じてExAppサーバーの再起動\n' +
        'メトリクス: GenAI/ExApp/Errors.ExAppErrors[ErrorType=SERVER_ERROR]',
      metric: new cloudwatch.Metric({
        namespace: `GenAI/ExApp/Errors-${props.appEnvName}`,
        metricName: 'ExAppErrors',
        dimensionsMap: { ErrorType: 'SERVER_ERROR' },
        statistic: cloudwatch.Stats.SUM,
        period: Duration.minutes(PERIOD_MINUTES),
      }),
      threshold: THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const serviceUnavailableAlarm = new cloudwatch.Alarm(this, 'ExAppServiceUnavailable', {
      alarmDescription:
        `[環境: ${props.appEnvName}] GovAI ExAppサービスが利用できません!\n` +
        `閾値: ${PERIOD_MINUTES}分間に${THRESHOLD}件以上の502/503/504エラー\n` +
        '緊急対応が必要:\n' +
        '- ExAppサーバーの即座な確認（プロセス停止？）\n' +
        '- 外部依存サービス（Gemini API等）の障害確認\n' +
        '- ネットワーク接続問題の調査\n' +
        '- ExAppサーバーの緊急再起動検討\n' +
        '- ユーザーへの障害通知準備\n' +
        'メトリクス: GenAI/ExApp/Errors.ExAppErrors[ErrorType=SERVICE_UNAVAILABLE]',
      metric: new cloudwatch.Metric({
        namespace: `GenAI/ExApp/Errors-${props.appEnvName}`,
        metricName: 'ExAppErrors',
        dimensionsMap: { ErrorType: 'SERVICE_UNAVAILABLE' },
        statistic: cloudwatch.Stats.SUM,
        period: Duration.minutes(PERIOD_MINUTES),
      }),
      threshold: THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // SNS Topic作成（Exportしない）
    this.alertTopic = new sns.Topic(this, 'ExAppAlertTopic', {
      masterKey: props.encryptionKey,
    });

    // AlarmsとSNS Topicを接続
    highErrorRateAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
    serverErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
    serviceUnavailableAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));

    // 閉域構成のフロントエンド配信レイヤー（ALB + ECS Fargate）のアラーム
    // CloudFront 廃止に伴い、配信レイヤーの障害検知も自前で行う必要がある
    const webAlarms: cloudwatch.Alarm[] = [];

    if (props.alb) {
      webAlarms.push(
        new cloudwatch.Alarm(this, 'AlbElb5xx', {
          alarmDescription:
            `[環境: ${props.appEnvName}] フロントエンド配信の ALB が 5xx を返しています！\n` +
            '（ELB 自身が生成したエラー。ターゲット全滅・接続失敗など）\n' +
            '確認事項:\n' +
            '- ECS タスクの稼働状況・ヘルスチェック結果\n' +
            '- ALB のターゲットグループの状態',
          metric: props.alb.metrics.httpCodeElb(HttpCodeElb.ELB_5XX_COUNT, {
            statistic: cloudwatch.Stats.SUM,
            period: Duration.minutes(PERIOD_MINUTES),
          }),
          threshold: THRESHOLD,
          evaluationPeriods: 1,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        }),
        new cloudwatch.Alarm(this, 'AlbTarget5xx', {
          alarmDescription:
            `[環境: ${props.appEnvName}] フロントエンド配信サーバーが 5xx を返しています！\n` +
            '確認事項:\n' +
            '- ECS タスク（fargate-s3-server）のログ\n' +
            '- S3（Web バケット）へのアクセス可否・VPC エンドポイントの状態',
          metric: props.alb.metrics.httpCodeTarget(HttpCodeTarget.TARGET_5XX_COUNT, {
            statistic: cloudwatch.Stats.SUM,
            period: Duration.minutes(PERIOD_MINUTES),
          }),
          threshold: THRESHOLD,
          evaluationPeriods: 1,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        }),
      );
    }

    if (props.albTargetGroup) {
      webAlarms.push(
        new cloudwatch.Alarm(this, 'AlbUnhealthyHost', {
          alarmDescription:
            `[環境: ${props.appEnvName}] フロントエンド配信の ECS タスクがヘルスチェックに失敗しています！\n` +
            '確認事項:\n' +
            '- ECS タスク（fargate-s3-server）のログ・再起動状況\n' +
            '- デプロイ直後の場合はサーキットブレーカーによるロールバックの有無',
          metric: props.albTargetGroup.metrics.unhealthyHostCount({
            statistic: cloudwatch.Stats.MAXIMUM,
            period: Duration.minutes(5),
          }),
          threshold: 1,
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          evaluationPeriods: 2,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        }),
      );
    }

    if (props.fargateService) {
      webAlarms.push(
        new cloudwatch.Alarm(this, 'FargateHighCpu', {
          alarmDescription:
            `[環境: ${props.appEnvName}] フロントエンド配信の ECS サービスの CPU 使用率が高止まりしています！\n` +
            '（オートスケール目標 50% を大きく超過。スケールが追いついていない可能性）\n' +
            '確認事項:\n' +
            '- タスク数が maxCapacity（20）に達していないか\n' +
            '- 異常なリクエスト増がないか（ALB アクセスログ）',
          metric: props.fargateService.metricCpuUtilization({
            period: Duration.minutes(PERIOD_MINUTES),
          }),
          threshold: 80,
          evaluationPeriods: 1,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        }),
      );
    }

    for (const alarm of webAlarms) {
      alarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
    }

    // Slack設定がある場合のみChatbot作成
    if (props.slackEnabled && props.slackChannelId && props.slackWorkspaceId) {
      new chatbot.SlackChannelConfiguration(this, 'SlackChannel', {
        slackChannelConfigurationName: `monitoring-chatbot-alert-${props.appEnvName}`,
        slackChannelId: props.slackChannelId,
        slackWorkspaceId: props.slackWorkspaceId,
        notificationTopics: [this.alertTopic],
      });
    }
  }
}
