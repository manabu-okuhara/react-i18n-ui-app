const { createAiLocaleReviewRequest } = require('./aiLocaleReviewPrompt');

const DEFAULT_MODEL = 'gpt-4.1-mini';

const REVIEW_SCHEMA = {
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
};

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

async function createResponse(config, body) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`OpenAI locale evaluation failed with status ${response.status}`);
  }

  return response.json();
}

function normalizeReview(parsed) {
  const score = Number(parsed.score);
  const normalizedScore = Number.isFinite(score)
    ? Math.max(0, Math.min(100, Math.round(score)))
    : 0;

  const findings = Array.isArray(parsed.findings)
    ? parsed.findings
        .filter((finding) => finding && typeof finding.message === 'string')
        .slice(0, 3)
        .map((finding, index) => ({
          id: finding.id || `finding-${index + 1}`,
          severity: ['low', 'medium', 'high'].includes(finding.severity) ? finding.severity : 'medium',
          message: finding.message.trim()
        }))
    : [];

  return {
    summary: String(parsed.summary || '').trim(),
    score: normalizedScore,
    confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'medium',
    findings,
    recommendedNextStep: String(parsed.recommendedNextStep || '').trim()
  };
}

function getResponseText(payload) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const messages = Array.isArray(payload.output) ? payload.output : [];
  const textParts = messages.flatMap((item) => (
    Array.isArray(item.content)
      ? item.content
          .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
          .map((part) => part.text)
      : []
  ));

  return textParts.join('\n').trim();
}

function parseJsonText(outputText) {
  const trimmed = outputText.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(jsonText);
}

async function requestStructuredReview(config, bundle) {
  const payload = await createResponse(config, {
    model: config.model,
    input: createAiLocaleReviewRequest(bundle),
    text: {
      format: {
        type: 'json_schema',
        name: 'locale_review',
        schema: REVIEW_SCHEMA
      }
    }
  });

  const outputText = getResponseText(payload);

  if (!outputText) {
    throw new Error('OpenAI locale evaluation returned no output text');
  }

  return normalizeReview(JSON.parse(outputText));
}

async function requestPlainJsonReview(config, bundle) {
  const payload = await createResponse(config, {
    model: config.model,
    input: [
      createAiLocaleReviewRequest(bundle),
      'Return only valid JSON with the fields summary, score, confidence, recommendedNextStep, and findings.'
    ].join('\n\n')
  });

  const outputText = getResponseText(payload);

  if (!outputText) {
    throw new Error('OpenAI locale evaluation returned no output text');
  }

  try {
    return normalizeReview(parseJsonText(outputText));
  } catch (error) {
    throw error;
  }
}

async function reviewLocaleBundleWithAi(bundle, options = {}) {
  const config = options.config || getAiEvaluationConfig();

  if (!config) {
    return null;
  }

  try {
    return await requestStructuredReview(config, bundle);
  } catch (structuredError) {
    if (/status\s+(401|403|429)/.test(structuredError.message)) {
      throw structuredError;
    }

    return requestPlainJsonReview(config, bundle);
  }
}

module.exports = {
  getAiEvaluationConfig,
  reviewLocaleBundleWithAi
};
