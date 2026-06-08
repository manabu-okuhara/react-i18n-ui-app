import React from 'react';

function LocaleQaPanel({ qaResult, bundle }) {
  if (!qaResult || !bundle) {
    return null;
  }

  return (
    <section style={styles.panel}>
      <h2 style={styles.heading}>GenAI-Assisted Locale QA</h2>
      <p style={styles.subtitle}>
        This review is based on locale metadata analysis, fallback logic, and GenAI-ready evaluation services.
      </p>
      <p style={styles.line}>Status: {qaResult.status}</p>
      <p style={styles.line}>Bundle Source: {bundle.bundleSource}</p>
      <p style={styles.line}>Formatting Locale: {bundle.formattingLocale}</p>
      <p style={styles.line}>Label Language: {bundle.labelLanguage}</p>
      <p style={styles.line}>Issue Type: {qaResult.triage.category}</p>
      <p style={styles.line}>Recommendation: {qaResult.triage.recommendation}</p>
      <p style={styles.line}>Evaluation Service: {qaResult.serviceMeta?.mode || 'deterministic-local'}</p>
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
    fontSize: '1.1rem'
  },
  subtitle: {
    margin: '0 0 12px',
    lineHeight: 1.5,
    color: '#444'
  },
  line: {
    margin: '0 0 8px',
    lineHeight: 1.5
  }
};

export default LocaleQaPanel;
