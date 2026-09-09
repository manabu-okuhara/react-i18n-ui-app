import enUS from './locales/en-US.json';
import jaJP from './locales/ja-JP.json';
import frCA from './locales/fr-CA.json';
import arEG from './locales/ar-EG.json';
import ruRU from './locales/ru-RU.json';
import trTR from './locales/tr-TR.json';
import koKR from './locales/ko-KR.json';
import zhCN from './locales/zh-CN.json';
import zhTW from './locales/zh-TW.json';
import zhHK from './locales/zh-HK.json';
import deDE from './locales/de-DE.json';
import esES from './locales/es-ES.json';
import plPL from './locales/pl-PL.json';
import thTH from './locales/th-TH.json';
import es419 from './locales/es-419.json';
import { normalizeLocale, resolveLocale } from './localeResolver';

export const STATIC_LOCALES = ['en', 'en-US', 'ja', 'ja-JP', 'fr', 'fr-CA', 'ar', 'ar-EG', 'ru', 'ru-RU', 'tr', 'tr-TR', 'ko', 'ko-KR', 'zh', 'zh-CN', 'zh-TW', 'zh-HK', 'de', 'de-DE', 'es', 'es-ES', 'es-419', 'pl', 'pl-PL', 'th', 'th-TH'];
export const AVAILABLE_LOCALES = STATIC_LOCALES;

