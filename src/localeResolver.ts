import {
  DEFAULT_LOCALE,
  DEFAULT_LANGUAGE_FALLBACKS,
  getLanguage,
  type LocaleCode,
  type LocaleFallbackMap
} from './localeConfig';

type LocaleMessages = Record<string, unknown>;

export function normalizeLocale(locale?: string): string {
  if (!locale) {
    return '';
  }

  const sanitizedLocale = locale.replace(/_/g, '-').trim();

  try {
    return new Intl.Locale(sanitizedLocale).toString();
  } catch {
    return sanitizedLocale;
  }
}

export function resolveLocale(
  inputLocale?: string,
  messages: LocaleMessages = {},
  customerFallbacks: LocaleFallbackMap = {}
): LocaleCode {
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
