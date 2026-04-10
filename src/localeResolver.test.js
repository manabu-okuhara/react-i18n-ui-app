import { resolveLocale } from './localeResolver';

const messages = {
  'en-US': {},
  'ja-JP': {},
  'fr-CA': {},
  'ar-EG': {},
  'ru-RU': {}
};

test('returns exact locale match first', () => {
  expect(resolveLocale('ja-JP', messages, {})).toBe('ja-JP');
});

test('uses customer fallback before default fallback', () => {
  const customerFallbacks = {
    fr: ['fr-CA', 'en-US']
  };

  expect(resolveLocale('fr', messages, customerFallbacks)).toBe('fr-CA');
});

test('falls back to default chain when customer chain has no supported locale', () => {
  const customerFallbacks = {
    fr: ['fr-FR', 'en-FR']
  };

  expect(resolveLocale('fr', messages, customerFallbacks)).toBe('fr-CA');
});

test('falls back to en-US when nothing matches', () => {
  expect(resolveLocale('de-DE', messages, {})).toBe('en-US');
});

