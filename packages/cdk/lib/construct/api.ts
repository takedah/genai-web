import { BEDROCK_IMAGE_GEN_MODELS, BEDROCK_TEXT_MODELS } from '@genai-web/common';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  Cors,
  EndpointType,
  LambdaIntegration,
  ResponseType,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import {
  AnyPrincipal,
  Effect,
  PolicyDocument,
  PolicyStatement,
  Role,
} from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { IFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

export interface BackendApiProps {
  // Encryption
  encryptionKey: kms.IKey;

  // Closed Network
  vpc: ec2.IVpc;
  apiGatewayVpcEndpoint: ec2.InterfaceVpcEndpoint;

  // Context Params
  modelRegion: string;
  modelIds: string[];
  imageGenerationModelIds: string[];
  endpointNames: string[];
  crossAccountBedrockRoleArn?: string | null;
  s3FileExpirationDays: number;
  dynamoDbTtlDays: number;

  // Inference Profile mappings for cost allocation tagging
  inferenceProfileMap?: { [modelId: string]: string };
  imageInferenceProfileMap?: { [modelId: string]: string };

  // Resource
  userPool: UserPool;
  authenticatedRole: Role;
  systemAdminRole: Role;
  teamAdminRole: Role;
  userRole: Role;
  // idPool: IdentityPool;
  identityPoolId: string;
  userPoolClient: UserPoolClient;
  table: Table;
  guardrailIdentify?: string;
  guardrailVersion?: string;
}

export class Api extends Construct {
  readonly api: RestApi;
  readonly predictStreamFunction: NodejsFunction;
  readonly optimizePromptFunction: NodejsFunction;
  readonly modelRegion: string;
  readonly modelIds: string[];
  readonly imageGenerationModelIds: string[];
  readonly endpointNames: string[];
  readonly fileBucket: Bucket;
  readonly getFileDownloadSignedUrlFunction: IFunction;

  constructor(scope: Construct, id: string, props: BackendApiProps) {
    super(scope, id);

    const {
      modelRegion,
      modelIds,
      imageGenerationModelIds,
      endpointNames,
      crossAccountBedrockRoleArn,
      userPool,
      userPoolClient,
      table,
      // idPool,
      authenticatedRole,
    } = props;

    // 全 Lambda 共通の VPC 設定（Closed Network 環境）
    const lambdaVpcProps: Pick<NodejsFunctionProps, 'vpc' | 'vpcSubnets'> = {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    };

    // Validate Model Names
    for (const modelId of modelIds) {
      if (!BEDROCK_TEXT_MODELS.includes(modelId)) {
        throw new Error(`Unsupported Model Name: ${modelId}`);
      }
    }
    for (const modelId of imageGenerationModelIds) {
      if (!BEDROCK_IMAGE_GEN_MODELS.includes(modelId)) {
        throw new Error(`Unsupported Model Name: ${modelId}`);
      }
    }

    // S3 (File Bucket)
    const fileBucket = new Bucket(this, 'FileBucket', {
      encryption: BucketEncryption.KMS,
      encryptionKey: props.encryptionKey,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          expiration: Duration.days(props.s3FileExpirationDays),
        },
      ],
    });
    fileBucket.addCorsRule({
      allowedOrigins: ['*'],
      allowedMethods: [HttpMethods.GET, HttpMethods.POST, HttpMethods.PUT],
      allowedHeaders: ['*'],
      exposedHeaders: [],
      maxAge: 3000,
    });

    // Lambda
    const predictFunction = new NodejsFunction(this, 'Predict', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/predict.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        MODEL_REGION: modelRegion,
        MODEL_IDS: JSON.stringify(modelIds),
        IMAGE_GENERATION_MODEL_IDS: JSON.stringify(imageGenerationModelIds),
        CROSS_ACCOUNT_BEDROCK_ROLE_ARN: crossAccountBedrockRoleArn ?? '',
        ...(props.guardrailIdentify ? { GUARDRAIL_IDENTIFIER: props.guardrailIdentify } : {}),
        ...(props.guardrailVersion ? { GUARDRAIL_VERSION: props.guardrailVersion } : {}),
        ...(props.inferenceProfileMap
          ? { INFERENCE_PROFILE_MAP: JSON.stringify(props.inferenceProfileMap) }
          : {}),
      },
    });

    const predictStreamFunction = new NodejsFunction(this, 'PredictStream', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/predictStream.ts',
      timeout: Duration.minutes(15),
      memorySize: 256,
      ...lambdaVpcProps,
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        MODEL_REGION: modelRegion,
        MODEL_IDS: JSON.stringify(modelIds),
        IMAGE_GENERATION_MODEL_IDS: JSON.stringify(imageGenerationModelIds),
        CROSS_ACCOUNT_BEDROCK_ROLE_ARN: crossAccountBedrockRoleArn ?? '',
        BUCKET_NAME: fileBucket.bucketName,
        ...(props.guardrailIdentify ? { GUARDRAIL_IDENTIFIER: props.guardrailIdentify } : {}),
        ...(props.guardrailVersion ? { GUARDRAIL_VERSION: props.guardrailVersion } : {}),
        ...(props.inferenceProfileMap
          ? { INFERENCE_PROFILE_MAP: JSON.stringify(props.inferenceProfileMap) }
          : {}),
      },
    });
    fileBucket.grantReadWrite(predictStreamFunction);
    authenticatedRole.grant(predictStreamFunction.role!, 'lambda:InvokeFunction');

    const predictTitleFunction = new NodejsFunction(this, 'PredictTitle', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/predictTitle.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        TABLE_NAME: table.tableName,
        MODEL_REGION: modelRegion,
        MODEL_IDS: JSON.stringify(modelIds),
        IMAGE_GENERATION_MODEL_IDS: JSON.stringify(imageGenerationModelIds),
        CROSS_ACCOUNT_BEDROCK_ROLE_ARN: crossAccountBedrockRoleArn ?? '',
        ...(props.guardrailIdentify ? { GUARDRAIL_IDENTIFIER: props.guardrailIdentify } : {}),
        ...(props.guardrailVersion ? { GUARDRAIL_VERSION: props.guardrailVersion } : {}),
        ...(props.inferenceProfileMap
          ? { INFERENCE_PROFILE_MAP: JSON.stringify(props.inferenceProfileMap) }
          : {}),
      },
    });
    table.grantWriteData(predictTitleFunction);

    const generateImageFunction = new NodejsFunction(this, 'GenerateImage', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/generateImage.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        MODEL_REGION: modelRegion,
        MODEL_IDS: JSON.stringify(modelIds),
        IMAGE_GENERATION_MODEL_IDS: JSON.stringify(imageGenerationModelIds),
        CROSS_ACCOUNT_BEDROCK_ROLE_ARN: crossAccountBedrockRoleArn ?? '',
        ...(props.imageInferenceProfileMap
          ? { IMAGE_INFERENCE_PROFILE_MAP: JSON.stringify(props.imageInferenceProfileMap) }
          : {}),
      },
    });

    const optimizePromptFunction = new NodejsFunction(this, 'OptimizePromptFunction', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/optimizePrompt.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        MODEL_REGION: modelRegion,
      },
    });
    authenticatedRole.grant(optimizePromptFunction.role!, 'lambda:InvokeFunction');

    // SageMaker Endpoint がある場合は権限付与
    if (endpointNames.length > 0) {
      // SageMaker Policy
      const sagemakerPolicy = new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sagemaker:DescribeEndpoint', 'sagemaker:InvokeEndpoint'],
        resources: endpointNames.map(
          (endpointName) =>
            `arn:aws:sagemaker:${modelRegion}:${Stack.of(this).account}:endpoint/${endpointName}`,
        ),
      });
      predictFunction.role?.addToPrincipalPolicy(sagemakerPolicy);
      predictStreamFunction.role?.addToPrincipalPolicy(sagemakerPolicy);
      predictTitleFunction.role?.addToPrincipalPolicy(sagemakerPolicy);
      generateImageFunction.role?.addToPrincipalPolicy(sagemakerPolicy);
    }

    if (typeof crossAccountBedrockRoleArn !== 'string' || crossAccountBedrockRoleArn === '') {
      // 同一アカウントの Bedrock を使用する場合
      const bedrockInvokePolicy = new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: ['*'],
      });
      predictFunction.role?.addToPrincipalPolicy(bedrockInvokePolicy);
      predictStreamFunction.role?.addToPrincipalPolicy(bedrockInvokePolicy);
      predictTitleFunction.role?.addToPrincipalPolicy(bedrockInvokePolicy);
      generateImageFunction.role?.addToPrincipalPolicy(bedrockInvokePolicy);

      // Bedrock Agent 権限（predictStream は bedrockAgentApi 経由で Agent を呼び出す可能性がある）
      const bedrockAgentPolicy = new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:InvokeAgent', 'bedrock:GetAgentAlias', 'bedrock:ListAgentActionGroups'],
        resources: ['*'],
      });
      predictStreamFunction.role?.addToPrincipalPolicy(bedrockAgentPolicy);
    } else {
      const assumeRolePolicy = new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [crossAccountBedrockRoleArn],
      });
      predictFunction.role?.addToPrincipalPolicy(assumeRolePolicy);
      predictStreamFunction.role?.addToPrincipalPolicy(assumeRolePolicy);
      predictTitleFunction.role?.addToPrincipalPolicy(assumeRolePolicy);
      generateImageFunction.role?.addToPrincipalPolicy(assumeRolePolicy);
    }

    // OptimizePrompt は常に同一アカウントの Bedrock Agent Runtime を使用する
    const bedrockOptimizePolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['bedrock:OptimizePrompt'],
      resources: ['*'],
    });
    optimizePromptFunction.role?.addToPrincipalPolicy(bedrockOptimizePolicy);

    // AWS Marketplace Policy for Converse API functions
    const marketplacePolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'aws-marketplace:Subscribe',
        'aws-marketplace:Unsubscribe',
        'aws-marketplace:ViewSubscriptions',
      ],
      resources: ['*'],
    });
    predictStreamFunction.role?.addToPrincipalPolicy(marketplacePolicy);
    predictFunction.role?.addToPrincipalPolicy(marketplacePolicy);
    predictTitleFunction.role?.addToPrincipalPolicy(marketplacePolicy);

    const createChatFunction = new NodejsFunction(this, 'CreateChat', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/createChat.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        TABLE_NAME: table.tableName,
        TTL_DAYS: props.dynamoDbTtlDays.toString(),
      },
    });
    table.grantWriteData(createChatFunction);

    const deleteChatFunction = new NodejsFunction(this, 'DeleteChat', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/deleteChat.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    table.grantReadWriteData(deleteChatFunction);

    const createMessagesFunction = new NodejsFunction(this, 'CreateMessages', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/createMessages.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        TABLE_NAME: table.tableName,
        BUCKET_NAME: fileBucket.bucketName,
        TTL_DAYS: props.dynamoDbTtlDays.toString(),
      },
    });
    table.grantReadWriteData(createMessagesFunction);

    const updateChatTitleFunction = new NodejsFunction(this, 'UpdateChatTitle', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/updateTitle.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    table.grantReadWriteData(updateChatTitleFunction);

    const listChatsFunction = new NodejsFunction(this, 'ListChats', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/listChats.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    table.grantReadData(listChatsFunction);

    const findChatbyIdFunction = new NodejsFunction(this, 'FindChatbyId', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/findChatById.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    table.grantReadData(findChatbyIdFunction);

    const listMessagesFunction = new NodejsFunction(this, 'ListMessages', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/listMessages.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    table.grantReadData(listMessagesFunction);

    const listSystemContextsFunction = new NodejsFunction(this, 'ListSystemContexts', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/listSystemContexts.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    table.grantReadData(listSystemContextsFunction);

    const createSystemContextFunction = new NodejsFunction(this, 'CreateSystemContexts', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/createSystemContext.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    table.grantWriteData(createSystemContextFunction);

    const updateSystemContextTitleFunction = new NodejsFunction(this, 'UpdateSystemContextTitle', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/updateSystemContextTitle.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    table.grantReadWriteData(updateSystemContextTitleFunction);

    const deleteSystemContextFunction = new NodejsFunction(this, 'DeleteSystemContexts', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/deleteSystemContext.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    table.grantReadWriteData(deleteSystemContextFunction);

    const getSignedUrlFunction = new NodejsFunction(this, 'GetSignedUrl', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/getFileUploadSignedUrl.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        BUCKET_NAME: fileBucket.bucketName,
        IDENTITY_POOL_ID: props.identityPoolId,
        USER_POOL_ID: userPool.userPoolId,
      },
    });
    fileBucket.grantWrite(getSignedUrlFunction);
    getSignedUrlFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['cognito-identity:GetId'],
        resources: [
          `arn:aws:cognito-identity:${Stack.of(this).region}:${Stack.of(this).account}:identitypool/${props.identityPoolId}`,
        ],
      }),
    );

    const getFileDownloadSignedUrlFunction = new NodejsFunction(
      this,
      'GetFileDownloadSignedUrlFunction',
      {
        runtime: Runtime.NODEJS_22_X,
        entry: './lambda/getFileDownloadSignedUrl.ts',
        timeout: Duration.minutes(15),
        ...lambdaVpcProps,
        environment: {
          BUCKET_NAME: fileBucket.bucketName,
          IDENTITY_POOL_ID: props.identityPoolId,
          USER_POOL_ID: userPool.userPoolId,
        },
      },
    );
    fileBucket.grantRead(getFileDownloadSignedUrlFunction);
    getFileDownloadSignedUrlFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['cognito-identity:GetId'],
        resources: [
          `arn:aws:cognito-identity:${Stack.of(this).region}:${Stack.of(this).account}:identitypool/${props.identityPoolId}`,
        ],
      }),
    );

    const deleteFileFunction = new NodejsFunction(this, 'DeleteFileFunction', {
      runtime: Runtime.NODEJS_22_X,
      entry: './lambda/deleteFile.ts',
      timeout: Duration.minutes(15),
      ...lambdaVpcProps,
      environment: {
        BUCKET_NAME: fileBucket.bucketName,
        IDENTITY_POOL_ID: props.identityPoolId,
        USER_POOL_ID: userPool.userPoolId,
      },
    });
    fileBucket.grantDelete(deleteFileFunction);
    deleteFileFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['cognito-identity:GetId'],
        resources: [
          `arn:aws:cognito-identity:${Stack.of(this).region}:${Stack.of(this).account}:identitypool/${props.identityPoolId}`,
        ],
      }),
    );

    // API Gateway
    const authorizer = new CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [userPool],
    });

    const commonAuthorizerProps = {
      authorizationType: AuthorizationType.COGNITO,
      authorizer,
    };

    const api = new RestApi(this, 'Api', {
      deployOptions: {
        stageName: 'api',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
      },
      cloudWatchRole: true,
      endpointConfiguration: {
        types: [EndpointType.PRIVATE],
        vpcEndpoints: [props.apiGatewayVpcEndpoint],
      },
      policy: new PolicyDocument({
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            principals: [new AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*'],
            conditions: {
              StringEquals: {
                'aws:SourceVpce': props.apiGatewayVpcEndpoint.vpcEndpointId,
              },
            },
          }),
        ],
      }),
    });

    api.addGatewayResponse('Api4XX', {
      type: ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
      },
    });

    api.addGatewayResponse('Api5XX', {
      type: ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
      },
    });

    const predictResource = api.root.addResource('predict');

    // POST: /predict
    predictResource.addMethod(
      'POST',
      new LambdaIntegration(predictFunction),
      commonAuthorizerProps,
    );

    // POST: /predict/title
    const predictTitleResource = predictResource.addResource('title');
    predictTitleResource.addMethod(
      'POST',
      new LambdaIntegration(predictTitleFunction),
      commonAuthorizerProps,
    );

    const chatsResource = api.root.addResource('chats');

    // POST: /chats
    chatsResource.addMethod(
      'POST',
      new LambdaIntegration(createChatFunction),
      commonAuthorizerProps,
    );

    // GET: /chats
    chatsResource.addMethod('GET', new LambdaIntegration(listChatsFunction), commonAuthorizerProps);

    const chatResource = chatsResource.addResource('{chatId}');

    // GET: /chats/{chatId}
    chatResource.addMethod(
      'GET',
      new LambdaIntegration(findChatbyIdFunction),
      commonAuthorizerProps,
    );

    // DELETE: /chats/{chatId}
    chatResource.addMethod(
      'DELETE',
      new LambdaIntegration(deleteChatFunction),
      commonAuthorizerProps,
    );

    const titleResource = chatResource.addResource('title');

    // PUT: /chats/{chatId}/title
    titleResource.addMethod(
      'PUT',
      new LambdaIntegration(updateChatTitleFunction),
      commonAuthorizerProps,
    );

    const messagesResource = chatResource.addResource('messages');

    // GET: /chats/{chatId}/messages
    messagesResource.addMethod(
      'GET',
      new LambdaIntegration(listMessagesFunction),
      commonAuthorizerProps,
    );

    // POST: /chats/{chatId}/messages
    messagesResource.addMethod(
      'POST',
      new LambdaIntegration(createMessagesFunction),
      commonAuthorizerProps,
    );

    const systemContextsResource = api.root.addResource('systemcontexts');

    // POST: /systemcontexts
    systemContextsResource.addMethod(
      'POST',
      new LambdaIntegration(createSystemContextFunction),
      commonAuthorizerProps,
    );

    // GET: /systemcontexts
    systemContextsResource.addMethod(
      'GET',
      new LambdaIntegration(listSystemContextsFunction),
      commonAuthorizerProps,
    );

    const systemContextResource = systemContextsResource.addResource('{systemContextId}');

    // DELETE: /systemcontexts/{systemContextId}
    systemContextResource.addMethod(
      'DELETE',
      new LambdaIntegration(deleteSystemContextFunction),
      commonAuthorizerProps,
    );

    const systemContextTitleResource = systemContextResource.addResource('title');

    // PUT: /systemcontexts/{systemContextId}/title
    systemContextTitleResource.addMethod(
      'PUT',
      new LambdaIntegration(updateSystemContextTitleFunction),
      commonAuthorizerProps,
    );

    const imageResource = api.root.addResource('image');
    const imageGenerateResource = imageResource.addResource('generate');
    // POST: /image/generate
    imageGenerateResource.addMethod(
      'POST',
      new LambdaIntegration(generateImageFunction),
      commonAuthorizerProps,
    );

    const fileResource = api.root.addResource('file');
    const urlResource = fileResource.addResource('url');
    // POST: /file/url
    urlResource.addMethod(
      'POST',
      new LambdaIntegration(getSignedUrlFunction),
      commonAuthorizerProps,
    );
    // Get: /file/url
    urlResource.addMethod(
      'GET',
      new LambdaIntegration(getFileDownloadSignedUrlFunction),
      commonAuthorizerProps,
    );
    // DELETE: /file/{fileName}
    fileResource
      .addResource('{fileName}')
      .addMethod('DELETE', new LambdaIntegration(deleteFileFunction), commonAuthorizerProps);

    this.api = api;
    this.predictStreamFunction = predictStreamFunction;
    this.optimizePromptFunction = optimizePromptFunction;
    this.modelRegion = modelRegion;
    this.modelIds = modelIds;
    this.imageGenerationModelIds = imageGenerationModelIds;
    this.endpointNames = endpointNames;
    this.fileBucket = fileBucket;
    this.getFileDownloadSignedUrlFunction = getFileDownloadSignedUrlFunction;

    // NagSuppressions for KMS wildcard permissions
    NagSuppressions.addStackSuppressions(
      Stack.of(this),
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'KMS wildcard permissions (GenerateDataKey* and ReEncrypt*) are required for DynamoDB and S3 encryption operations with customer-managed keys.',
          appliesTo: ['Action::kms:GenerateDataKey*', 'Action::kms:ReEncrypt*'],
        },
      ],
      true,
    );
  }

  // Bucket 名を指定してダウンロード可能にする
  allowDownloadFile(bucketName: string) {
    this.getFileDownloadSignedUrlFunction.role?.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        resources: [`arn:aws:s3:::${bucketName}`, `arn:aws:s3:::${bucketName}/*`],
        actions: ['s3:GetBucket*', 's3:GetObject*', 's3:List*'],
      }),
    );
  }
}
