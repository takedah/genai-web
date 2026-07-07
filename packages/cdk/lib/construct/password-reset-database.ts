import { RemovalPolicy } from 'aws-cdk-lib';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface PasswordResetDatabaseProps {
  encryptionKey: kms.IKey;
  /**
   * Removal policy for the DynamoDB table.
   * - DESTROY: Table will be deleted when the stack is deleted (default)
   * - RETAIN: Table will be retained when the stack is deleted
   */
  removalPolicy?: RemovalPolicy;
}

export class PasswordResetDatabase extends Construct {
  public readonly table: ddb.Table;
  public readonly emailHashIndexName: string;

  constructor(scope: Construct, id: string, props: PasswordResetDatabaseProps) {
    super(scope, id);

    const emailHashIndexName = 'EmailHashIndex';
    const table = new ddb.Table(this, 'Table', {
      partitionKey: {
        name: 'recordId',
        type: ddb.AttributeType.STRING,
      },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      encryption: ddb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.encryptionKey,
      removalPolicy: props.removalPolicy ?? RemovalPolicy.DESTROY,
    });

    table.addGlobalSecondaryIndex({
      indexName: emailHashIndexName,
      partitionKey: {
        name: 'emailHash',
        type: ddb.AttributeType.STRING,
      },
      sortKey: {
        name: 'requestedAt',
        type: ddb.AttributeType.NUMBER,
      },
    });

    this.table = table;
    this.emailHashIndexName = emailHashIndexName;
  }
}
