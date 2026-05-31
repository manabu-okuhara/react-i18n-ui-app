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

function isValidLocaleForIntl(locale) {
  try {
    new Intl.Locale(locale);
    new Intl.DateTimeFormat(locale);
    return true;
  } catch {
    return false;
  }
}

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

function getLikelyLocaleForLanguage(locale) {
  try {
    const language = new Intl.Locale(locale).language;
    return getLikelyLocale(language);
  } catch {
    return getLikelyLocale(locale);
  }
}

function getRegionalFormattingLocale(locale) {
  const likelyLocale = getLikelyLocale(locale);

  try {
    const localeInfo = new Intl.Locale(likelyLocale).maximize();
    const region = localeInfo.region;

    if (!region) {
      return {
        formattingLocale: 'en-US',
        wasFallback: true
      };
    }

    const regionLocaleInfo = new Intl.Locale(`und-${region}`).maximize();
    const regionLanguage = regionLocaleInfo.language;

    if (!regionLanguage) {
      return {
        formattingLocale: 'en-US',
        wasFallback: true
      };
    }

    const formattingLocale = `${regionLanguage}-${region}`;
    new Intl.DateTimeFormat(formattingLocale);

    return {
      formattingLocale,
      wasFallback: false
    };
  } catch {
    return {
      formattingLocale: 'en-US',
      wasFallback: true
    };
  }
}

function getDisplayNamesLocale(locale) {
  return [getLikelyLocale(locale), 'en-US'];
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

function getFirstDayOfWeek(regionLocale) {
  try {
    const localeInfo = new Intl.Locale(regionLocale);
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

    return new Intl.DateTimeFormat(regionLocale, {
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
  const requestedLocale = normalizeLocale(inputLocale);
  const localeUsedCandidate = getLikelyLocale(requestedLocale);
  const localeUsed = isValidLocaleForIntl(localeUsedCandidate)
    ? localeUsedCandidate
    : 'en-US';
  const {
    formattingLocale,
    wasFallback: didFallbackFormatting
  } = getRegionalFormattingLocale(localeUsed);
  const mergedMessages = { ...BASE_MESSAGES, ...messages };
  const year = now.getFullYear() % 100;
  const rawValue =
    (now.getMonth() + 1) * 10000 +
    now.getDate() * 100 +
    Math.floor(year / 10) * 10 +
    year / 100;

  return {
    inputLocale: localeUsed,
    inputLocaleDisplay:
      formattingLocale === localeUsed || localeUsed === getLikelyLocaleForLanguage(localeUsed)
        ? localeUsed
        : `${localeUsed} (${formattingLocale})`,
    formattingLocale,
    messages: mergedMessages,
    isRTL: isRTLLocale(localeUsed),
    warningMessage: localeUsedCandidate !== localeUsed
      ? formatMessage(
          mergedMessages.invalidLocaleMessage,
          {
            inputLocale: requestedLocale || inputLocale,
            fallbackLocale: localeUsed
          },
          localeUsed
        )
      : didFallbackFormatting
        ? formatMessage(
            mergedMessages.unresolvedLocaleMessage,
            {
              inputLocale: requestedLocale || inputLocale,
              fallbackLocale: 'en-US'
            },
            localeUsed
          )
        : '',
    values: {
      languageName: getLanguageName(localeUsed),
      regionName: getRegionName(localeUsed),
      currentDate: now.toLocaleString(formattingLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      todayDate: now.toLocaleDateString(formattingLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
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
        localeUsed
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
