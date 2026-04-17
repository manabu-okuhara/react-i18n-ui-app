import React, { useEffect, useMemo, useState } from 'react';
import enUS from './locales/en-US.json';
import jaJP from './locales/ja-JP.json';
import frCA from './locales/fr-CA.json';
import arEG from './locales/ar-EG.json';
import ruRU from './locales/ru-RU.json';
import customerLocaleConfig from './customerLocaleConfig.json';
import { resolveLocale } from './localeResolver';


const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur', 'ps', 'syr', 'dv'];

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

  const customerFallbacks = customerLocaleConfig.localeFallbacks || {};
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
      dateDisplay: formatMessage(messages.dateSentence, { currentDate: dateString }, effectiveLocale),
      countryDisplay: formatMessage(messages.countrySentence, { countryName: getRegionName(effectiveLocale) }, effectiveLocale),
      numberDisplay: formatMessage(messages.numberSentence, { formattedNumber: numberString }, effectiveLocale),
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
  }, [effectiveLocale, messages]);

  const suggestions = useMemo(() => {
    if (!searchTerm) {
      return [locale];
    }

    const results = new Set();

    try {
      const validated = Intl.getCanonicalLocales(searchTerm)[0];
      results.add(validated);

      const resolved = resolveLocale(validated, MESSAGES, customerFallbacks);
      results.add(resolved);
    } catch {
      return [];
    }

    return Array.from(results).slice(0, 5);
  }, [locale, searchTerm, customerFallbacks]);

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
        <p style={styles.text}><strong>{displayContent.pluralDisplay}</strong></p>
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
