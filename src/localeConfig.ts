export const DEFAULT_LOCALE = 'en-US';

export type LocaleCode = string;
export type LocaleFallbackMap = Record<string, LocaleCode[]>;

export const DEFAULT_LANGUAGE_FALLBACKS: LocaleFallbackMap = {
  ja: ['ja-JP', 'en-JP', 'en-US', 'en'],
  fr: ['fr-FR', 'fr-CA', 'en-FR', 'en-US', 'en'],
  ar: ['ar-EG', 'en-EG', 'en-US', 'en'],
  ru: ['ru-RU', 'en-RU', 'en-US', 'en']
};

export function getLanguage(locale: LocaleCode): string {
  return locale.split('-')[0].toLowerCase();
}
