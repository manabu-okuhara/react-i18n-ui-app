import React, { useEffect, useMemo, useState } from 'react';
import enUS from './locales/en-US.json';
import jaJP from './locales/ja-JP.json';
import frCA from './locales/fr-CA.json';
import arEG from './locales/ar-EG.json';
import ruRU from './locales/ru-RU.json';
import customerLocaleConfig from './customerLocaleConfig.json';
import { resolveLocale } from './localeResolver';


const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur', 'ps', 'syr', 'dv'];
const AVAILABLE_LOCALES = ['en', 'en-US', 'ja', 'ja-JP', 'fr', 'fr-CA', 'ar', 'ar-EG', 'ru', 'ru-RU'];

const MESSAGES = {
  'en-US': enUS,
  'ja-JP': jaJP,
  'fr-CA': frCA,
  'ar-EG': arEG,
  'ru-RU': ruRU
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

function renderPluralMessage(message) {
  if (!message) {
    return '';
  }

  const segments = [];
  const matcher = /<noun>(.*?)<\/noun>|(\p{N}+)/gu;
  let cursor = 0;
  let match;

  while ((match = matcher.exec(message)) !== null) {
    if (match.index > cursor) {
      segments.push(message.slice(cursor, match.index));
    }

    if (match[1]) {
      segments.push(
        <span key={`noun-${match.index}`} style={styles.pluralNounText}>
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
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(locale.split('-')[0]);
  } catch {
    return locale;
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
    const rawValue =
      (now.getMonth() + 1) * 10000 +
      now.getDate() * 100 +
      (now.getFullYear() % 100) +
      (now.getFullYear() % 100 / 100);
    const numberString = new Intl.NumberFormat(effectiveLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(rawValue);
    const count = now.getSeconds() % 10;

    return {
      dateDisplay: renderFormattedMessage(messages.dateSentence, effectiveLocale, { currentDate: dateString }),
      countryDisplay: renderFormattedMessage(messages.countrySentence, effectiveLocale, { countryName: getRegionName(effectiveLocale) }),
      numberDisplay: renderFormattedMessage(messages.numberSentence, effectiveLocale, { formattedNumber: numberString }),
      pluralDisplay: formatMessage(messages.pluralSentence, {
        exampleOne: 1,
        exampleThree: 3,
        exampleFive: 5,
        count
      }, effectiveLocale)
    };
  }, [effectiveLocale, messages]);

  const suggestions = useMemo(() => {
    if (!searchTerm) {
      return [locale];
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchingLocales = AVAILABLE_LOCALES.filter((code) =>
      code.toLowerCase().startsWith(normalizedSearch)
    );

    return matchingLocales.slice(0, 10);
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
        <p style={styles.text}>{displayContent.dateDisplay}</p>
        <p style={styles.text}>{displayContent.countryDisplay}</p>
        <p style={styles.text}>{displayContent.numberDisplay}</p>
        <p style={styles.text}><strong>{renderPluralMessage(displayContent.pluralDisplay)}</strong></p>
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
    direction: 'inherit'
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
    color: 'black'
  },
  optionLabel: {
    fontSize: '14px',
    opacity: 0.7
  },
  valueText: {
    color: '#c62828',
    fontWeight: 600
  },
  pluralNounText: {
    color: '#c62828'
  },
  pluralValueText: {
    color: '#1565c0'
  },
  result: {
    display: 'grid',
    gap: '8px'
  },
  text: {
    color: 'black',
    margin: 0,
    lineHeight: 1.5
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 'bold',
    textAlign: 'inherit'
  }
};

export default Dashboard;
