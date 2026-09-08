import React from 'react';

const QA_PANEL_MESSAGES = {
  heading: 'GenAI-Assisted Locale QA',
  subtitle: 'This assessment combines rule-based locale validation with AI-assisted quality review.',
  evaluating: 'Re-evaluating this locale bundle with deterministic checks and available GenAI services...'
};

function getStatusTone(status) {
  if (status === 'fail' || status === 'high') {
    return {
      backgroundColor: '#FDECEC',
      color: '#A61B1B',
      border: '1px solid #F5C2C2'
    };
  }

  if (status === 'warn' || status === 'medium') {
    return {
      backgroundColor: '#FFF4D6',
      color: '#8A5A00',
      border: '1px solid #F2CF74'
    };
  }

  return {
    backgroundColor: '#EAF7EE',
    color: '#17653A',
    border: '1px solid #B8E0C2'
  };
}

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

function LocaleQaPanel({ qaResult, bundle, isLoading = false }) {
  if (!bundle) {
    return null;
  }

  if (isLoading || !qaResult) {
    return (
      <section
        style={styles.panel}
        dir="ltr"
        aria-label={QA_PANEL_MESSAGES.heading}
        aria-busy="true"
      >
        <h2 style={styles.heading}>{QA_PANEL_MESSAGES.heading}</h2>
        <p style={styles.subtitle}>{QA_PANEL_MESSAGES.subtitle}</p>
        <p style={styles.loadingMessage} role="status" aria-live="polite">
          {QA_PANEL_MESSAGES.evaluating}
        </p>
      </section>
    );
  }

  const statusTone = getStatusTone(qaResult.status);
  const triageTone = getStatusTone(qaResult.triage?.severity);

  return (
    <section style={styles.panel} dir="ltr" aria-label={QA_PANEL_MESSAGES.heading}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.heading}>{QA_PANEL_MESSAGES.heading}</h2>
          <p style={styles.subtitle}>
            {QA_PANEL_MESSAGES.subtitle}
          </p>
        </div>
        <span style={{ ...styles.badge, ...statusTone }}>
          Status: {qaResult.status}
        </span>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Bundle Source</span>
          <span style={styles.summaryValue}>{bundle.bundleSource}</span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Formatting Locale</span>
          <span style={styles.summaryValue}>{bundle.formattingLocale}</span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Label Language</span>
          <span style={styles.summaryValue}>{bundle.labelLanguage}</span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Evaluation Service</span>
          <span style={styles.summaryValue}>{qaResult.serviceMeta?.mode || 'deterministic-local'}</span>
        </div>
      </div>

      <div style={{ ...styles.callout, ...triageTone }}>
        <p style={styles.calloutTitle}>Issue Type: {qaResult.triage.category}</p>
        <p style={styles.calloutText}>Recommendation: {qaResult.triage.recommendation}</p>
      </div>

      {qaResult.aiReview ? (
        <div style={styles.section}>
          <h3 style={styles.sectionHeading}>AI Review</h3>
          <div style={styles.aiMetaRow}>
            <span style={{ ...styles.badge, ...getStatusTone(qaResult.aiReview.confidence === 'high' ? 'pass' : qaResult.aiReview.confidence === 'medium' ? 'warn' : 'fail') }}>
              AI Confidence: {qaResult.aiReview.confidence}
            </span>
            <span style={styles.scoreBadge}>AI Score: {qaResult.aiReview.score}</span>
          </div>
          <p style={styles.line}><strong>GenAI Review Summary:</strong> {qaResult.aiReview.summary}</p>
          <p style={styles.line}><strong>Recommended Next Step:</strong> {qaResult.aiReview.recommendedNextStep}</p>
          {qaResult.aiReview.findings?.length ? (
            <div style={styles.listBlock}>
              {qaResult.aiReview.findings.map((finding) => (
                <div key={finding.id} style={{ ...styles.findingCard, ...getStatusTone(finding.severity) }}>
                  <p style={styles.findingTitle}>AI Finding ({finding.severity})</p>
                  <p style={styles.findingText}>{finding.message}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={styles.section}>
          <h3 style={styles.sectionHeading}>AI Review</h3>
          <p style={styles.line}>{getAiAvailabilityMessage(qaResult.serviceMeta)}</p>
        </div>
      )}

      <div style={styles.section}>
        <h3 style={styles.sectionHeading}>Deterministic Checks</h3>
        <div style={styles.listBlock}>
          {qaResult.checks.map((check) => (
            <div key={check.id} style={{ ...styles.checkCard, ...getStatusTone(check.status) }}>
              <p style={styles.findingTitle}>{check.label}: {check.status}</p>
              <p style={styles.findingText}>{check.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const styles = {
  panel: {
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid #ddd'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '16px'
  },
  heading: {
    margin: '0 0 10px',
    fontSize: '1.2rem'
  },
  subtitle: {
    margin: 0,
    fontSize: '1rem',
    lineHeight: 1.5,
    color: '#444'
  },
  loadingMessage: {
    margin: '16px 0 0',
    padding: '12px 14px',
    border: '1px solid #B6CCF7',
    borderRadius: '12px',
    backgroundColor: '#EAF3FF',
    color: '#1D4ED8',
    fontSize: '0.98rem',
    lineHeight: 1.5,
    fontWeight: 600
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    padding: '8px 12px',
    fontSize: '0.95rem',
    fontWeight: 700,
    whiteSpace: 'nowrap'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '12px',
    marginBottom: '16px'
  },
  summaryCard: {
    backgroundColor: '#F8F9FB',
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    padding: '12px 14px',
    display: 'grid',
    gap: '6px'
  },
  summaryLabel: {
    fontSize: '0.9rem',
    color: '#667085',
    fontWeight: 700
  },
  summaryValue: {
    fontSize: '1rem',
    color: '#101828',
    fontWeight: 600,
    wordBreak: 'break-word'
  },
  callout: {
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '16px'
  },
  calloutTitle: {
    margin: '0 0 6px',
    fontSize: '1rem',
    fontWeight: 700
  },
  calloutText: {
    margin: 0,
    fontSize: '0.98rem',
    lineHeight: 1.5
  },
  section: {
    marginTop: '18px'
  },
  sectionHeading: {
    margin: '0 0 10px',
    fontSize: '1rem',
    fontWeight: 700,
    color: '#111827'
  },
  aiMetaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '10px'
  },
  scoreBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    padding: '8px 12px',
    fontSize: '0.95rem',
    fontWeight: 700,
    backgroundColor: '#EAF3FF',
    color: '#1D4ED8',
    border: '1px solid #B6CCF7'
  },
  line: {
    margin: '0 0 10px',
    fontSize: '1rem',
    lineHeight: 1.6,
    color: '#111827'
  },
  listBlock: {
    display: 'grid',
    gap: '10px'
  },
  findingCard: {
    borderRadius: '12px',
    padding: '12px 14px'
  },
  checkCard: {
    borderRadius: '12px',
    padding: '12px 14px'
  },
  findingTitle: {
    margin: '0 0 4px',
    fontSize: '0.95rem',
    fontWeight: 700
  },
  findingText: {
    margin: 0,
    fontSize: '0.95rem',
    lineHeight: 1.5
  }
};

export default LocaleQaPanel;
