import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, test } from 'vitest';
import { PasswordResetDatabase } from '../../lib/construct/password-reset-database';

describe('PasswordResetDatabase Construct', () => {
  test('creates a dedicated five-minute reset table schema', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'PasswordResetDatabaseTestStack');
    const key = new kms.Key(stack, 'Key');

    new PasswordResetDatabase(stack, 'PasswordResetDatabase', {
      encryptionKey: key,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [
        {
          AttributeName: 'recordId',
          KeyType: 'HASH',
        },
      ],
      AttributeDefinitions: [
        {
          AttributeName: 'recordId',
          AttributeType: 'S',
        },
        {
          AttributeName: 'emailHash',
          AttributeType: 'S',
        },
        {
          AttributeName: 'requestedAt',
          AttributeType: 'N',
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
      TimeToLiveSpecification: {
        AttributeName: 'expiresAt',
        Enabled: true,
      },
      GlobalSecondaryIndexes: [
        {
          IndexName: 'EmailHashIndex',
          KeySchema: [
            {
              AttributeName: 'emailHash',
              KeyType: 'HASH',
            },
            {
              AttributeName: 'requestedAt',
              KeyType: 'RANGE',
            },
          ],
          Projection: {
            ProjectionType: 'ALL',
          },
        },
      ],
    });

    const templateJson = template.toJSON();
    expect(JSON.stringify(templateJson)).not.toContain('PointInTimeRecoverySpecification');
  });
});
