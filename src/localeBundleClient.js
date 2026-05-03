import {
  buildPreparedLocaleBundle,
  getStaticMessagesForLocale,
  prepareLocaleBundle
} from './translateLocaleBundle';

export async function requestLocaleBundle(inputLocale, customerFallbacks = {}) {
  const trimmedLocale = inputLocale.trim();
  const { likelyLocale, bundleLocale } = getStaticMessagesForLocale(trimmedLocale, customerFallbacks);

  if (bundleLocale !== 'en-US' || likelyLocale === 'en-US') {
    return prepareLocaleBundle(trimmedLocale, customerFallbacks);
  }

  try {
    const response = await fetch('/api/translate-locale-bundle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ locale: trimmedLocale })
    });

    if (!response.ok) {
      throw new Error(`Locale bundle request failed with status ${response.status}`);
    }

    const payload = await response.json();

    return buildPreparedLocaleBundle({
      inputLocale: trimmedLocale,
      messages: payload.messages
    });
  } catch {
    return prepareLocaleBundle(trimmedLocale, customerFallbacks);
  }
}
