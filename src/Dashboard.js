import React, { useEffect, useMemo, useRef, useState } from 'react';
import customerLocaleConfig from './customerLocaleConfig.json';
import {
  AVAILABLE_LOCALES,
  BASE_MESSAGES,
  buildPreparedLocaleBundle,
  getPluralRuleSignature,
  getFirstDayOfWeekIndex,
} from './translateLocaleBundle';
import { requestLocaleBundle } from './localeBundleClient';
import { evaluateLocaleBundle } from './localeQaClient';
import LocaleQaPanel from './components/LocaleQaPanel';

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



const VOICE_REGION_ALIASES = {
  'united states': 'US',
  'us': 'US',
  'usa': 'US',
  'japan': 'JP',
  'turkey': 'TR',
  'turkiye': 'TR',
  'canada': 'CA',
  'egypt': 'EG',
  'russia': 'RU',
  'south korea': 'KR',
  'korea': 'KR',
  'china': 'CN',
  'taiwan': 'TW',
  'hong kong': 'HK',
  'spain': 'ES',
  'poland': 'PL',
  'thailand': 'TH',
  'france': 'FR'
};

function normalizeVoiceLookup(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildVoiceLocaleMaps() {
  const aliases = new Map();
  const languageAliases = new Map();
  const regionAliases = new Map();
  const languageNames = new Intl.DisplayNames(['en-US'], { type: 'language' });
  const regionNames = new Intl.DisplayNames(['en-US'], { type: 'region' });

  AVAILABLE_LOCALES.forEach((localeCode) => {
    const [language, region] = localeCode.split('-');
    aliases.set(normalizeVoiceLookup(localeCode), localeCode);

    const languageName = languageNames.of(language);
    if (languageName) {
      languageAliases.set(normalizeVoiceLookup(languageName), language);
      aliases.set(normalizeVoiceLookup(languageName), region ? `${language}-${region}` : language);
    }

    if (region) {
      const regionName = regionNames.of(region);
      if (regionName) {
        regionAliases.set(normalizeVoiceLookup(regionName), region);

        if (languageName) {
          aliases.set(normalizeVoiceLookup(`${languageName} ${regionName}`), `${language}-${region}`);
          aliases.set(normalizeVoiceLookup(`${regionName} ${languageName}`), `${language}-${region}`);
        }
      }
    }
  });

  Object.entries(VOICE_REGION_ALIASES).forEach(([label, regionCode]) => {
    regionAliases.set(normalizeVoiceLookup(label), regionCode);
  });

  return {
    aliases,
    languageAliases,
    regionAliases
  };
}


const VOICE_UI_MESSAGES = {
  unsupported: 'Voice input is not available in this browser.',
  listening: 'Listening for a locale...',
  unavailable: 'Voice input was unavailable. Please try again or type the locale.',
  recognized: (locale) => `Voice locale recognized: ${locale}`
};


const ENGLISH_APP_SHELL_MESSAGES = {
  title: BASE_MESSAGES.title,
  share: BASE_MESSAGES.share,
  chooseLocale: BASE_MESSAGES.chooseLocale
};

const COMPARISON_UI_MESSAGES = {
  title: 'Locale Comparison',
  note: 'Highlighted values differ from the en-US baseline.',
  selectedLabel: 'Selected Locale',
  baselineLabel: 'en-US Baseline',
  submitLabel: 'Apply Locale'
};

function appendParenthetical(value, detail) {
  return detail ? `${value} (${detail})` : value;
}

function appendEnglishWeekday(value, englishValue) {
  return value && englishValue && value !== englishValue
    ? appendParenthetical(value, englishValue)
    : value;
}

function getComparisonRows(preparedBundle, comparisonBundle) {
  if (!preparedBundle || !comparisonBundle) {
    return [];
  }

  const selectedPluralSignature = preparedBundle.values?.pluralRuleSignature || getPluralRuleSignature(preparedBundle.localeUsed);
  const baselinePluralSignature = comparisonBundle.values?.pluralRuleSignature || getPluralRuleSignature(comparisonBundle.localeUsed);
  const selectedFirstDayIndex = preparedBundle.values?.firstDayOfWeekIndex ?? getFirstDayOfWeekIndex(preparedBundle.formattingLocale);
  const baselineFirstDayIndex = comparisonBundle.values?.firstDayOfWeekIndex ?? getFirstDayOfWeekIndex(comparisonBundle.formattingLocale);

  return [
    {
      id: 'language',
      label: 'Language',
      selectedValue: preparedBundle.values.languageName,
      baselineValue: comparisonBundle.values.languageName,
      compareMode: 'informational'
    },
    {
      id: 'region',
      label: 'Region',
      selectedValue: preparedBundle.values.regionName,
      baselineValue: comparisonBundle.values.regionName,
      compareMode: 'informational'
    },
    {
      id: 'date-time',
      label: 'Date / Time',
      selectedValue: appendParenthetical(
        preparedBundle.values.currentDate,
        preparedBundle.values.dateTimePattern || preparedBundle.values.datePattern
      ),
      baselineValue: appendParenthetical(
        comparisonBundle.values.currentDate,
        comparisonBundle.values.dateTimePattern || comparisonBundle.values.datePattern
      ),
      compareMode: 'display'
    },
    {
      id: 'number',
      label: 'Number',
      selectedValue: preparedBundle.values.formattedNumber,
      baselineValue: comparisonBundle.values.formattedNumber,
      compareMode: 'display'
    },
    {
      id: 'percent',
      label: 'Percent',
      selectedValue: preparedBundle.values.percentValue,
      baselineValue: comparisonBundle.values.percentValue,
      compareMode: 'display'
    },
    {
      id: 'first-day',
      label: 'First Day of Week',
      selectedValue: appendEnglishWeekday(
        preparedBundle.values.firstDayOfWeek,
        preparedBundle.values.firstDayOfWeekEnglish
      ),
      baselineValue: comparisonBundle.values.firstDayOfWeek,
      compareMode: 'semantic',
      semanticDiffers: selectedFirstDayIndex !== baselineFirstDayIndex
    },
    {
      id: 'plurals',
      label: 'Plural Examples',
      selectedValue: preparedBundle.values.pluralMessage,
      baselineValue: comparisonBundle.values.pluralMessage,
      multiline: true,
      compareMode: 'semantic',
      semanticDiffers: selectedPluralSignature !== baselinePluralSignature
    }
  ].map((row) => ({
    ...row,
    differs: row.compareMode === 'informational'
      ? false
      : row.compareMode === 'semantic'
        ? Boolean(row.semanticDiffers)
        : row.selectedValue !== row.baselineValue
  }));
}

function resolveSpokenLocale(transcript, voiceLocaleMaps) {
  const normalizedTranscript = normalizeVoiceLookup(transcript);
  const { aliases, languageAliases, regionAliases } = voiceLocaleMaps;

  if (aliases.has(normalizedTranscript)) {
    return aliases.get(normalizedTranscript);
  }

  const regionEntries = Array.from(regionAliases.entries()).sort((a, b) => b[0].length - a[0].length);

  for (const [regionLabel, regionCode] of regionEntries) {
    if (normalizedTranscript.startsWith(`${regionLabel} `)) {
      const languageLabel = normalizedTranscript.slice(regionLabel.length + 1).trim();
      if (languageAliases.has(languageLabel)) {
        return `${languageAliases.get(languageLabel)}-${regionCode}`;
      }
    }

    if (normalizedTranscript.endsWith(` ${regionLabel}`)) {
      const languageLabel = normalizedTranscript.slice(0, -regionLabel.length - 1).trim();
      if (languageAliases.has(languageLabel)) {
        return `${languageAliases.get(languageLabel)}-${regionCode}`;
      }
    }
  }

  if (languageAliases.has(normalizedTranscript)) {
    return languageAliases.get(normalizedTranscript);
  }

  if (/^[a-z]{2,3}(?:\s+[a-z0-9]{2,4})?$/i.test(normalizedTranscript)) {
    return normalizedTranscript.replace(/\s+/g, '-');
  }

  return transcript.trim().replace(/\s+/g, '-');
}

function Dashboard() {
  const initialLocale = useMemo(() => getInitialLocale(), []);
  const [locale, setLocale] = useState(initialLocale);
  const [searchTerm, setSearchTerm] = useState(initialLocale);
  const [showDropdown, setShowDropdown] = useState(false);
  const [preparedBundle, setPreparedBundle] = useState(null);
  const [qaResult, setQaResult] = useState(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [lastSubmittedLocale, setLastSubmittedLocale] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');
  const recognitionRef = useRef(null);

  const customerFallbacks = useMemo(
    () => customerLocaleConfig.localeFallbacks || {},
    []
  );
  const activeMessages = preparedBundle?.messages || BASE_MESSAGES;
  const isRTL = preparedBundle?.isRTL || false;
  const preparedLocale = preparedBundle?.inputLocale || '';

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('hl', locale);
    window.history.replaceState({}, '', url);
  }, [locale]);

  const voiceLocaleMaps = useMemo(() => buildVoiceLocaleMaps(), []);
  const speechRecognitionCtor = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
    : null;
  const isVoiceSupported = Boolean(speechRecognitionCtor);

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

    if (!trimmedLocale || (isPreparing && trimmedLocale === lastSubmittedLocale) || trimmedLocale === preparedLocale) {
      return;
    }

    setLocale(trimmedLocale);
    setSearchTerm(trimmedLocale);
    setShowDropdown(false);
    setIsPreparing(true);
    setLastSubmittedLocale(trimmedLocale);
    setQaResult(null);

    try {
      const bundle = await requestLocaleBundle(trimmedLocale, customerFallbacks);
      setPreparedBundle(bundle);
    } finally {
      setIsPreparing(false);
    }
  };


  useEffect(() => () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop?.();
      recognitionRef.current = null;
    }
  }, []);

  const startVoiceInput = () => {
    if (!speechRecognitionCtor) {
      setVoiceMessage(VOICE_UI_MESSAGES.unsupported);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop?.();
      return;
    }

    const recognition = new speechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceMessage(VOICE_UI_MESSAGES.listening);
    };

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      const resolvedLocale = resolveSpokenLocale(transcript, voiceLocaleMaps);
      setSearchTerm(resolvedLocale);
      setVoiceMessage(VOICE_UI_MESSAGES.recognized(resolvedLocale));
      submitLocale(resolvedLocale);
    };

    recognition.onerror = () => {
      setVoiceMessage(VOICE_UI_MESSAGES.unavailable);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      window.alert(activeMessages.copyConfirmation);
    } catch {
      window.alert(activeMessages.copyError);
    }
  };

  useEffect(() => {
    let isActive = true;

    if (!preparedBundle) {
      setQaResult(null);
      return undefined;
    }

    evaluateLocaleBundle(preparedBundle).then((result) => {
      if (isActive) {
        setQaResult(result);
      }
    });

    return () => {
      isActive = false;
    };
  }, [preparedBundle]);

  const comparisonBundle = useMemo(() => {
    if (!preparedBundle) {
      return null;
    }

    return buildPreparedLocaleBundle({
      inputLocale: 'en-US',
      messages: BASE_MESSAGES,
      bundleLocale: 'en-US',
      bundleSource: 'built_in',
      now: new Date(preparedBundle.generatedAt)
    });
  }, [preparedBundle]);

  const comparisonRows = useMemo(
    () => getComparisonRows(preparedBundle, comparisonBundle),
    [preparedBundle, comparisonBundle]
  );

  const warningMessage = preparedBundle?.warningMessage || '';

  return (
    <div
      style={{
        ...styles.container,
        textAlign: isRTL ? 'right' : 'left'
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div style={styles.topBar} dir="ltr">
        <h1 style={styles.header}>{ENGLISH_APP_SHELL_MESSAGES.title}</h1>
        <button onClick={copyLink} style={styles.shareBtn} type="button">
          {ENGLISH_APP_SHELL_MESSAGES.share}
        </button>
      </div>

      <div style={styles.searchContainer} dir="ltr">
        <label htmlFor="locale-input" style={styles.label}>{ENGLISH_APP_SHELL_MESSAGES.chooseLocale}</label>
        <div style={styles.inputRow}>
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
            onBlur={() => {
              submitLocale(searchTerm);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitLocale(searchTerm);
              }
            }}
            style={styles.input}
          />
          <button
            type="button"
            onClick={() => submitLocale(searchTerm)}
            style={styles.submitButton}
          >
            {COMPARISON_UI_MESSAGES.submitLabel}
          </button>
          {isVoiceSupported ? (
            <button
              type="button"
              onClick={startVoiceInput}
              style={styles.voiceButton}
              aria-label="Use voice locale input"
              title="Use voice locale input"
            >
              {isListening ? 'Listening...' : 'Voice'}
            </button>
          ) : null}
        </div>
        {voiceMessage ? (
          <p style={styles.voiceMessage}>{voiceMessage}</p>
        ) : null}

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

      {preparedBundle ? (
        <>
          {warningMessage ? (
            <p style={styles.warningText}>{warningMessage}</p>
          ) : null}

          {comparisonBundle ? (
            <section style={styles.comparisonCard} aria-label="Locale Comparison" dir="ltr">
              <h2 style={styles.comparisonHeading}>{COMPARISON_UI_MESSAGES.title}</h2>
              <p style={styles.comparisonNote}>{COMPARISON_UI_MESSAGES.note}</p>
              <div style={styles.comparisonHeaderRow}>
                <div />
                <div style={styles.comparisonColumnHeading}>
                  {COMPARISON_UI_MESSAGES.selectedLabel}: {preparedBundle.inputLocaleDisplay}
                </div>
                <div style={styles.comparisonColumnHeading}>
                  {COMPARISON_UI_MESSAGES.baselineLabel}
                </div>
              </div>
              <div style={styles.comparisonGrid}>
                {comparisonRows.map((row) => {
                  const cellStyle = row.differs ? styles.comparisonDiffCell : styles.comparisonSameCell;
                  return (
                    <React.Fragment key={row.id}>
                      <div style={styles.comparisonLabelCell}>{row.label}</div>
                      <div
                        data-testid={`comparison-cell-${row.id}-selected`}
                        dir="auto"
                        aria-label={`${row.label}, selected locale, ${row.differs ? 'different from' : 'equivalent to'} en-US baseline`}
                        style={{
                          ...styles.comparisonValueCell,
                          ...cellStyle,
                          ...(row.multiline ? styles.comparisonMultilineValue : null)
                        }}
                      >
                        {row.multiline ? renderPluralMessage(row.selectedValue) : row.selectedValue}
                      </div>
                      <div
                        data-testid={`comparison-cell-${row.id}-baseline`}
                        dir="auto"
                        aria-label={`${row.label}, en-US baseline`}
                        style={{
                          ...styles.comparisonValueCell,
                          ...cellStyle,
                          ...(row.multiline ? styles.comparisonMultilineValue : null)
                        }}
                      >
                        {row.multiline ? renderPluralMessage(row.baselineValue) : row.baselineValue}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      <LocaleQaPanel qaResult={qaResult} bundle={preparedBundle} />
    </div>
  );
}

const styles = {
  container: {
    padding: '25px',
    fontFamily: 'sans-serif',
    maxWidth: '960px',
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
    fontSize: '1.6rem',
    lineHeight: 1.2
  },
  shareBtn: {
    border: 'none',
    borderRadius: '8px',
    padding: '15px 18px',
    backgroundColor: '#282c34',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '21px'
  },
  searchContainer: {
    marginBottom: '20px'
  },
  inputRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'stretch'
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
    fontSize: '21px',
    flex: 1
  },
  voiceButton: {
    border: 'none',
    borderRadius: '8px',
    padding: '0 16px',
    backgroundColor: '#0f766e',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '18px',
    minWidth: '110px'
  },
  submitButton: {
    border: 'none',
    borderRadius: '8px',
    padding: '0 16px',
    backgroundColor: '#1f2937',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '18px',
    minWidth: '132px'
  },
  voiceMessage: {
    margin: '10px 0 0',
    fontSize: '16px',
    lineHeight: 1.4,
    color: '#444'
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
    fontSize: '21px'
  },
  optionLabel: {
    fontSize: '18px',
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
    gap: '12px'
  },
  comparisonCard: {
    marginTop: '24px',
    padding: '18px',
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)'
  },
  comparisonHeading: {
    margin: 0,
    fontSize: '1.2rem',
    lineHeight: 1.3
  },
  comparisonNote: {
    margin: '8px 0 16px',
    fontSize: '15px',
    lineHeight: 1.4,
    color: '#5b6470'
  },
  comparisonHeaderRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(150px, 0.9fr) minmax(0, 1.3fr) minmax(0, 1.3fr)',
    gap: '10px',
    alignItems: 'end',
    marginBottom: '10px'
  },
  comparisonColumnHeading: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#1f2937'
  },
  comparisonGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(150px, 0.9fr) minmax(0, 1.3fr) minmax(0, 1.3fr)',
    gap: '10px',
    alignItems: 'stretch'
  },
  comparisonLabelCell: {
    padding: '12px 10px',
    borderRadius: '10px',
    backgroundColor: '#f8f9fb',
    fontSize: '16px',
    fontWeight: 700,
    lineHeight: 1.4,
    color: '#111827'
  },
  comparisonValueCell: {
    padding: '12px 14px',
    borderRadius: '10px',
    fontSize: '16px',
    lineHeight: 1.5,
    color: '#111827',
    border: '1px solid transparent',
    wordBreak: 'break-word'
  },
  comparisonMultilineValue: {
    whiteSpace: 'pre-line'
  },
  comparisonSameCell: {
    backgroundColor: '#f8f9fb',
    borderColor: '#e5e7eb'
  },
  comparisonDiffCell: {
    backgroundColor: '#fff4d6',
    borderColor: '#f2cf74'
  },
  text: {
    color: 'black',
    margin: 0,
    lineHeight: 1.5,
    fontSize: '21px'
  },
  sectionHeading: {
    color: 'black',
    margin: 0,
    lineHeight: 1.5,
    fontSize: '21px',
    fontWeight: 700
  },
  warningText: {
    margin: 0,
    padding: '12px 14px',
    borderRadius: '8px',
    backgroundColor: '#fff3cd',
    color: '#7a4b00',
    fontSize: '21px',
    lineHeight: 1.5
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 'bold',
    textAlign: 'inherit',
    fontSize: '21px'
  }
};

export default Dashboard;
