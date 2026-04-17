import bedrockAgentApi from './bedrockAgentApi';
import bedrockApi from './bedrockApi';
import sagemakerApi from './sagemakerApi';

const api = {
  bedrock: bedrockApi,
  bedrockAgent: bedrockAgentApi,
  sagemaker: sagemakerApi,
};

export default api;
