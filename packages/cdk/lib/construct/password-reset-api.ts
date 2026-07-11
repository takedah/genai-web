import type { PasswordPolicySettings } from '@genai-web/common';
import { Duration, Stack } from 'aws-cdk-lib';
import {
  AuthorizationType,
  CfnStage,
  LambdaIntegration,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export interface PasswordResetApiProps {
  api: RestApi;
  // Closed Network
  vpc: ec2.IVpc;
  passwordResetTable: Table;
  emailHashIndexName: string;
  userPool: UserPool;
  sesIdentityName: string;
  sesFromAddress: string;
  sesConfigurationSetName?: string;
  sesTenantName?: string;
  passwordPolicy: PasswordPolicySettings;
}

export class PasswordResetApi extends Construct {
  readonly requestPasswordResetFunction: NodejsFunction;
  readonly completePasswordResetFunction: NodejsFunction;

  constructor(scope: Construct, id: string, props: PasswordResetApiProps) {
    super(scope, id);

    // 全 Lambda 共通の VPC 設定（Closed Network 環境）
    const lambdaVpcProps: Pick<NodejsFunctionProps, 'vpc' | 'vpcSubnets'> = {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    };

    const commonEnvironment = {
      PASSWORD_RESET_TABLE_NAME: props.passwordResetTable.tableName,
      EMAIL_HASH_INDEX_NAME: props.emailHashIndexName,
      USER_POOL_ID: props.userPool.userPoolId,
      SES_FROM_ADDRESS: props.sesFromAddress,
      SES_TENANT_NAME: props.sesTenantName ?? '',
      PASSWORD_POLICY: JSON.stringify(props.passwordPolicy),
      ...(props.sesConfigurationSetName
        ? { SES_CONFIGURATION_SET_NAME: props.sesConfigurationSetName }
        : {}),
    };

    const requestPasswordResetFunction = new NodejsFunction(this, 'RequestPasswordReset', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/requestPasswordReset.ts',
      timeout: Duration.seconds(15),
      ...lambdaVpcProps,
      environment: {
        ...commonEnvironment,
      },
    });
    this.requestPasswordResetFunction = requestPasswordResetFunction;

    const completePasswordResetFunction = new NodejsFunction(this, 'CompletePasswordReset', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/completePasswordReset.ts',
      timeout: Duration.seconds(15),
      ...lambdaVpcProps,
      environment: commonEnvironment,
    });
    this.completePasswordResetFunction = completePasswordResetFunction;

    const passwordResetTableArn = props.passwordResetTable.tableArn;
    const emailHashIndexArn = `${passwordResetTableArn}/index/${props.emailHashIndexName}`;
    requestPasswordResetFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['dynamodb:PutItem', 'dynamodb:DeleteItem'],
        resources: [passwordResetTableArn],
      }),
    );
    requestPasswordResetFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['dynamodb:Query'],
        resources: [passwordResetTableArn, emailHashIndexArn],
      }),
    );
    props.passwordResetTable.encryptionKey?.grantEncryptDecrypt(requestPasswordResetFunction);
    requestPasswordResetFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['cognito-idp:ListUsers'],
        resources: [props.userPool.userPoolArn],
      }),
    );

    completePasswordResetFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['dynamodb:DeleteItem', 'dynamodb:UpdateItem'],
        resources: [passwordResetTableArn],
      }),
    );
    completePasswordResetFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['dynamodb:Query'],
        resources: [passwordResetTableArn, emailHashIndexArn],
      }),
    );
    props.passwordResetTable.encryptionKey?.grantEncryptDecrypt(completePasswordResetFunction);
    completePasswordResetFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminUserGlobalSignOut',
          'cognito-idp:AdminGetUser',
        ],
        resources: [props.userPool.userPoolArn],
      }),
    );

    const createSesSendEmailPolicy = () =>
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['ses:SendEmail'],
        resources: [
          `arn:aws:ses:${Stack.of(this).region}:${Stack.of(this).account}:identity/${props.sesIdentityName}`,
          ...(props.sesConfigurationSetName
            ? [
                `arn:aws:ses:${Stack.of(this).region}:${Stack.of(this).account}:configuration-set/${props.sesConfigurationSetName}`,
              ]
            : []),
        ],
        conditions: {
          StringEquals: {
            'ses:FromAddress': props.sesFromAddress,
          },
        },
      });
    requestPasswordResetFunction.addToRolePolicy(createSesSendEmailPolicy());
    completePasswordResetFunction.addToRolePolicy(createSesSendEmailPolicy());

    props.api.root
      .resourceForPath('/auth/password-reset/request')
      .addMethod('POST', new LambdaIntegration(requestPasswordResetFunction), {
        authorizationType: AuthorizationType.NONE,
      });
    props.api.root
      .resourceForPath('/auth/password-reset/complete')
      .addMethod('POST', new LambdaIntegration(completePasswordResetFunction), {
        authorizationType: AuthorizationType.NONE,
      });

    const cfnStage = props.api.deploymentStage.node.defaultChild as CfnStage;
    cfnStage.addPropertyOverride('MethodSettings', [
      {
        HttpMethod: 'POST',
        ResourcePath: '/~1auth~1password-reset~1request',
        ThrottlingBurstLimit: 5,
        ThrottlingRateLimit: 1,
      },
      {
        HttpMethod: 'POST',
        ResourcePath: '/~1auth~1password-reset~1complete',
        ThrottlingBurstLimit: 5,
        ThrottlingRateLimit: 1,
      },
    ]);
  }
}
