import React, { useEffect, useMemo, useState } from 'react';
import enUS from './locales/en-US.json';
import jaJP from './locales/ja-JP.json';
import frCA from './locales/fr-CA.json';
import arEG from './locales/ar-EG.json';
import ruRU from './locales/ru-RU.json';
import trTR from './locales/tr-TR.json';
import customerLocaleConfig from './customerLocaleConfig.json';
import { resolveLocale } from './localeResolver';

const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur', 'ps', 'syr', 'dv'];
const AVAILABLE_LOCALES = ['en', 'en-US', 'ja', 'ja-JP', 'fr', 'fr-CA', 'ar', 'ar-EG', 'ru', 'ru-RU', 'tr', 'tr-TR'];

const MESSAGES = {
  'en-US': enUS,
  'ja-JP': jaJP,
  'fr-CA': frCA,
  'ar-EG': arEG,
  'ru-RU': ruRU,
  'tr-TR': trTR
};

function getInitialLocale() {
  const params = new URLSearchParams(window.location.search);
  return params.get('hl') || (navigator.languages ? navigator.languages[0] : navigator.language);
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

function formatMessage(message, values = {}, locale) {
  if (!message) {
    return '';
  }

  const withPluralContent = formatPluralBlocks(message, locale, values);

  return withPluralContent.replace(/{(\w+)}/g, (match, key) => (
    values[key] !== undefined ? values[key] : match
  ));
}

function renderFormattedMessage(message, locale, values = {}) {
  const formatted = formatMessage(message, values, locale);
  const highlightedValues = new Set(
    Object.values(values)
      .filter((value) => value !== undefined && value !== null)
      .map((value) => String(value))
      .filter(Boolean)
  );

  if (highlightedValues.size === 0) {
    return formatted;
  }

  const segments = [];
  let cursor = 0;
  let key = 0;

  while (cursor < formatted.length) {
    let matchValue = '';
    let matchIndex = -1;

    for (const value of highlightedValues) {
      const index = formatted.indexOf(value, cursor);
      if (index === -1) {
        continue;
      }

      if (matchIndex === -1 || index < matchIndex || (index === matchIndex && value.length > matchValue.length)) {
        matchIndex = index;
        matchValue = value;
      }
    }

    if (matchIndex === -1) {
      segments.push(formatted.slice(cursor));
      break;
    }

    if (matchIndex > cursor) {
      segments.push(formatted.slice(cursor, matchIndex));
    }

    segments.push(
      <span key={`value-${key}`} style={styles.valueText}>
        {matchValue}
      </span>
    );

    cursor = matchIndex + matchValue.length;
    key += 1;
  }

  return segments;
}

function renderNumberWithSeparatorColors(value) {
  return value.split('').map((char, index) => {
    const isSeparator = /[.,٬٫]/u.test(char);
    return (
      <span
        key={`number-${index}`}
        style={isSeparator ? styles.separatorText : styles.valueText}
      >
        {char}
      </span>
    );
  });
}

function renderValueSentence(message, renderedValue) {
  const marker = '__VALUE__';
  const templated = message.replace('{value}', marker);
  const [before, after] = templated.split(marker);

  return (
    <>
      {before}
      {renderedValue}
      {after}
    </>
  );
}

function renderPluralMessage(message) {
  if (!message) {
    return '';
  }

  const segments = [];
  const matcher = /<accent>(.*?)<\/accent>|(\p{N}+)/gu;
  let cursor = 0;
  let match;

  while ((match = matcher.exec(message)) !== null) {
    if (match.index > cursor) {
      segments.push(message.slice(cursor, match.index));
    }

    if (match[1]) {
      segments.push(
        <span key={`accent-${match.index}`} style={styles.pluralAccentText}>
          {match[1]}
        </span>
      );
    } else if (match[2]) {
      segments.push(
        <span key={`number-${match.index}`} style={styles.pluralValueText}>
          {match[2]}
        </span>
      );
    }

    cursor = matcher.lastIndex;
  }

  if (cursor < message.length) {
    segments.push(message.slice(cursor));
  }

  return segments;
}

function getRegionName(locale) {
  try {
    const region = new Intl.Locale(locale).maximize().region;
    const displayNames = new Intl.DisplayNames([locale], { type: 'region' });
    return displayNames.of(region) || region;
  } catch {
    return 'N/A';
  }
}

function getLanguageName(locale) {
  try {
    const language = locale.split('-')[0];
    return new Intl.DisplayNames([locale], { type: 'language' }).of(language) || language;
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

    // ICU/ECMA-402: Monday=1 ... Sunday=7
    // Demo mapping: Sunday=1, Monday=2, ... Saturday=7
    const firstDayOfWeek = intlFirstDay === 7 ? 1 : intlFirstDay + 1;

    const weekdayDateMap = {
      1: new Date(Date.UTC(2023, 0, 1, 12)), // Sunday
      2: new Date(Date.UTC(2023, 0, 2, 12)), // Monday
      3: new Date(Date.UTC(2023, 0, 3, 12)), // Tuesday
      4: new Date(Date.UTC(2023, 0, 4, 12)), // Wednesday
      5: new Date(Date.UTC(2023, 0, 5, 12)), // Thursday
      6: new Date(Date.UTC(2023, 0, 6, 12)), // Friday
      7: new Date(Date.UTC(2023, 0, 7, 12))  // Saturday
    };

    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      timeZone: 'UTC'
    }).format(weekdayDateMap[firstDayOfWeek]);
  } catch {
    return '';
  }
}

