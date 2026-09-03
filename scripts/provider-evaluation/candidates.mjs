export const CANDIDATES = Object.freeze([
  Object.freeze({
    id: 'gpt-5p6-terra-openai-us',
    provider: 'OpenAI',
    model: 'gpt-5.6-terra',
    api: 'openai_chat',
    endpoint: 'https://us.api.openai.com/v1/chat/completions',
    api_key_env: 'OPENAI_API_KEY',
    request_options: Object.freeze({
      max_completion_tokens: 1500,
      reasoning_effort: 'none',
      temperature: 0.2,
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
])

export const missingCredentialNames = (environment = process.env) => CANDIDATES
  .filter((candidate) => !environment[candidate.api_key_env])
  .map((candidate) => candidate.api_key_env)
