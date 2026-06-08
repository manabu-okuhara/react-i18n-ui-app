function evaluatePreparedBundle(bundle, serviceMeta = { mode: 'deterministic-service', genAiReady: true }) {
  const checks = [];

  checks.push({
    id: 'bundle-source',
    label: 'Bundle Source',
    status: bundle.bundleSource === 'built_in' ? 'pass' : 'warn',
    detail: bundle.bundleSource
  });

  if (bundle.usedFallback) {
    checks.push({
      id: 'fallback',
      label: 'Fallback Usage',
      status: bundle.fallbackReason === 'invalid_locale' ? 'fail' : 'warn',
      detail: bundle.fallbackReason || 'fallback used'
    });
  }

  if (bundle.isMixedLocale) {
    checks.push({
      id: 'mixed-locale',
      label: 'Mixed Locale Handling',
      status: 'warn',
      detail: `${bundle.labelLanguage} labels with ${bundle.formattingLocale} formatting`
    });
  }

  checks.push({
    id: 'plural-source',
    label: 'Plural Quality',
    status: bundle.bundleSource === 'built_in' ? 'pass' : 'warn',
    detail: bundle.bundleSource === 'built_in'
      ? 'Built-in bundle plural rules'
      : 'Generated or fallback plural content'
  });

  const status = checks.some((check) => check.status === 'fail')
    ? 'fail'
    : checks.some((check) => check.status === 'warn')
      ? 'warn'
      : 'pass';

  return {
    status,
    checks,
    triage: buildTriage(bundle),
    serviceMeta
  };
}

function buildTriage(bundle) {
  if (bundle.fallbackReason === 'invalid_locale') {
    return {
      category: 'invalid-locale',
      severity: 'high',
      recommendation: `Using ${bundle.formattingLocale} fallback because the locale tag is invalid.`
    };
  }

  if (bundle.isMixedLocale) {
    return {
      category: 'mixed-locale',
      severity: 'low',
      recommendation: 'No action needed unless you want custom hybrid formatting.'
    };
  }

  if (bundle.bundleSource === 'generated') {
    return {
      category: 'generated-locale',
      severity: 'medium',
      recommendation: 'Consider creating a built-in bundle for this locale.'
    };
  }

  if (bundle.bundleSource === 'fallback_english') {
    return {
      category: 'fallback-locale',
      severity: 'medium',
      recommendation: 'Consider creating or generating a locale bundle for this locale.'
    };
  }

  return {
    category: 'built-in-locale',
    severity: 'low',
    recommendation: 'No action needed.'
  };
}

async function handleEvaluateLocaleBundleRequest(req, res) {
  try {
    const bundle = req.body || {};
    const payload = evaluatePreparedBundle(bundle, {
      mode: 'deterministic-service',
      genAiReady: true
    });
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to evaluate locale bundle'
    });
  }
}

module.exports = {
  evaluatePreparedBundle,
  handleEvaluateLocaleBundleRequest
};