function Dashboard() {
  const [locale, setLocale] = useState(getInitialLocale());
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const customerFallbacks = useMemo(
    () => customerLocaleConfig.localeFallbacks || {},
    []
  );
  const effectiveLocale = resolveLocale(locale, MESSAGES, customerFallbacks);
  const messages = MESSAGES[effectiveLocale];

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('hl', locale);
    window.history.replaceState({}, '', url);
  }, [locale]);

  const isRTL = useMemo(() => {
    const language = effectiveLocale.split('-')[0].toLowerCase();
    return RTL_LANGUAGES.includes(language);
  }, [effectiveLocale]);

  const displayContent = useMemo(() => {
    const now = new Date();
    const dateString = now.toLocaleString(effectiveLocale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const year = now.getFullYear() % 100;
    const rawValue =
      (now.getMonth() + 1) * 10000 +
      now.getDate() * 100 +
      Math.floor(year / 10) * 10 +
      year / 100;

    const numberString = new Intl.NumberFormat(effectiveLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(rawValue);

    const percentString = new Intl.NumberFormat(effectiveLocale, {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(0.8);

    const firstDayOfWeek = getFirstDayOfWeek(effectiveLocale);
    const count = now.getSeconds() % 10;
    const languageName = getLanguageName(effectiveLocale);
    const regionName = getRegionName(effectiveLocale);

    return {
      inputLocaleDisplay: renderFormattedMessage(messages.inputLocaleSentence, effectiveLocale, { inputLocale: locale }),
      languageDisplay: renderFormattedMessage(messages.languageSentence, effectiveLocale, { languageName }),
      regionDisplay: renderFormattedMessage(messages.regionSentence, effectiveLocale, { regionName }),
      dateDisplay: renderFormattedMessage(messages.dateSentence, effectiveLocale, { currentDate: dateString }),
      numberDisplay: renderValueSentence(
        messages.numberSentence,
        renderNumberWithSeparatorColors(numberString)
      ),
      percentDisplay: renderFormattedMessage(messages.percentSentence, effectiveLocale, { percentValue: percentString }),
      firstDayOfWeekDisplay: renderFormattedMessage(
        messages.firstDayOfWeekSentence,
        effectiveLocale,
        { firstDayOfWeek }
      ),
      pluralDisplay: formatMessage(
        messages.pluralSentence,
        {
          exampleOne: 1,
          exampleThree: 3,
          exampleFive: 5,
          count
        },
        effectiveLocale
      )
    };
  }, [effectiveLocale, locale, messages]);

  const suggestions = useMemo(() => {
    if (!searchTerm) {
      return [locale];
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchingLocales = AVAILABLE_LOCALES.filter((code) =>
      code.toLowerCase().startsWith(normalizedSearch)
    );

    return matchingLocales.slice(0, 12);
  }, [locale, searchTerm]);

  const submitLocale = (nextLocale) => {
    const trimmedLocale = nextLocale.trim();

    if (!trimmedLocale) {
      return;
    }

    setLocale(trimmedLocale);
    setSearchTerm(trimmedLocale);
    setShowDropdown(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      window.alert(messages.copyConfirmation);
    } catch {
      window.alert(messages.copyError);
    }
  };

  return (
    <div
      style={{
        ...styles.container,
        textAlign: isRTL ? 'right' : 'left'
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div style={styles.topBar}>
        <h1 style={styles.header}>{messages.title}</h1>
        <button onClick={copyLink} style={styles.shareBtn} type="button">
          {messages.share}
        </button>
      </div>

      <div style={styles.searchContainer}>
        <label htmlFor="locale-input" style={styles.label}>{messages.chooseLocale}</label>
        <input
          id="locale-input"
          type="text"
          placeholder={messages.searchPlaceholder}
          value={searchTerm}
          onFocus={() => setShowDropdown(true)}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setShowDropdown(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submitLocale(searchTerm);
            }
          }}
          style={styles.input}
        />

        {showDropdown && suggestions.length > 0 && (
          <div style={styles.dropdown}>
            {suggestions.map((code) => (
              <button
                key={code}
                style={styles.option}
                type="button"
                onClick={() => {
                  submitLocale(code);
                }}
              >
                <strong style={styles.optionCode}>{code}</strong>
                <span style={styles.optionLabel}>{getLanguageName(code)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={styles.result}>
        <p style={styles.text}>{displayContent.inputLocaleDisplay}</p>
        <p style={styles.text}>{displayContent.languageDisplay}</p>
        <p style={styles.text}>{displayContent.regionDisplay}</p>
        <p style={styles.text}>{displayContent.dateDisplay}</p>
        <p style={styles.text}>{displayContent.numberDisplay}</p>
        <p style={styles.text}>{displayContent.percentDisplay}</p>
        <p style={styles.text}>{displayContent.firstDayOfWeekDisplay}</p>
        <p style={{ ...styles.text, ...styles.pluralBlock }}>
          {renderPluralMessage(displayContent.pluralDisplay)}
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '25px',
    fontFamily: 'sans-serif',
    maxWidth: '420px',
    margin: '40px auto',
    border: '1px solid #ddd',
    borderRadius: '16px',
    backgroundColor: '#fff',
    color: 'black',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    position: 'relative'
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px'
  },
  header: {
    margin: 0,
    fontSize: '1.6rem'
  },
  shareBtn: {
    border: 'none',
    borderRadius: '8px',
    padding: '10px 12px',
    backgroundColor: '#282c34',
    color: '#fff',
    cursor: 'pointer'
  },
  searchContainer: {
    marginBottom: '20px'
  },
  input: {
    width: '100%',
    padding: '12px',
    boxSizing: 'border-box',
    border: '2px solid #eee',
    borderRadius: '8px',
    outline: 'none',
    color: 'black',
    textAlign: 'inherit',
    direction: 'inherit',
    fontSize: '14px'
  },
  dropdown: {
    display: 'grid',
    gap: '8px',
    marginTop: '10px'
  },
  option: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#f6f7fb',
    color: 'black',
    cursor: 'pointer',
    textAlign: 'inherit'
  },
  optionCode: {
    color: 'black',
    fontSize: '14px'
  },
  optionLabel: {
    fontSize: '12px',
    opacity: 0.7
  },
  valueText: {
    color: '#c62828',
    fontWeight: 600
  },
  separatorText: {
    color: '#1565c0',
    fontWeight: 600
  },
  pluralAccentText: {
    color: '#c62828'
  },
  pluralValueText: {
    color: '#1565c0'
  },
  pluralBlock: {
    whiteSpace: 'pre-line'
  },
  result: {
    display: 'grid',
    gap: '8px'
  },
  text: {
    color: 'black',
    margin: 0,
    lineHeight: 1.5,
    fontSize: '14px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 'bold',
    textAlign: 'inherit',
    fontSize: '14px'
  }
};

export default Dashboard;

