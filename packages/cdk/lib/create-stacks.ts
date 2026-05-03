import * as cdk from 'aws-cdk-lib';
import { IConstruct } from 'constructs';
import { ResourceTaggerAspect } from './aspect/resource-tagger';
import { ClosedNetworkStack } from './closed-network-stack';
import { GenerativeAiUseCasesStack } from './generative-ai-use-cases-stack';
import { GuardrailStack } from './guardrail-stack';
import { StackInput } from './stack-input';

class DeletionPolicySetter implements cdk.IAspect {
  constructor(private readonly policy: cdk.RemovalPolicy) {}

  visit(node: IConstruct): void {
    if (node instanceof cdk.CfnResource) {
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
    crossRegionReferences: true,
  });

  // Guardrail
  const guardrail = params.guardrailEnabled
    ? new GuardrailStack(app, `GuardrailStack${params.env}`, {
        env: {
          account: params.account,
          region: params.modelRegion,
        },
        crossRegionReferences: true,
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
      crossRegionReferences: true,
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

  cdk.Aspects.of(generativeAiUseCasesStack).add(
    new DeletionPolicySetter(cdk.RemovalPolicy.DESTROY),
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
