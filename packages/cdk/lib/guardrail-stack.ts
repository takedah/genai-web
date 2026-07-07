import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Guardrail } from './construct';
import { StackInput } from './stack-input';

interface GuardrailStackProps extends StackProps {
  params: StackInput;
}

export class GuardrailStack extends Stack {
  public readonly guardrailIdentifier: string;

  constructor(scope: Construct, id: string, props: GuardrailStackProps) {
    super(scope, id, props);

    const guardrail = new Guardrail(this, 'Guardrail', {
      appEnv: props.params.appEnv,
    });
    this.guardrailIdentifier = guardrail.guardrailIdentifier;
  }
}
