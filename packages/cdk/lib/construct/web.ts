import { NodejsBuild } from '@cdklabs/deploy-time-build';
import { Stack } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { HiddenUseCases } from 'genai-web';
import { z } from 'zod';
import { govaiForHomepage, govaiForSidebar } from '../stack-input';

export interface WebProps {
  appEnv: string;
  apiEndpointUrl: string;
  teamAccessControlApiEndpointUrl: string;
  userPoolId: string;
  userPoolClientId: string;
  idPoolId: string;
  predictStreamFunctionArn: string;
  optimizePromptFunctionArn: string;
  selfSignUpEnabled: boolean;
  modelRegion: string;
  modelIds: string[];
  imageGenerationModelIds: string[];
  endpointNames: string[];
  hiddenUseCases: HiddenUseCases;
  govais_for_homepage: z.infer<typeof govaiForHomepage>[];
  govais_for_sidebar: z.infer<typeof govaiForSidebar>[];
  maintenance: boolean;
  // Closed Network: deploy frontend assets directly into the bucket served by ALB+ECS
  webBucket: s3.Bucket;
}

export class Web extends Construct {
  constructor(scope: Construct, id: string, props: WebProps) {
    super(scope, id);

    new NodejsBuild(this, 'BuildWeb', {
      nodejsVersion: 22,
      assets: [
        {
          path: '../../',
          exclude: [
            '.git',
            '.github',
            '.gitignore',
            '.prettierignore',
            '.prettierrc.json',
            '*.md',
            'LICENSE',
            'docs',
            'imgs',
            'setup-env.sh',
            'node_modules',
            'prompt-templates',
            'packages/cdk/**/*',
            '!packages/cdk/cdk.json',
            'packages/web/dist',
            'packages/web/dev-dist',
            'packages/web/node_modules',
          ],
        },
      ],
      destinationBucket: props.webBucket,
      outputSourceDirectory: './packages/web/dist',
      buildCommands: [
        'npm ci',
        'npm run web:build',
        'cp ./packages/web/403.html ./packages/web/dist/',
        'cp ./packages/web/maintenance.html ./packages/web/dist/',
      ],
      buildEnvironment: {
        NODE_OPTIONS: '--max-old-space-size=2048', // デプロイ時のCodeBuildのメモリを設定
        VITE_APP_ENV: props.appEnv,
        VITE_APP_API_ENDPOINT: props.apiEndpointUrl,
        VITE_APP_TEAM_ACCESS_CONTROL_API_ENDPOINT: props.teamAccessControlApiEndpointUrl,
        VITE_APP_REGION: Stack.of(this).region,
        VITE_APP_USER_POOL_ID: props.userPoolId,
        VITE_APP_USER_POOL_CLIENT_ID: props.userPoolClientId,
        VITE_APP_IDENTITY_POOL_ID: props.idPoolId,
        VITE_APP_PREDICT_STREAM_FUNCTION_ARN: props.predictStreamFunctionArn,
        VITE_APP_OPTIMIZE_PROMPT_FUNCTION_ARN: props.optimizePromptFunctionArn,
        VITE_APP_SELF_SIGN_UP_ENABLED: props.selfSignUpEnabled.toString(),
        VITE_APP_MODEL_REGION: props.modelRegion,
        VITE_APP_MODEL_IDS: JSON.stringify(props.modelIds),
        VITE_APP_IMAGE_MODEL_IDS: JSON.stringify(props.imageGenerationModelIds),
        VITE_APP_ENDPOINT_NAMES: JSON.stringify(props.endpointNames),
        VITE_APP_HIDDEN_USE_CASES: JSON.stringify(props.hiddenUseCases),
        VITE_APP_GOVAIS_FOR_HOMEPAGE: JSON.stringify(props.govais_for_homepage),
        VITE_APP_GOVAIS_FOR_SIDEBAR: JSON.stringify(props.govais_for_sidebar),
        VITE_APP_MAINTENANCE: props.maintenance.toString(),
      },
    });
  }
}
