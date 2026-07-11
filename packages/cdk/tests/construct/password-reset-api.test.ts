import { DEFAULT_PASSWORD_POLICY } from '@genai-web/common';
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, BillingMode, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Key } from 'aws-cdk-lib/aws-kms';
import { describe, test } from 'vitest';
import { PasswordResetApi } from '../../lib/construct/password-reset-api';

describe('PasswordResetApi Construct', () => {
  test('adds public request and complete endpoints with method throttling', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'PasswordResetApiTestStack');
    const api = new RestApi(stack, 'Api', {
      deployOptions: {
        stageName: 'api',
      },
    });
    const userPool = new UserPool(stack, 'UserPool');
    const key = new Key(stack, 'Key');
    const table = new Table(stack, 'PasswordResetTable', {
      partitionKey: {
        name: 'recordId',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      encryption: TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: key,
    });

    // Closed Network: Lambda は VPC 内（PRIVATE_ISOLATED）に配置される
    const vpc = new Vpc(stack, 'Vpc', {
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Isolated',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    new PasswordResetApi(stack, 'PasswordResetApi', {
      api,
      vpc,
      passwordResetTable: table,
      emailHashIndexName: 'EmailHashIndex',
      userPool,
      sesIdentityName: 'example.go.jp',
      sesFromAddress: 'no-reply@example.go.jp',
      sesConfigurationSetName: 'reset-config',
      sesTenantName: 'tenant',
      passwordPolicy: DEFAULT_PASSWORD_POLICY,
    });

    const template = Template.fromStack(stack);

    template.resourcePropertiesCountIs(
      'AWS::ApiGateway::Method',
      {
        AuthorizationType: 'NONE',
        HttpMethod: 'POST',
      },
      2,
    );
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      MethodSettings: [
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
      ],
      StageName: 'api',
    });
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          EMAIL_HASH_INDEX_NAME: 'EmailHashIndex',
          PASSWORD_POLICY: JSON.stringify(DEFAULT_PASSWORD_POLICY),
          SES_CONFIGURATION_SET_NAME: 'reset-config',
          SES_FROM_ADDRESS: 'no-reply@example.go.jp',
          SES_TENANT_NAME: 'tenant',
        }),
      },
      Timeout: 15,
    });
    template.resourcePropertiesCountIs('AWS::Lambda::Function', { Timeout: 15 }, 2);
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              'cognito-idp:AdminSetUserPassword',
              'cognito-idp:AdminUserGlobalSignOut',
              'cognito-idp:AdminGetUser',
            ]),
            Effect: 'Allow',
          }),
        ]),
      },
    });
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['dynamodb:DeleteItem', 'dynamodb:UpdateItem']),
            Effect: 'Allow',
          }),
          Match.objectLike({
            Action: 'dynamodb:Query',
            Effect: 'Allow',
          }),
        ]),
      },
    });
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['kms:Decrypt', 'kms:GenerateDataKey*']),
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });
});
