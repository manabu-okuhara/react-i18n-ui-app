const enUS = require('../src/locales/en-US.json');
const jaJP = require('../src/locales/ja-JP.json');
const frCA = require('../src/locales/fr-CA.json');
const arEG = require('../src/locales/ar-EG.json');
const ruRU = require('../src/locales/ru-RU.json');
const trTR = require('../src/locales/tr-TR.json');
const customerLocaleConfig = require('../src/customerLocaleConfig.json');

const DEFAULT_LOCALE = 'en-US';
const DEFAULT_LANGUAGE_FALLBACKS = {
  ja: ['ja-JP', 'en-JP', 'en-US', 'en'],
  fr: ['fr-FR', 'fr-CA', 'en-FR', 'en-US', 'en'],
  ar: ['ar-EG', 'en-EG', 'en-US', 'en'],
  ru: ['ru-RU', 'en-RU', 'en-US', 'en'],
  tr: ['tr-TR', 'en-TR', 'en-US', 'en']
};

const STATIC_MESSAGES = {
  'en-US': enUS,
  'ja-JP': jaJP,
  'fr-CA': frCA,
  'ar-EG': arEG,
  'ru-RU': ruRU,
  'tr-TR': trTR
};

const BASE_MESSAGES = enUS;
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

function normalizeLocale(locale) {
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

function getLanguage(locale) {
  return locale.split('-')[0].toLowerCase();
}

function getLikelyLocale(locale) {
  const normalized = normalizeLocale(locale);

  if (!normalized) {
    return DEFAULT_LOCALE;
  }

  try {
    const localeInfo = new Intl.Locale(normalized);

    if (localeInfo.region) {
      return localeInfo.toString();
    }

    const maximized = localeInfo.maximize();
    return maximized.region
      ? `${maximized.language}-${maximized.region}`
      : normalized;
  } catch {
    return normalized;
  }
}

function getTranslationTarget(locale) {
  return getLanguage(locale);
}

function resolveStaticMessages(inputLocale, customerFallbacks = {}) {
  const normalized = getLikelyLocale(inputLocale);

  if (!normalized) {
    return {
      bundleLocale: DEFAULT_LOCALE,
      messages: BASE_MESSAGES
    };
  }

  if (STATIC_MESSAGES[normalized]) {
    return {
      bundleLocale: normalized,
      messages: STATIC_MESSAGES[normalized]
    };
  }

  const language = getLanguage(normalized);
  const customerChain = customerFallbacks[language] || [];
  const defaultChain = DEFAULT_LANGUAGE_FALLBACKS[language] || [];
  const candidates = [...customerChain, ...defaultChain, DEFAULT_LOCALE, 'en'];

  const resolved = candidates.find((candidate) => STATIC_MESSAGES[candidate]) || DEFAULT_LOCALE;
  return {
    bundleLocale: resolved,
    messages: STATIC_MESSAGES[resolved] || BASE_MESSAGES
  };
}

async function translateTextWithLibreTranslate(text, target, apiKey) {
  const endpoint = `${process.env.LIBRETRANSLATE_URL || 'http://localhost:5000'}/translate`;
  const body = {
    q: text,
    source: 'en',
    target,
    format: 'text'
  };

  if (apiKey) {
    body.api_key = apiKey;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`LibreTranslate request failed with status ${response.status}`);
  }

  const payload = await response.json();

  if (typeof payload.translatedText !== 'string') {
    throw new Error('LibreTranslate response did not include translatedText');
  }

  return payload.translatedText;
}

async function translateTextWithMyMemory(text, target) {
  const endpoint = new URL(process.env.MYMEMORY_TRANSLATE_URL || 'https://api.mymemory.translated.net/get');
  endpoint.searchParams.set('q', text);
  endpoint.searchParams.set('langpair', `en|${target}`);

  const response = await fetch(endpoint);

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

async function translateText(text, target, apiKey) {
  try {
    return await translateTextWithLibreTranslate(text, target, apiKey);
  } catch (libreError) {
    return translateTextWithMyMemory(text, target).catch((myMemoryError) => {
      throw new Error(
        `${libreError instanceof Error ? libreError.message : String(libreError)}; ` +
          `${myMemoryError instanceof Error ? myMemoryError.message : String(myMemoryError)}`
      );
    });
  }
}

function getEnglishPluralLine(count) {
  return count === 1
    ? 'There is 1 apple.'
    : `There are ${count} apples.`;
}

async function buildTranslatedPluralSentence(locale, apiKey) {
  const target = getTranslationTarget(locale);
  const dynamicCount = new Date().getSeconds() % 10;
  const heading = await translateText('Plurals with ICU Message Format:', target, apiKey);
  const lines = await Promise.all(
    [1, 3, 5, dynamicCount].map((count) => translateText(getEnglishPluralLine(count), target, apiKey))
  );

  return [heading, ...lines].join('\n');
}

async function generateTranslatedMessages(locale, apiKey) {
  const target = getTranslationTarget(locale);
  const entries = await Promise.all(
    TRANSLATABLE_KEYS.map(async (key) => [
      key,
      await translateText(BASE_MESSAGES[key], target, apiKey)
    ])
  );

  return {
    ...Object.fromEntries(entries),
    pluralSentence: await buildTranslatedPluralSentence(locale, apiKey)
  };
}

async function translateLocaleBundle(inputLocale) {
  const normalized = getLikelyLocale(inputLocale) || DEFAULT_LOCALE;
  const exactMessages = STATIC_MESSAGES[normalized];

  if (exactMessages) {
    return {
      locale: normalized,
      messages: exactMessages
    };
  }

  const customerFallbacks = customerLocaleConfig.localeFallbacks || {};
  const { bundleLocale, messages: fallbackMessages } = resolveStaticMessages(normalized, customerFallbacks);
  const apiKey = process.env.LIBRETRANSLATE_API_KEY || '';

  if (bundleLocale !== DEFAULT_LOCALE || getLanguage(bundleLocale) === getLanguage(normalized)) {
    return {
      locale: normalized,
      messages: fallbackMessages
    };
  }

  try {
    const translatedMessages = await generateTranslatedMessages(normalized, apiKey);

    return {
      locale: normalized,
      messages: {
        ...fallbackMessages,
        ...translatedMessages
      }
    };
  } catch (error) {
    console.error('translateLocaleBundle fallback', {
      locale: normalized,
      message: error instanceof Error ? error.message : String(error)
    });

    return {
      locale: normalized,
      messages: fallbackMessages
    };
  }
}

async function handleTranslateLocaleBundleRequest(req, res) {
  try {
    const { locale } = req.body || {};
    const payload = await translateLocaleBundle(locale);
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to translate locale bundle'
    });
  }
}

module.exports = {
  translateLocaleBundle,
  handleTranslateLocaleBundleRequest
};
