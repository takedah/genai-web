import * as cdk from 'aws-cdk-lib';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, test } from 'vitest';
import { DeletionPolicySetter } from '../../lib/create-stacks';

const createStackWithTableAndBucket = (removalPolicy: cdk.RemovalPolicy) => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack');

  new ddb.Table(stack, 'Table', {
    partitionKey: { name: 'id', type: ddb.AttributeType.STRING },
    removalPolicy,
  });
  new s3.Bucket(stack, 'Bucket');

  return stack;
};

describe('DeletionPolicySetter Aspect', () => {
  test('excludeResourceTypes に指定したリソースの RemovalPolicy は上書きされない', () => {
    const stack = createStackWithTableAndBucket(cdk.RemovalPolicy.RETAIN);

    cdk.Aspects.of(stack).add(
      new DeletionPolicySetter(cdk.RemovalPolicy.DESTROY, ['AWS::DynamoDB::Table']),
    );

    const resources = Template.fromStack(stack).toJSON().Resources;
    const table = Object.values<any>(resources).find(
      (r) => r.Type === 'AWS::DynamoDB::Table',
    );
    const bucket = Object.values<any>(resources).find((r) => r.Type === 'AWS::S3::Bucket');

    // databaseRemovalPolicy=RETAIN 相当の設定が Aspect に上書きされないこと
    expect(table.DeletionPolicy).toBe('Retain');
    // 除外指定のないリソースは従来どおり DESTROY が適用されること
    expect(bucket.DeletionPolicy).toBe('Delete');
  });

  test('除外指定がない場合は全リソースに DESTROY が適用される（従来動作）', () => {
    const stack = createStackWithTableAndBucket(cdk.RemovalPolicy.RETAIN);

    cdk.Aspects.of(stack).add(new DeletionPolicySetter(cdk.RemovalPolicy.DESTROY));

    const resources = Template.fromStack(stack).toJSON().Resources;
    const table = Object.values<any>(resources).find(
      (r) => r.Type === 'AWS::DynamoDB::Table',
    );

    expect(table.DeletionPolicy).toBe('Delete');
  });

  test('DESTROY 指定のテーブルは除外されていても Delete のまま', () => {
    const stack = createStackWithTableAndBucket(cdk.RemovalPolicy.DESTROY);

    cdk.Aspects.of(stack).add(
      new DeletionPolicySetter(cdk.RemovalPolicy.DESTROY, ['AWS::DynamoDB::Table']),
    );

    const resources = Template.fromStack(stack).toJSON().Resources;
    const table = Object.values<any>(resources).find(
      (r) => r.Type === 'AWS::DynamoDB::Table',
    );

    expect(table.DeletionPolicy).toBe('Delete');
  });
});
