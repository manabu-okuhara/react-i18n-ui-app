import React from 'react';

function getAiAvailabilityMessage(serviceMeta = {}) {
  if (serviceMeta.mode === 'ai-service') {
    return null;
  }

  if (serviceMeta.mode === 'deterministic-local') {
    return 'AI review is temporarily unavailable because the evaluation service could not be reached, so the app is using deterministic checks.';
  }

  if (serviceMeta.aiUnavailableReason === 'service_limits') {
    return 'AI review is temporarily unavailable because the AI service is rate-limited or has no available quota, so the app is using deterministic checks.';
  }

  if (serviceMeta.aiUnavailableReason === 'auth_or_config') {
    return 'AI review is temporarily unavailable because the AI service is not configured correctly, so the app is using deterministic checks.';
  }

  return 'AI review is temporarily unavailable, so the app is using deterministic checks.';
}

function LocaleQaPanel({ qaResult, bundle }) {
  if (!qaResult || !bundle) {
    return null;
  }

  return (
    <section style={styles.panel}>
      <h2 style={styles.heading}>GenAI-Assisted Locale QA</h2>
      <p style={styles.subtitle}>
        This assessment combines rule-based locale validation with AI-assisted quality review.
      </p>
      <p style={styles.line}>Status: {qaResult.status}</p>
      <p style={styles.line}>Bundle Source: {bundle.bundleSource}</p>
      <p style={styles.line}>Formatting Locale: {bundle.formattingLocale}</p>
      <p style={styles.line}>Label Language: {bundle.labelLanguage}</p>
      <p style={styles.line}>Issue Type: {qaResult.triage.category}</p>
      <p style={styles.line}>Recommendation: {qaResult.triage.recommendation}</p>
      <p style={styles.line}>Evaluation Service: {qaResult.serviceMeta?.mode || 'deterministic-local'}</p>
      {qaResult.aiReview ? (
        <>
          <p style={styles.line}>GenAI Review Summary: {qaResult.aiReview.summary}</p>
          <p style={styles.line}>AI Score: {qaResult.aiReview.score}</p>
          <p style={styles.line}>AI Confidence: {qaResult.aiReview.confidence}</p>
          <p style={styles.line}>Recommended Next Step: {qaResult.aiReview.recommendedNextStep}</p>
          {qaResult.aiReview.findings?.map((finding) => (
            <p key={finding.id} style={styles.line}>
              AI Finding ({finding.severity}): {finding.message}
            </p>
          ))}
        </>
      ) : (
        <p style={styles.line}>
          {getAiAvailabilityMessage(qaResult.serviceMeta)}
        </p>
      )}
      {qaResult.checks.map((check) => (
        <p key={check.id} style={styles.line}>
          {check.label}: {check.status} ({check.detail})
        </p>
      ))}
    </section>
  );
}

const styles = {
  panel: {
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid #ddd'
  },
  heading: {
    margin: '0 0 12px',
    fontSize: '1.2rem'
  },
  subtitle: {
    margin: '0 0 12px',
    fontSize: '1.2rem',
    lineHeight: 1.5,
    color: '#444'
  },
  line: {
    margin: '0 0 8px',
    fontSize: '1.2rem',
    lineHeight: 1.5
  }
};

export default LocaleQaPanel;
