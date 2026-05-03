import enUS from './locales/en-US.json';
import jaJP from './locales/ja-JP.json';
import frCA from './locales/fr-CA.json';
import arEG from './locales/ar-EG.json';
import ruRU from './locales/ru-RU.json';
import trTR from './locales/tr-TR.json';
import { normalizeLocale, resolveLocale } from './localeResolver';

export const STATIC_LOCALES = ['en', 'en-US', 'ja', 'ja-JP', 'fr', 'fr-CA', 'ar', 'ar-EG', 'ru', 'ru-RU', 'tr', 'tr-TR'];
export const AVAILABLE_LOCALES = STATIC_LOCALES;

export const STATIC_MESSAGES = {
  'en-US': enUS,
  'ja-JP': jaJP,
  'fr-CA': frCA,
  'ar-EG': arEG,
  'ru-RU': ruRU,
  'tr-TR': trTR
};

export const BASE_MESSAGES = enUS;

export function getLikelyLocale(locale) {
  const normalized = normalizeLocale(locale);

  if (!normalized) {
    return 'en-US';
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

function getFormattingLocale(locale) {
  return getLikelyLocale(locale);
}

function getDisplayNamesLocale(locale) {
  return [getFormattingLocale(locale), 'en-US'];
}

function isRTLLocale(locale) {
  try {
    const localeInfo = new Intl.Locale(locale);
    const direction =
      localeInfo.getTextInfo?.().direction ??
      localeInfo.textInfo?.direction ??
      'ltr';

    return direction === 'rtl';
  } catch {
    return false;
  }
}

function formatPluralBlocks(message, locale, values) {
  return message.replace(
    /\{(\w+),\s*plural,\s*((?:\w+\s*{.+?}\s*)+)\}/g,
    (_match, variableName, rulesString) => {
      const count = values[variableName];
      const rule = new Intl.PluralRules(locale).select(count);
      const parts = rulesString.match(/(\w+)\s*{(.+?)}/g) || [];
      const ruleMap = {};

      parts.forEach((part) => {
        const match = part.match(/(\w+)\s*{(.+?)}/);
        if (match) {
          ruleMap[match[1]] = match[2];
        }
      });

      const localizedPattern = ruleMap[rule] || ruleMap.other || '';
      return localizedPattern.replace('#', new Intl.NumberFormat(locale).format(count));
    }
  );
}

export function formatMessage(message, values = {}, locale) {
  if (!message) {
    return '';
  }

  const withPluralContent = formatPluralBlocks(message, locale, values);

  return withPluralContent.replace(/{(\w+)}/g, (match, key) => (
    values[key] !== undefined ? values[key] : match
  ));
}

export function getStaticMessagesForLocale(inputLocale, customerFallbacks = {}) {
  const likelyLocale = getLikelyLocale(inputLocale);
  const resolvedLocale = resolveLocale(likelyLocale, STATIC_MESSAGES, customerFallbacks);

  return {
    likelyLocale,
    bundleLocale: resolvedLocale,
    messages: STATIC_MESSAGES[resolvedLocale] || BASE_MESSAGES
  };
}

function getRegionName(locale) {
  try {
    const region = new Intl.Locale(locale).maximize().region;
    const displayNames = new Intl.DisplayNames(getDisplayNamesLocale(locale), { type: 'region' });
    return displayNames.of(region) || region;
  } catch {
    return 'N/A';
  }
}

function getLanguageName(locale) {
  try {
    const language = locale.split('-')[0];
    return new Intl.DisplayNames(getDisplayNamesLocale(locale), { type: 'language' }).of(language) || language;
  } catch {
    return locale;
  }
}

function getFirstDayOfWeek(locale) {
  try {
    const localeInfo = new Intl.Locale(locale);
    const intlFirstDay =
      localeInfo.getWeekInfo?.().firstDay ??
      localeInfo.weekInfo?.firstDay ??
      7;
    const firstDayOfWeek = intlFirstDay === 7 ? 1 : intlFirstDay + 1;

    const weekdayDateMap = {
      1: new Date(Date.UTC(2023, 0, 1, 12)),
      2: new Date(Date.UTC(2023, 0, 2, 12)),
      3: new Date(Date.UTC(2023, 0, 3, 12)),
      4: new Date(Date.UTC(2023, 0, 4, 12)),
      5: new Date(Date.UTC(2023, 0, 5, 12)),
      6: new Date(Date.UTC(2023, 0, 6, 12)),
      7: new Date(Date.UTC(2023, 0, 7, 12))
    };

    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      timeZone: 'UTC'
    }).format(weekdayDateMap[firstDayOfWeek]);
  } catch {
    return '';
  }
}

export function buildPreparedLocaleBundle({
  inputLocale,
  messages,
  now = new Date()
}) {
  const formattingLocale = getFormattingLocale(inputLocale);
  const mergedMessages = { ...BASE_MESSAGES, ...messages };
  const year = now.getFullYear() % 100;
  const rawValue =
    (now.getMonth() + 1) * 10000 +
    now.getDate() * 100 +
    Math.floor(year / 10) * 10 +
    year / 100;

  return {
    inputLocale,
    formattingLocale,
    messages: mergedMessages,
    isRTL: isRTLLocale(formattingLocale),
    values: {
      languageName: getLanguageName(formattingLocale),
      regionName: getRegionName(formattingLocale),
      currentDate: now.toLocaleString(formattingLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      formattedNumber: new Intl.NumberFormat(formattingLocale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(rawValue),
      percentValue: new Intl.NumberFormat(formattingLocale, {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(0.8),
      firstDayOfWeek: getFirstDayOfWeek(formattingLocale),
      pluralMessage: formatMessage(
        mergedMessages.pluralSentence,
        {
          exampleOne: 1,
          exampleThree: 3,
          exampleFive: 5,
          count: now.getSeconds() % 10
        },
        formattingLocale
      )
    }
  };
}

export function prepareLocaleBundle(inputLocale, customerFallbacks = {}, now = new Date()) {
  const { messages } = getStaticMessagesForLocale(inputLocale, customerFallbacks);

  return buildPreparedLocaleBundle({
    inputLocale,
    messages,
    now
  });
}
