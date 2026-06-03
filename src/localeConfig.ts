export const DEFAULT_LOCALE = 'en-US';

export type LocaleCode = string;
export type LocaleFallbackMap = Record<string, LocaleCode[]>;

export const DEFAULT_LANGUAGE_FALLBACKS: LocaleFallbackMap = {
  ja: ['ja-JP', 'en-JP', 'en-US', 'en'],
  fr: ['fr-FR', 'fr-CA', 'en-FR', 'en-US', 'en'],
  ar: ['ar-EG', 'en-EG', 'en-US', 'en'],
  ru: ['ru-RU', 'en-RU', 'en-US', 'en'],
  tr: ['tr-TR', 'en-TR', 'en-US', 'en'],
  ko: ['ko-KR', 'en-KR', 'en-US', 'en'],
  zh: ['zh-CN', 'zh-TW', 'zh-HK', 'en-US', 'en'],
  de: ['de-DE', 'en-DE', 'en-US', 'en'],
  es: ['es-ES', 'es-419', 'en-ES', 'en-US', 'en'],
  pl: ['pl-PL', 'en-PL', 'en-US', 'en'],
  th: ['th-TH', 'en-TH', 'en-US', 'en']
};

export function getLanguage(locale: LocaleCode): string {
  return locale.split('-')[0].toLowerCase();
}