export const STATIC_MESSAGES = {
  'en-US': enUS,
  'ja-JP': jaJP,
  'fr-CA': frCA,
  'ar-EG': arEG,
  'ru-RU': ruRU,
  'tr-TR': trTR,
  'ko-KR': koKR,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'zh-HK': zhHK,
  'de-DE': deDE,
  'es-ES': esES,
  'pl-PL': plPL,
  'th-TH': thTH,
  'es-419': es419
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

export function getLocaleLanguage(locale = '') {
  return locale.split('-')[0].toLowerCase();
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

function formatPluralBlocks(message, locale, values, selectPluralCategory) {
  return message.replace(
    /\{(\w+),\s*plural,\s*((?:\w+\s*{.+?}\s*)+)\}/g,
    (_match, variableName, rulesString) => {
      const count = values[variableName];
      const rule = selectPluralCategory
        ? selectPluralCategory(count)
        : new Intl.PluralRules(locale).select(count);
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

export function formatMessage(message, values = {}, locale, selectPluralCategory) {
  if (!message) {
    return '';
  }

  const withPluralContent = formatPluralBlocks(
    message,
    locale,
    values,
    selectPluralCategory
  );

  return withPluralContent.replace(/{(\w+)}/g, (match, key) => (
    values[key] !== undefined ? values[key] : match
  ));
}


export function buildPluralPreviewMessage(message, locale, selectPluralCategory) {
  const formattedMessage = formatMessage(
    message,
    {
      exampleOne: 1,
      exampleThree: 3,
      exampleFive: 5,
      count: 1
    },
    locale,
    selectPluralCategory
  );

  const lines = formattedMessage.split('\n');
  return lines.length > 4 ? lines.slice(0, 4).join('\n') : formattedMessage;
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

function getRegionName(locale, displayLocales = getDisplayNamesLocale(locale)) {
  try {
    const region = new Intl.Locale(locale).maximize().region;
    const displayNames = new Intl.DisplayNames(displayLocales, { type: 'region' });
    return displayNames.of(region) || region;
  } catch {
    return 'N/A';
  }
}

function getLanguageName(locale, displayLocales = getDisplayNamesLocale(locale)) {
  try {
    const language = locale.split('-')[0];
    return new Intl.DisplayNames(displayLocales, { type: 'language' }).of(language) || language;
  } catch {
    return locale;
  }
}

function getWeekdayName(dayIndex, displayLocale) {
  const weekdayDateMap = {
    1: new Date(Date.UTC(2023, 0, 1, 12)),
    2: new Date(Date.UTC(2023, 0, 2, 12)),
    3: new Date(Date.UTC(2023, 0, 3, 12)),
    4: new Date(Date.UTC(2023, 0, 4, 12)),
    5: new Date(Date.UTC(2023, 0, 5, 12)),
    6: new Date(Date.UTC(2023, 0, 6, 12)),
    7: new Date(Date.UTC(2023, 0, 7, 12))
  };

  return new Intl.DateTimeFormat(displayLocale, {
    weekday: 'long',
    timeZone: 'UTC'
  }).format(weekdayDateMap[dayIndex]);
}

function getDatePattern(locale, date) {
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const options = formatter.resolvedOptions();
    const tokens = {
      year: options.year === '2-digit' ? 'yy' : 'y',
      month: {
        numeric: 'M',
        '2-digit': 'MM',
        short: 'MMM',
        long: 'MMMM',
        narrow: 'MMMMM'
      }[options.month] || 'M',
      day: options.day === '2-digit' ? 'dd' : 'd'
    };

    return formatter
      .formatToParts(date)
      .filter(({ type }) => type === 'year' || type === 'month' || type === 'day')
      .map(({ type }) => tokens[type])
      .join('');
  } catch {
    return '';
  }
}

function getTimePattern(locale, date) {
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit'
    });
    const options = formatter.resolvedOptions();
    const isTwelveHour = options.hourCycle === 'h11' || options.hourCycle === 'h12';
    const hourToken = isTwelveHour
      ? (options.hour === '2-digit' ? 'hh' : 'h')
      : (options.hour === '2-digit' ? 'HH' : 'H');
    const minuteToken = options.minute === '2-digit' ? 'mm' : 'm';

    return formatter
      .formatToParts(date)
      .map(({ type, value }) => {
        if (type === 'hour') return hourToken;
        if (type === 'minute') return minuteToken;
        if (type === 'dayPeriod') return 'a';
        if (type === 'literal') return value.replace(/[\u00a0\u202f]/g, ' ');
        return '';
      })
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return '';
  }
}

function getNumberPattern(locale, options = {}) {
  try {
    const formatter = new Intl.NumberFormat(locale, options);
    const resolvedOptions = formatter.resolvedOptions();
    const formattedParts = formatter.formatToParts(1234567890);
    const integerParts = formattedParts
      .filter(({ type }) => type === 'integer')
      .map(({ value }) => Array.from(value).length);
    const hasGrouping = formattedParts.some(({ type }) => type === 'group');
    const primaryGroupSize = integerParts.at(-1) || 1;
    const secondaryGroupSize = integerParts.length > 2
      ? integerParts.at(-2)
      : primaryGroupSize;
    const groupedIntegerPattern = secondaryGroupSize === primaryGroupSize
      ? `#,${'#'.repeat(Math.max(0, primaryGroupSize - 1))}0`
      : `#,${'#'.repeat(secondaryGroupSize)},${'#'.repeat(Math.max(0, primaryGroupSize - 1))}0`;
    const integerPattern = hasGrouping ? groupedIntegerPattern : '0';
    const fractionPattern = resolvedOptions.maximumFractionDigits > 0
      ? `.${'0'.repeat(resolvedOptions.minimumFractionDigits)}${'#'.repeat(
          resolvedOptions.maximumFractionDigits - resolvedOptions.minimumFractionDigits
        )}`
      : '';
    const numericPattern = `${integerPattern}${fractionPattern}`;

    if (resolvedOptions.style !== 'percent') {
      return numericPattern;
    }

    let includedNumber = false;
    return formatter
      .formatToParts(0.8)
      .map(({ type, value }) => {
        if (type === 'integer' || type === 'group' || type === 'decimal' || type === 'fraction') {
          if (includedNumber) return '';
          includedNumber = true;
          return numericPattern;
        }
        if (type === 'percentSign') return '%';
        if (type === 'literal') {
          return value
            .replace(/[\u061c\u200e\u200f]/g, '')
            .replace(/[\u00a0\u202f]/g, ' ');
        }
        return value;
      })
      .join('')
      .trim();
  } catch {
    return '';
  }
}

function getPluralPreviewCategories(locale) {
  try {
    const rules = new Intl.PluralRules(locale);
    return [1, 3, 5].map((count) => rules.select(count));
  } catch {
    return [];
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

    return getWeekdayName(firstDayOfWeek, regionLocale);
  } catch {
    return '';
  }
}


export function getFirstDayOfWeekIndex(regionLocale) {
  try {
    const localeInfo = new Intl.Locale(regionLocale);
    const intlFirstDay =
      localeInfo.getWeekInfo?.().firstDay ??
      localeInfo.weekInfo?.firstDay ??
      7;
    return intlFirstDay === 7 ? 1 : intlFirstDay + 1;
  } catch {
    return null;
  }
}

export function getPluralRuleSignature(locale) {
  try {
    const rules = new Intl.PluralRules(locale);
    const integerSamples = Array.from({ length: 201 }, (_value, count) => count);
    const decimalSamples = [0.1, 0.5, 1.1, 1.5, 2.1, 2.5, 10.1, 100.1];
    const categories = rules.resolvedOptions().pluralCategories || [];
    const selections = [...integerSamples, ...decimalSamples]
      .map((count) => `${count}:${rules.select(count)}`)
      .join('|');

    return `${categories.join(',')}|${selections}`;
  } catch {
    return '';
  }
}

export function buildPreparedLocaleBundle({
  inputLocale,
  messages,
  bundleLocale,
  bundleSource,
  now = new Date()
}) {
  const requestedLocale = normalizeLocale(inputLocale);
  const localeUsedCandidate = getLikelyLocale(requestedLocale);
  const localeUsed = isValidLocaleForIntl(localeUsedCandidate)
    ? localeUsedCandidate
    : 'en-US';
  const resolvedBundleLocale = bundleLocale || localeUsed;
  const resolvedBundleSource = bundleSource || 'generated';
  const {
    formattingLocale,
    wasFallback: didFallbackFormatting
  } = getRegionalFormattingLocale(localeUsed);
  const mergedMessages = { ...BASE_MESSAGES, ...messages };
  const fallbackReason = localeUsedCandidate !== localeUsed
    ? 'invalid_locale'
    : didFallbackFormatting
      ? 'unresolved_region'
      : resolvedBundleSource === 'fallback_english'
        ? 'unsupported_locale'
        : null;
  const labelLanguage = getLocaleLanguage(resolvedBundleLocale || localeUsed);
  const year = now.getFullYear() % 100;
  const rawValue =
    (now.getMonth() + 1) * 10000 +
    now.getDate() * 100 +
    Math.floor(year / 10) * 10 +
    year / 100;
  const numberOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  };
  const percentOptions = {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  };

  return {
    inputLocale: localeUsed,
    generatedAt: now.toISOString(),
    inputLocaleDisplay:
      formattingLocale === localeUsed || localeUsed === getLikelyLocaleForLanguage(localeUsed)
        ? localeUsed
        : `${localeUsed} (${formattingLocale})`,
    localeUsed,
    bundleLocale: resolvedBundleLocale,
    formattingLocale,
    labelLanguage,
    bundleSource: resolvedBundleSource,
    usedFallback: Boolean(fallbackReason),
    fallbackReason,
    isMixedLocale: labelLanguage !== getLocaleLanguage(formattingLocale),
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
      languageNameEnglish: getLanguageName(localeUsed, ['en-US']),
      regionName: getRegionName(localeUsed),
      regionNameEnglish: getRegionName(localeUsed, ['en-US']),
      currentDate: now.toLocaleString(formattingLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      datePattern: getDatePattern(formattingLocale, now),
      dateTimePattern: [
        getDatePattern(formattingLocale, now),
        getTimePattern(formattingLocale, now)
      ].filter(Boolean).join(' '),
      todayDate: now.toLocaleDateString(formattingLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      formattedNumber: new Intl.NumberFormat(formattingLocale, numberOptions).format(rawValue),
      numberRawValue: rawValue,
      numberPattern: getNumberPattern(formattingLocale, numberOptions),
      percentValue: new Intl.NumberFormat(formattingLocale, percentOptions).format(0.8),
      percentRawValue: 0.8,
      percentPattern: getNumberPattern(formattingLocale, percentOptions),
      firstDayOfWeek: getFirstDayOfWeek(formattingLocale),
      firstDayOfWeekEnglish: getWeekdayName(
        getFirstDayOfWeekIndex(formattingLocale),
        'en-US'
      ),
      firstDayOfWeekIndex: getFirstDayOfWeekIndex(formattingLocale),
      pluralRuleSignature: getPluralRuleSignature(localeUsed),
      pluralPreviewCounts: [1, 3, 5],
      pluralPreviewCategories: getPluralPreviewCategories(localeUsed),
      pluralMessage: buildPluralPreviewMessage(
        mergedMessages.pluralSentence,
        localeUsed
      )
    }
  };
}

export function prepareLocaleBundle(inputLocale, customerFallbacks = {}, now = new Date()) {
  const { likelyLocale, bundleLocale, messages } = getStaticMessagesForLocale(inputLocale, customerFallbacks);
  const bundleSource = bundleLocale === 'en-US' && getLocaleLanguage(likelyLocale) !== 'en'
    ? 'fallback_english'
    : 'built_in';

  return buildPreparedLocaleBundle({
    inputLocale,
    messages,
    bundleLocale,
    bundleSource,
    now
  });
}
