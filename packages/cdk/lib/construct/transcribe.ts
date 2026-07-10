import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  LambdaIntegration,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Effect, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface TranscribeProps {
  encryptionKey: kms.IKey;
  vpc: ec2.IVpc;
  userPool: UserPool;
  authenticatedRole: Role;
  api: RestApi;
  appEnv?: string;
}

export class Transcribe extends Construct {
  /** 親スタックから cognito-identity:* の IAM を付与するため公開する */
  public readonly getSignedUrlFunction: NodejsFunction;
  public readonly startTranscriptionFunction: NodejsFunction;

  constructor(scope: Construct, id: string, props: TranscribeProps) {
    super(scope, id);

    const lambdaVpcProps: Pick<NodejsFunctionProps, 'vpc' | 'vpcSubnets'> = {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    };

    const audioBucket = new Bucket(this, 'AudioBucket', {
      encryption: BucketEncryption.KMS,
      encryptionKey: props.encryptionKey,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });
    audioBucket.addCorsRule({
      allowedOrigins: ['*'],
      allowedMethods: [HttpMethods.PUT],
      allowedHeaders: ['*'],
      exposedHeaders: [],
      maxAge: 3000,
    });

    const transcriptBucket = new Bucket(this, 'TranscriptBucket', {
      encryption: BucketEncryption.KMS,
      encryptionKey: props.encryptionKey,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    // Cognito Identity Pool ID は Lambda が実行時に discovery で解決する。
    // cognito-identity:* の IAM は親スタック側で付与する（循環依存回避）。
    const getSignedUrlFunction = new NodejsFunction(this, 'GetSignedUrl', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/getFileUploadSignedUrl.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        BUCKET_NAME: audioBucket.bucketName,
        USER_POOL_ID: props.userPool.userPoolId,
      },
    });
    audioBucket.grantWrite(getSignedUrlFunction);

    const startTranscriptionFunction = new NodejsFunction(this, 'StartTranscription', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/startTranscription.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        AUDIO_BUCKET_NAME: audioBucket.bucketName,
        TRANSCRIPT_BUCKET_NAME: transcriptBucket.bucketName,
        USER_POOL_ID: props.userPool.userPoolId,
        APP_ENV: props.appEnv ?? 'default',
      },
      initialPolicy: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['transcribe:StartTranscriptionJob', 'transcribe:TagResource'],
          resources: ['*'],
        }),
      ],
    });
    audioBucket.grantRead(startTranscriptionFunction);
    transcriptBucket.grantWrite(startTranscriptionFunction);

    const getTranscriptionFunction = new NodejsFunction(this, 'GetTranscription', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/getTranscription.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      initialPolicy: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['transcribe:GetTranscriptionJob'],
          resources: ['*'],
        }),
      ],
    });
    transcriptBucket.grantRead(getTranscriptionFunction);

    // API Gateway
    const authorizer = new CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [props.userPool],
    });

    const commonAuthorizerProps = {
      authorizationType: AuthorizationType.COGNITO,
      authorizer,
    };
    const transcribeResource = props.api.root.addResource('transcribe');

    // POST: /transcribe/start
    transcribeResource
      .addResource('start')
      .addMethod('POST', new LambdaIntegration(startTranscriptionFunction), commonAuthorizerProps);

    // POST: /transcribe/url
    transcribeResource
      .addResource('url')
      .addMethod('POST', new LambdaIntegration(getSignedUrlFunction), commonAuthorizerProps);

    // GET: /transcribe/result/{jobName}
    transcribeResource
      .addResource('result')
      .addResource('{jobName}')
      .addMethod('GET', new LambdaIntegration(getTranscriptionFunction), commonAuthorizerProps);

    // フォーク元にある StartStreamTranscriptionWebSocket のポリシー付与は、
    // フロントエンドに呼び出し箇所がなく未使用のため行わない

    this.getSignedUrlFunction = getSignedUrlFunction;
    this.startTranscriptionFunction = startTranscriptionFunction;
  }
}