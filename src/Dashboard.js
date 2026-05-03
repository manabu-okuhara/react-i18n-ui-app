import React, { useEffect, useMemo, useState } from 'react';
import customerLocaleConfig from './customerLocaleConfig.json';
import {
  AVAILABLE_LOCALES,
  BASE_MESSAGES,
  formatMessage,
} from './translateLocaleBundle';
import { requestLocaleBundle } from './localeBundleClient';

function getInitialLocale() {
  const params = new URLSearchParams(window.location.search);
  return params.get('hl') || (navigator.languages ? navigator.languages[0] : navigator.language);
}

function getLanguageName(locale) {
  try {
    const language = locale.split('-')[0];
    return new Intl.DisplayNames(['en-US'], { type: 'language' }).of(language) || language;
  } catch {
    return locale;
  }
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

function Dashboard() {
  const initialLocale = useMemo(() => getInitialLocale(), []);
  const [locale, setLocale] = useState(initialLocale);
  const [searchTerm, setSearchTerm] = useState(initialLocale);
  const [showDropdown, setShowDropdown] = useState(false);
  const [preparedBundle, setPreparedBundle] = useState(null);
  const [isPreparing, setIsPreparing] = useState(false);

  const customerFallbacks = useMemo(
    () => customerLocaleConfig.localeFallbacks || {},
    []
  );
  const activeMessages = preparedBundle?.messages || BASE_MESSAGES;
  const isRTL = preparedBundle?.isRTL || false;

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('hl', locale);
    window.history.replaceState({}, '', url);
  }, [locale]);

  const suggestions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return AVAILABLE_LOCALES;
    }

    return AVAILABLE_LOCALES.filter((code) =>
      code.toLowerCase().startsWith(normalizedSearch)
    ).slice(0, 12);
  }, [searchTerm]);

  const submitLocale = async (nextLocale) => {
    const trimmedLocale = nextLocale.trim();

    if (!trimmedLocale) {
      return;
    }

    setLocale(trimmedLocale);
    setSearchTerm(trimmedLocale);
    setShowDropdown(false);
    setIsPreparing(true);

    try {
      const bundle = await requestLocaleBundle(trimmedLocale, customerFallbacks);
      setPreparedBundle(bundle);
    } finally {
      setIsPreparing(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      window.alert(activeMessages.copyConfirmation);
    } catch {
      window.alert(activeMessages.copyError);
    }
  };

  const displayContent = preparedBundle
    ? {
        inputLocaleDisplay: renderFormattedMessage(preparedBundle.messages.inputLocaleSentence, preparedBundle.formattingLocale, {
          inputLocale: preparedBundle.inputLocale
        }),
        languageDisplay: renderFormattedMessage(preparedBundle.messages.languageSentence, preparedBundle.formattingLocale, {
          languageName: preparedBundle.values.languageName
        }),
        regionDisplay: renderFormattedMessage(preparedBundle.messages.regionSentence, preparedBundle.formattingLocale, {
          regionName: preparedBundle.values.regionName
        }),
        dateDisplay: renderFormattedMessage(preparedBundle.messages.dateSentence, preparedBundle.formattingLocale, {
          currentDate: preparedBundle.values.currentDate
        }),
        numberDisplay: renderValueSentence(
          preparedBundle.messages.numberSentence,
          renderNumberWithSeparatorColors(preparedBundle.values.formattedNumber)
        ),
        percentDisplay: renderFormattedMessage(preparedBundle.messages.percentSentence, preparedBundle.formattingLocale, {
          percentValue: preparedBundle.values.percentValue
        }),
        firstDayOfWeekDisplay: renderFormattedMessage(
          preparedBundle.messages.firstDayOfWeekSentence,
          preparedBundle.formattingLocale,
          { firstDayOfWeek: preparedBundle.values.firstDayOfWeek }
        ),
        pluralDisplay: preparedBundle.values.pluralMessage
      }
    : null;

  return (
    <div
      style={{
        ...styles.container,
        textAlign: isRTL ? 'right' : 'left'
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div style={styles.topBar}>
        <h1 style={styles.header}>{activeMessages.title}</h1>
        <button onClick={copyLink} style={styles.shareBtn} type="button">
          {activeMessages.share}
        </button>
      </div>

      <div style={styles.searchContainer}>
        <label htmlFor="locale-input" style={styles.label}>{activeMessages.chooseLocale}</label>
        <input
          id="locale-input"
          type="text"
          placeholder={activeMessages.searchPlaceholder}
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
                  setSearchTerm(code);
                  setShowDropdown(false);
                }}
              >
                <strong style={styles.optionCode}>{code}</strong>
                <span style={styles.optionLabel}>{getLanguageName(code)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {isPreparing && (
        <p style={styles.text}>Preparing locale bundle...</p>
      )}

      {displayContent && (
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
      )}
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
