const { createAiLocaleReviewRequest } = require('./aiLocaleReviewPrompt');

const DEFAULT_MODEL = 'gpt-4.1-mini';

function getAiEvaluationConfig() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    model: process.env.OPENAI_EVAL_MODEL || DEFAULT_MODEL
  };
}

async function reviewLocaleBundleWithAi(bundle, options = {}) {
  const config = options.config || getAiEvaluationConfig();

  if (!config) {
    return null;
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      input: createAiLocaleReviewRequest(bundle),
      text: {
        format: {
          type: 'json_schema',
          name: 'locale_review',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: { type: 'string' },
              score: { type: 'number' },
              confidence: {
                type: 'string',
                enum: ['low', 'medium', 'high']
              },
              recommendedNextStep: { type: 'string' },
              findings: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string' },
                    severity: {
                      type: 'string',
                      enum: ['low', 'medium', 'high']
                    },
                    message: { type: 'string' }
                  },
                  required: ['id', 'severity', 'message']
                }
              }
            },
            required: ['summary', 'score', 'confidence', 'recommendedNextStep', 'findings']
          }
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI locale evaluation failed with status ${response.status}`);
  }

  const payload = await response.json();
  const outputText = payload.output_text;

  if (!outputText) {
    throw new Error('OpenAI locale evaluation returned no output text');
  }

  const parsed = JSON.parse(outputText);

  return {
    summary: parsed.summary,
    score: parsed.score,
    confidence: parsed.confidence,
    findings: Array.isArray(parsed.findings) ? parsed.findings : [],
    recommendedNextStep: parsed.recommendedNextStep
  };
}

module.exports = {
  getAiEvaluationConfig,
  reviewLocaleBundleWithAi
};
