import * as cdk from 'aws-cdk-lib';
import { IConstruct } from 'constructs';
import { ResourceTaggerAspect } from './aspect/resource-tagger';
import { ClosedNetworkStack } from './closed-network-stack';
import { GenerativeAiUseCasesStack } from './generative-ai-use-cases-stack';
import { GuardrailStack } from './guardrail-stack';
import { StackInput } from './stack-input';

export class DeletionPolicySetter implements cdk.IAspect {
  constructor(
    private readonly policy: cdk.RemovalPolicy,
    // 除外したいリソースタイプ（例: 'AWS::DynamoDB::Table'）。
    // 除外されたリソースは construct 側で明示設定された RemovalPolicy がそのまま残る。
    private readonly excludeResourceTypes: string[] = [],
  ) {}

  visit(node: IConstruct): void {
    if (
      node instanceof cdk.CfnResource &&
      !this.excludeResourceTypes.includes(node.cfnResourceType)
    ) {
      node.applyRemovalPolicy(this.policy);
    }
  }
}

/**
 * Apply Environment tag to a stack and all its resources.
 */
const applyEnvironmentTag = (stack: cdk.Stack, appEnv: string): void => {
  const tagValue = appEnv || 'default';

  // Apply standard tags (handles L2 constructs and most L1 resources)
  cdk.Tags.of(stack).add('Environment', tagValue);

  // Apply Aspect for L1 resources with non-standard tag properties
  cdk.Aspects.of(stack).add(new ResourceTaggerAspect({ tagKey: 'Environment', tagValue }));
};

export const createStacks = (app: cdk.App, params: StackInput) => {
  // Closed Network: VPC, VPC endpoints, ALB+ECS web tier, S3 bucket for SPA assets
  const closedNetworkStack = new ClosedNetworkStack(app, `ClosedNetworkStack${params.env}`, {
    env: {
      account: params.account,
      region: params.region,
    },
    params,
  });

  // Guardrail
  // 閉域モードでは region === modelRegion を強制しているため（closed-network-stack.ts のガード）、
  // 全スタックが同一リージョンとなりクロスリージョン参照は発生しない
  const guardrail = params.guardrailEnabled
    ? new GuardrailStack(app, `GuardrailStack${params.env}`, {
        env: {
          account: params.account,
          region: params.modelRegion,
        },
        params: params,
      })
    : null;

  // GenU Stack
  const generativeAiUseCasesStack = new GenerativeAiUseCasesStack(
    app,
    `GenerativeAiUseCasesStack${params.env}`,
    {
      env: {
        account: params.account,
        region: params.region,
      },
      description: 'Genai Web Application Stack (Closed Network)',
      params: params,
      // Closed Network resources
      vpc: closedNetworkStack.vpc,
      apiGatewayVpcEndpoint: closedNetworkStack.apiGatewayVpcEndpoint,
      hostedZone: closedNetworkStack.hostedZone,
      // Guardrail
      guardrailIdentifier: guardrail?.guardrailIdentifier,
      guardrailVersion: 'DRAFT',
    },
  );

  generativeAiUseCasesStack.addDependency(closedNetworkStack);

  // DynamoDB テーブルは databaseRemovalPolicy パラメーターで RemovalPolicy を制御しているため、
  // この Aspect による一括 DESTROY の対象から除外する（除外しないと RETAIN 指定が上書きされてしまう）
  cdk.Aspects.of(generativeAiUseCasesStack).add(
    new DeletionPolicySetter(cdk.RemovalPolicy.DESTROY, ['AWS::DynamoDB::Table']),
  );

  // Apply Environment tags to all stacks
  const appEnv = params.appEnv ?? '';

  applyEnvironmentTag(closedNetworkStack, appEnv);

  if (guardrail) {
    applyEnvironmentTag(guardrail, appEnv);
  }

  applyEnvironmentTag(generativeAiUseCasesStack, appEnv);

  return {
    closedNetworkStack,
    guardrail,
    generativeAiUseCasesStack,
  };
};
