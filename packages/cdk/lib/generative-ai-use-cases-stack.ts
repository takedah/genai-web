import * as cdk from 'aws-cdk-lib';
import { Aspects, CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { PrivateHostedZone } from 'aws-cdk-lib/aws-route53';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import {
  Api,
  Auth,
  BedrockInferenceProfiles,
  ClosedWeb,
  Database,
  Monitoring,
  Transcribe,
  Web,
} from './construct';
import { EncryptionKey } from './construct/kms';
import { LoggingStack } from './logging-stack';
import { StackInput } from './stack-input';
import { TeamAccessControlStack } from './team-access-control-stack';

export interface GenerativeAiUseCasesStackProps extends StackProps {
  params: StackInput;
  // Closed Network resources (created by ClosedNetworkStack)
  vpc: ec2.IVpc;
  apiGatewayVpcEndpoint: ec2.InterfaceVpcEndpoint;
  hostedZone?: PrivateHostedZone;
  // Guardrail
  guardrailIdentifier?: string;
  guardrailVersion?: string;
}

export class GenerativeAiUseCasesStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly encryptionKey: kms.IKey;

  constructor(scope: Construct, id: string, props: GenerativeAiUseCasesStackProps) {
    super(scope, id, props);
    process.env.overrideWarningsEnabled = 'false';

    const params = props.params;

    // KMS Key for encryption (CMEK)
    const encryptionKey = new EncryptionKey(this, 'EncryptionKey', {
      appEnv: params.appEnv,
    });
    this.encryptionKey = encryptionKey.key;

    // Auth
    const auth = new Auth(this, 'Auth', {
      encryptionKey: encryptionKey.key,
      vpc: props.vpc,
      selfSignUpEnabled: params.selfSignUpEnabled,
      allowedSignUpEmailDomains: params.allowedSignUpEmailDomains,
      customEmailSender: params.customEmailSender ?? null,
      emailMfaRequired: params.emailMfaRequired,
      reauthenticationIntervalDays: params.reauthenticationIntervalDays,
      appEnv: params.appEnv,
    });

    // Database
    const database = new Database(this, 'Database', {
      encryptionKey: encryptionKey.key,
      removalPolicy:
        params.databaseRemovalPolicy === 'RETAIN'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
    });
    database.table.tableName;

    // Bedrock Inference Profiles for cost allocation tagging
    // Creates Application Inference Profiles with Environment tags for each model
    const inferenceProfiles = params.appEnv
      ? new BedrockInferenceProfiles(this, 'BedrockInferenceProfiles', {
          modelIds: params.modelIds,
          imageGenerationModelIds: params.imageGenerationModelIds,
          modelRegion: params.modelRegion,
          appEnv: params.appEnv,
        })
      : null;

    // API
    const api = new Api(this, 'API', {
      encryptionKey: encryptionKey.key,
      vpc: props.vpc,
      apiGatewayVpcEndpoint: props.apiGatewayVpcEndpoint,
      modelRegion: params.modelRegion,
      modelIds: params.modelIds,
      imageGenerationModelIds: params.imageGenerationModelIds,
      endpointNames: params.endpointNames,
      crossAccountBedrockRoleArn: params.crossAccountBedrockRoleArn,
      s3FileExpirationDays: params.dataRetentionDays.s3FileExpiration,
      dynamoDbTtlDays: params.dataRetentionDays.dynamoDbTtl,

      // Inference Profile mappings for cost allocation tagging
      inferenceProfileMap: inferenceProfiles?.profileMapping,
      imageInferenceProfileMap: inferenceProfiles?.imageProfileMapping,

      userPool: auth.userPool,
      authenticatedRole: auth.authenticatedRole,
      systemAdminRole: auth.systemAdminRole,
      teamAdminRole: auth.teamAdminRole,
      userRole: auth.userRole,
      userPoolClient: auth.client,
      identityPoolId: auth.idPool.ref,
      table: database.table,
      guardrailIdentify: props.guardrailIdentifier,
      guardrailVersion: props.guardrailVersion,
    });
    api.predictStreamFunction.grantInvoke(auth.systemAdminRole);
    api.predictStreamFunction.grantInvoke(auth.teamAdminRole);
    api.predictStreamFunction.grantInvoke(auth.userRole);

    /***
     * GenerativeA IUseCasesStackのリソース数が上限を超えてしまうため、Construct から NestedStackに切り出す
     */
    const teamAccessControl = new TeamAccessControlStack(this, `TeamAccessControlStack`, {
      encryptionKey: encryptionKey.key,
      userPool: auth.userPool,
      identityPoolId: auth.idPool.ref,
      vpc: props.vpc,
      apiGatewayVpcEndpoint: props.apiGatewayVpcEndpoint,
      logLevel: params.logLevel,
      exAppInvokeTimeoutSeconds: params.exAppInvokeTimeoutSeconds,
      s3FileExpirationDays: params.dataRetentionDays.s3FileExpiration,
      dynamoDbTtlDays: params.dataRetentionDays.dynamoDbTtl,
      envName: params.appEnv,
      removalPolicy:
        params.databaseRemovalPolicy === 'RETAIN'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
    });

    // TeamAccessControl API のポリシーを各ロールにアタッチ
    // （NestedStack → 親スタックのロール変更による循環依存を回避するため、親スタックで実施）
    const teamAccessControlApiArn = `arn:aws:execute-api:${this.region}:${this.account}:${teamAccessControl.api.restApiId}/${teamAccessControl.api.deploymentStage.stageName}`;

    // For System Admin Group
    const systemAdminPolicy = new iam.Policy(this, 'TeamAccessControlSystemAdminPolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['execute-api:Invoke'],
          resources: [`${teamAccessControlApiArn}/*/*`],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:GetObject'],
          resources: [
            teamAccessControl.artifactsBucket.arnForObjects(
              '${cognito-identity.amazonaws.com:sub}/*',
            ),
          ],
        }),
      ],
    });
    auth.systemAdminRole.attachInlinePolicy(systemAdminPolicy);

    // For Team Admin Group
    const teamAdminPolicy = new iam.Policy(this, 'TeamAccessControlTeamAdminPolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          actions: ['execute-api:Invoke'],
          resources: [
            `${teamAccessControlApiArn}/POST/teams`,
            `${teamAccessControlApiArn}/DELETE/teams/*`,
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['execute-api:Invoke'],
          resources: [`${teamAccessControlApiArn}/*/*`],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:GetObject'],
          resources: [
            teamAccessControl.artifactsBucket.arnForObjects(
              '${cognito-identity.amazonaws.com:sub}/*',
            ),
          ],
        }),
      ],
    });
    auth.teamAdminRole.attachInlinePolicy(teamAdminPolicy);

    // For User Group
    const userPolicy = new iam.Policy(this, 'TeamAccessControlUserPolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          actions: ['execute-api:Invoke'],
          resources: [`${teamAccessControlApiArn}/*/teams/*`],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['execute-api:Invoke'],
          resources: [`${teamAccessControlApiArn}/*/*`],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:GetObject'],
          resources: [
            teamAccessControl.artifactsBucket.arnForObjects(
              '${cognito-identity.amazonaws.com:sub}/*',
            ),
          ],
        }),
      ],
    });
    auth.userRole.attachInlinePolicy(userPolicy);

    // cdk-nag suppressions for TeamAccessControl policies
    NagSuppressions.addResourceSuppressions(
      [systemAdminPolicy, teamAdminPolicy, userPolicy],
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'This policy allows a user to access only their own objects in the S3 bucket. The use of the cognito-identity variable requires a wildcard.',
        },
      ],
      true,
    );

    // Prototyping の範囲だけ CDK-NAG を適用します
    Aspects.of(teamAccessControl).add(new AwsSolutionsChecks({ verbose: true }));

    // Closed Network: ALB + ECS Fargate web tier serving static assets from S3
    const closedWeb = new ClosedWeb(this, 'ClosedWeb', {
      vpc: props.vpc,
      hostedZone: props.hostedZone,
      certificateArn: params.closedNetworkCertificateArn,
    });

    const webUrl = props.hostedZone
      ? `https://${props.hostedZone.zoneName}`
      : `http://${closedWeb.alb.loadBalancerDnsName}`;

    new CfnOutput(this, 'WebUrl', { value: webUrl });

    // Web Frontend
    new Web(this, 'Web', {
      appEnv: params.appEnv,
      teamAccessControlApiEndpointUrl: teamAccessControl.api.url, // Added by prototyping
      userPoolId: auth.userPool.userPoolId,
      userPoolClientId: auth.client.userPoolClientId,
      idPoolId: auth.idPool.attrId,
      selfSignUpEnabled: params.selfSignUpEnabled,
      // Backend
      apiEndpointUrl: api.api.url,
      predictStreamFunctionArn: api.predictStreamFunction.functionArn,
      optimizePromptFunctionArn: api.optimizePromptFunction.functionArn,
      modelRegion: api.modelRegion,
      modelIds: api.modelIds,
      imageGenerationModelIds: api.imageGenerationModelIds,
      endpointNames: api.endpointNames,
      // Frontend
      hiddenUseCases: params.hiddenUseCases,
      govais_for_homepage: params.govais_for_homepage,
      govais_for_sidebar: params.govais_for_sidebar,
      // Maintenance Mode
      maintenance: params.maintenance,
      // Closed Network Bucket
      webBucket: closedWeb.bucket,
    });

    // Transcribe
    new Transcribe(this, 'Transcribe', {
      encryptionKey: encryptionKey.key,
      vpc: props.vpc,
      userPool: auth.userPool,
      idPool: auth.idPool,
      authenticatedRole: auth.authenticatedRole,
      api: api.api,
      appEnv: params.appEnv,
    });

    // Logging
    if (params.destination) {
      new LoggingStack(this, `SourceStack${params.env}`, {
        encryptionKey: encryptionKey.key,
        vpc: props.vpc,
        env: {
          account: process.env.CDK_DEFAULT_ACCOUNT,
          region: process.env.CDK_DEFAULT_REGION,
        },
        params,
        // TODO: s3BucketInvocationLog は Bedrock の実行ログを収集しているバケット。
        // 現在はアカウント一つに対して `bedrock-logs-bucket-${this.account}` 一つが紐づいており、
        // スタックごとの設定になっていないため、外部からバケット名を指定する必要がある。
        // この設定方法については今後検討が必要なため、一旦無効化しておく。
        // s3BucketInvocationLog: `bedrock-logs-bucket-${this.account}`
        dynamoTableChatLog: database.table.tableName,
        dynamoTableGovAiLog: teamAccessControl.table.tableName,
        dynamoTableExAppLog: teamAccessControl.exAppTable.tableName,
        dynamoTableInvokeHistoryLog: teamAccessControl.invokeExAppHistoryTable.tableName,
        userPoolId: auth.userPool.userPoolId,
        cognitoLogGroupName: auth.cognitoLogGroupName,
      });
    }

    // Monitoring (CloudWatch Alarms and Slack Notifications)
    if (params.monitoring) {
      new Monitoring(this, 'Monitoring', {
        encryptionKey: encryptionKey.key,
        appEnvName: params.appEnv,
        slackEnabled: params.slack.enabled,
        slackChannelId: params.slack.channelId,
        slackWorkspaceId: params.slack.workspaceId,
      });
    }

    // Cfn Outputs
    new CfnOutput(this, 'Region', {
      value: this.region,
    });

    new CfnOutput(this, 'ApiEndpoint', {
      value: api.api.url,
    });

    new CfnOutput(this, 'TeamAccessControlApiEndpoint', {
      value: teamAccessControl.api.url,
    });

    new CfnOutput(this, 'TeamAccessControlTableName', {
      value: teamAccessControl.table.tableName,
      description: 'Team/TeamUser management DynamoDB table name',
    });

    new CfnOutput(this, 'ExAppTableName', {
      value: teamAccessControl.exAppTable.tableName,
      description: 'ExApp (AI App) definitions DynamoDB table name',
    });

    new CfnOutput(this, 'InvokeExAppHistoryTableName', {
      value: teamAccessControl.invokeExAppHistoryTable.tableName,
      description: 'ExApp invocation history DynamoDB table name',
    });

    new CfnOutput(this, 'UserPoolId', {
      value: auth.userPool.userPoolId,
    });

    new CfnOutput(this, 'UserPoolClientId', {
      value: auth.client.userPoolClientId,
    });

    new CfnOutput(this, 'IdPoolId', { value: auth.idPool.attrId });

    new CfnOutput(this, 'PredictStreamFunctionArn', {
      value: api.predictStreamFunction.functionArn,
    });

    new CfnOutput(this, 'OptimizePromptFunctionArn', {
      value: api.optimizePromptFunction.functionArn,
    });

    new CfnOutput(this, 'SelfSignUpEnabled', {
      value: params.selfSignUpEnabled.toString(),
    });

    new CfnOutput(this, 'ModelRegion', {
      value: api.modelRegion,
    });

    new CfnOutput(this, 'ModelIds', {
      value: JSON.stringify(api.modelIds),
    });

    new CfnOutput(this, 'ImageGenerateModelIds', {
      value: JSON.stringify(api.imageGenerationModelIds),
    });

    new CfnOutput(this, 'EndpointNames', {
      value: JSON.stringify(api.endpointNames),
    });

    new CfnOutput(this, 'HiddenUseCases', {
      value: JSON.stringify(params.hiddenUseCases),
    });

    new CfnOutput(this, 'AppEnv', {
      value: params.appEnv,
    });

    new CfnOutput(this, 'GovaisForHomepage', {
      value: Buffer.from(JSON.stringify(params.govais_for_homepage)).toString('base64'),
    });

    // DynamoDB Table Names
    new CfnOutput(this, 'GenUusecasesTableName', {
      value: database.table.tableName,
      description: 'Chat log DynamoDB table name',
    });

    new CfnOutput(this, 'InvokeExAppTableName', {
      value: teamAccessControl.table.tableName,
      description: 'AI App invocation DynamoDB table name',
    });

    if (auth.customEmailSenderLambdaRoleArn) {
      new CfnOutput(this, 'CustomEmailSenderLambdaRoleArn', {
        value: auth.customEmailSenderLambdaRoleArn,
        description: 'Custom Email Sender Lambda execution role ARN for SES email sending',
      });
    }

    if (auth.sesTenantName) {
      new CfnOutput(this, 'SesTenantName', {
        value: auth.sesTenantName,
        description: 'SES Tenant name for reputation isolation',
      });
    }

    this.userPool = auth.userPool;
    this.userPoolClient = auth.client;
  }
}