import {
  BASE_MESSAGES,
  buildPreparedLocaleBundle,
  getLikelyLocale,
  getStaticMessagesForLocale,
  prepareLocaleBundle
} from './translateLocaleBundle';

const TRANSLATABLE_KEYS = [
  'title',
  'chooseLocale',
  'searchPlaceholder',
  'inputLocaleSentence',
  'languageSentence',
  'regionSentence',
  'icuSectionTitle',
  'dateSentence',
  'numberSentence',
  'percentSentence',
  'firstDayOfWeekSentence',
  'invalidLocaleMessage',
  'share',
  'copyConfirmation',
  'copyError'
];

function getTranslationTarget(locale) {
  return getLikelyLocale(locale).split('-')[0].toLowerCase();
}

function getLocaleLanguage(locale) {
  return locale.split('-')[0].toLowerCase();
}

function isLikelyEnglishFallback(locale, messages = {}) {
  const target = getTranslationTarget(locale);

  if (target === 'en') {
    return false;
  }

  const keysToCheck = [
    'title',
    'chooseLocale',
    'inputLocaleSentence',
    'icuSectionTitle',
    'dateSentence',
    'percentSentence',
    'firstDayOfWeekSentence'
  ];
  const unchangedCount = keysToCheck.filter((key) => messages[key] === BASE_MESSAGES[key]).length;

  return unchangedCount >= 3;
}

async function translateTextWithMyMemory(text, target) {
  const endpoint = new URL('https://api.mymemory.translated.net/get');
  endpoint.searchParams.set('q', text);
  endpoint.searchParams.set('langpair', `en|${target}`);

  const response = await fetch(endpoint.toString());

  if (!response.ok) {
    throw new Error(`MyMemory request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const translatedText = payload?.responseData?.translatedText;

  if (typeof translatedText !== 'string' || !translatedText.trim()) {
    throw new Error('MyMemory response did not include translatedText');
  }

  return translatedText;
}

function getEnglishPluralLine(count) {
  return count === 1
    ? 'There is 1 apple.'
    : `There are ${count} apples.`;
}

async function buildTranslatedPluralSentence(locale) {
  const target = getTranslationTarget(locale);
  const dynamicCount = new Date().getSeconds() % 10;
  const heading = await translateTextWithMyMemory('Plurals (ICU Message Format):', target);
  const lines = await Promise.all(
    [1, 3, 5, dynamicCount].map((count) =>
      translateTextWithMyMemory(getEnglishPluralLine(count), target)
    )
  );

  return [heading, ...lines].join('\n');
}

async function buildClientTranslatedMessages(locale) {
  const target = getTranslationTarget(locale);
  const entries = await Promise.all(
    TRANSLATABLE_KEYS.map(async (key) => [
      key,
      await translateTextWithMyMemory(BASE_MESSAGES[key], target)
    ])
  );

  return {
    ...Object.fromEntries(entries),
    pluralSentence: await buildTranslatedPluralSentence(locale)
  };
}

export async function requestLocaleBundle(inputLocale, customerFallbacks = {}) {
  const trimmedLocale = inputLocale.trim();
  const { likelyLocale, bundleLocale } = getStaticMessagesForLocale(trimmedLocale, customerFallbacks);

  if (bundleLocale !== 'en-US' || getLocaleLanguage(bundleLocale) === getLocaleLanguage(likelyLocale)) {
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

    if (isLikelyEnglishFallback(trimmedLocale, payload.messages)) {
      throw new Error('Backend returned untranslated fallback messages');
    }

    return buildPreparedLocaleBundle({
      inputLocale: trimmedLocale,
      messages: payload.messages,
      bundleLocale: payload.locale || getLikelyLocale(trimmedLocale),
      bundleSource: 'generated'
    });
  } catch {
    try {
      const messages = await buildClientTranslatedMessages(trimmedLocale);

      return buildPreparedLocaleBundle({
        inputLocale: trimmedLocale,
        messages,
        bundleLocale: getLikelyLocale(trimmedLocale),
        bundleSource: 'generated'
      });
    } catch {
      return prepareLocaleBundle(trimmedLocale, customerFallbacks);
    }
  }
}
