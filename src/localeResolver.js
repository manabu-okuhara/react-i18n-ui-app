import {
  DEFAULT_LOCALE,
  DEFAULT_LANGUAGE_FALLBACKS,
  getLanguage
} from './localeConfig';

export function normalizeLocale(locale) {
  if (!locale) {
    return '';
  }

  try {
    return Intl.getCanonicalLocales(locale)[0];
  } catch {
    return locale;
  }
}

export function resolveLocale(inputLocale, messages, customerFallbacks = {}) {
  const normalized = normalizeLocale(inputLocale);

  if (!normalized) {
    return DEFAULT_LOCALE;
  }

  if (messages[normalized]) {
    return normalized;
  }

  const language = getLanguage(normalized);
  const customerChain = customerFallbacks[language] || [];
  const defaultChain = DEFAULT_LANGUAGE_FALLBACKS[language] || [];

  const candidates = [
    ...customerChain,
    ...defaultChain,
    DEFAULT_LOCALE,
    'en'
  ];

  const resolved = candidates.find((candidate) => messages[candidate]);
  return resolved || DEFAULT_LOCALE;
}

