export const CANDIDATES = Object.freeze([
  Object.freeze({
    id: 'deepseek-v4-flash-fireworks-us',
    provider: 'Fireworks AI',
    model: 'accounts/fireworks/routers/deepseek-v4-flash-0731-us',
    api: 'openai_chat',
    endpoint: 'https://us.api.fireworks.ai/inference/v1/chat/completions',
    api_key_env: 'FIREWORKS_API_KEY',
    request_options: Object.freeze({
      max_tokens: 1500,
      reasoning_effort: 'none',
    }),
    jurisdiction: 'US-only Serverless de Fireworks; la llamada no usa la API de DeepSeek.',
    retention: 'ZDR por defecto para inferencia de modelos abiertos; prompts y generaciones sólo en memoria volátil durante la solicitud.',
    documentation: Object.freeze({
      model: 'https://docs.fireworks.ai/serverless/us-only-serverless',
      jurisdiction: 'https://docs.fireworks.ai/accounts/data-residency',
      retention: 'https://docs.fireworks.ai/guides/security_compliance/data_handling',
    }),
  }),
  Object.freeze({
    id: 'gpt-5p6-terra-openai-us',
    provider: 'OpenAI',
    model: 'gpt-5.6-terra',
    api: 'openai_responses',
    endpoint: 'https://us.api.openai.com/v1/responses',
    api_key_env: 'OPENAI_API_KEY',
    request_options: Object.freeze({
      max_output_tokens: 1500,
      store: false,
    }),
    jurisdiction: 'Procesamiento y almacenamiento regionales en Estados Unidos mediante us.api.openai.com.',
    retention: 'No usa datos de API para entrenamiento salvo opt-in; logs de abuso hasta 30 días por defecto. ZDR requiere aprobación.',
    documentation: Object.freeze({
      model: 'https://developers.openai.com/api/docs/models/gpt-5.6-terra',
      jurisdiction: 'https://developers.openai.com/api/docs/guides/your-data#data-residency-controls',
      retention: 'https://developers.openai.com/api/docs/guides/your-data#data-retention-controls-for-abuse-monitoring',
    }),
  }),
  Object.freeze({
    id: 'claude-sonnet-5-anthropic-us',
    provider: 'Anthropic',
    model: 'claude-sonnet-5',
    api: 'anthropic_messages',
    endpoint: 'https://api.anthropic.com/v1/messages',
    api_key_env: 'ANTHROPIC_API_KEY',
    request_options: Object.freeze({
      max_tokens: 1500,
      inference_geo: 'us',
    }),
    jurisdiction: 'Inferencia restringida a infraestructura estadounidense mediante inference_geo=us; datos almacenados en Estados Unidos.',
    retention: 'Entradas y salidas de API se eliminan dentro de 30 días bajo la política estándar; ZDR se acuerda por separado y hay excepciones de seguridad/legales.',
    documentation: Object.freeze({
      model: 'https://platform.claude.com/docs/en/models/overview',
      jurisdiction: 'https://platform.claude.com/docs/en/manage-claude/data-residency',
      retention: 'https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data',
    }),
  }),
])

export const missingCredentialNames = (environment = process.env) => CANDIDATES
  .filter((candidate) => !environment[candidate.api_key_env])
  .map((candidate) => candidate.api_key_env)
