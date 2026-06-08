import { evaluatePreparedBundle } from './localeQa';

export async function evaluateLocaleBundle(bundle) {
  try {
    const response = await fetch('/api/evaluate-locale-bundle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bundle)
    });

    if (!response.ok) {
      throw new Error(`Locale evaluation request failed with status ${response.status}`);
    }

    return response.json();
  } catch {
    return evaluatePreparedBundle(bundle, {
      mode: 'deterministic-local',
      genAiReady: true
    });
  }
}
