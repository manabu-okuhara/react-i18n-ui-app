import React, { useState, useEffect, useMemo } from 'react';
import enUS from './locales/en-US.json';
import jaJP from './locales/ja-JP.json';
import frCA from './locales/fr-CA.json';
import arEG from './locales/ar-EG.json';
import ruRU from './locales/ru-RU.json';

const MESSAGES = {
  'en-US': enUS,
  'ja-JP': jaJP,
  'fr-CA': frCA,
  'ar-EG': arEG,
  'ru-RU': ruRU
};

function Dashboard() {
  const getInitialLocale = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('hl') || (navigator.languages ? navigator.languages[0] : navigator.language);
  };

  const [locale, setLocale] = useState(getInitialLocale());
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [labels, setLabels] = useState({
    title: 'Dashboard',
    chooseLocale: 'Search/Type Locale:',
    date: 'Date & Time:',
    country: 'Country/Region:',
    number: 'Date-based Number:',
    share: 'Copy Link'
  });

  const [currentDate, setCurrentDate] = useState('');
  const [formattedNumber, setFormattedNumber] = useState('');
  const [countryName, setCountryName] = useState('');

  useEffect(() => {
    const url = new URL(window.location);
    url.searchParams.set('hl', locale);
    window.history.pushState({}, '', url);
  }, [locale]);

  // Helper to handle ICU Plural logic
const formatMessage = (msg, values, locale) => {
  if (!msg) return '';
  
  // Handle Plural Logic: {count, plural, one{...} other{...}}
  const pluralMatch = msg.match(/{(\w+),\s*plural,\s*(.+)}/);
  if (pluralMatch) {
    const [fullMatch, varName, rulesStr] = pluralMatch;
    const count = values[varName];
    
    // Use the browser's built-in PluralRules engine
    const rule = new Intl.PluralRules(locale).select(count);
    
    // Extract the specific rule or fallback to 'other'
    const parts = rulesStr.match(/(\w+)\s*{(.+?)}/g);
    const ruleMap = {};
    parts.forEach(p => {
      const m = p.match(/(\w+)\s*{(.+?)}/);
      ruleMap[m[1]] = m[2];
    });
    
    const localizedPattern = ruleMap[rule] || ruleMap['other'];
    const result = localizedPattern.replace('#', new Intl.NumberFormat(locale).format(count));
    return msg.replace(fullMatch, result);
  }

  // Basic variable replacement
  return msg.replace(/{(\w+)}/g, (match, key) => values[key] !== undefined ? values[key] : match);
};

// Bulletproof RTL detection
  const isRTL = useMemo(() => {
    const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'ps', 'syr', 'dv'];
    const currentLang = locale.split('-')[0].toLowerCase();
    return rtlLanguages.includes(currentLang);
  }, [locale]);

useEffect(() => {
  const currentMessages = MESSAGES[locale] || MESSAGES['en-US'];
  const now = new Date();

  // 1. Core Data Calculations
  const dateStr = now.toLocaleString(locale, { 
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });

  const rawValue = (now.getMonth() + 1) * 10000 + now.getDate() * 100 + (now.getFullYear() % 100) + (now.getFullYear() % 100 / 100);
  const numStr = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rawValue);
  
  let regionName = 'N/A';
  try {
    const region = new Intl.Locale(locale).maximize().region;
    const displayNames = new Intl.DisplayNames([locale.split('-')[0]], { type: 'region' });
    regionName = displayNames.of(region) || region;
  } catch {}

  // Use the last digit of the current second (0-9)
  const theSecondDigit = now.getSeconds() % 10;

  // 2. Map Sentences to State
  setLabels({
    ...currentMessages,
    dateDisplay: formatMessage(currentMessages.dateSentence, { currentDate: dateStr }),
    countryDisplay: formatMessage(currentMessages.countrySentence, { countryName: regionName }),
    numberDisplay: formatMessage(currentMessages.numberSentence, { formattedNumber: numStr }),
    pluralDisplay: formatMessage(currentMessages.pluralSentence, { count: theSecondDigit }, locale)
  });

}, [locale]);

  const suggestions = useMemo(() => {
    if (!searchTerm) return [locale];
    const results = new Set();
    try {
      const validated = Intl.getCanonicalLocales(searchTerm)[0];
      results.add(validated);
      results.add(new Intl.Locale(searchTerm).maximize().toString());
    } catch (e) {}
    return Array.from(results).slice(0, 5);
  }, [searchTerm, locale]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied!');
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
      <h1 style={styles.header}>{isLoading ? '...' : labels.title}</h1>
      <button onClick={copyLink} style={styles.shareBtn}>{labels.share}</button>
    </div>

    <div style={styles.searchContainer}>
      <label style={styles.label}>{labels.chooseLocale}</label>
      <input
        type="text"
        placeholder="e.g. de-DE, ja-JP"
        value={searchTerm}
        onFocus={() => setShowDropdown(true)}
        onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); }}
        style={styles.input}
      />
      
      {showDropdown && (
        <div style={styles.dropdown}>
          {suggestions.map((code) => (
            <div 
              key={code} 
              style={styles.option} 
              onClick={() => { setLocale(code); setSearchTerm(code); setShowDropdown(false); }}
            >
              <strong style={{color: 'black'}}>{code}</strong>
              <div style={{fontSize: '14px', color: 'black', opacity: 0.7}}>
                {new Intl.DisplayNames(['en'], {type: 'language'}).of(code.split('-')[0])} 
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    <div style={styles.result}>
      <p style={styles.text}>{labels.dateDisplay}</p>
      <p style={styles.text}>{labels.countryDisplay}</p>
      <p style={styles.text}>{labels.numberDisplay}</p>
      <p style={styles.text}><strong>{labels.pluralDisplay}</strong></p>
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
    position: 'relative' // Needed for absolute dropdown positioning
  },
  topBar: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: '20px'
    // Flex-direction will automatically flip because of dir="rtl"
  },
  input: { 
    width: '100%', 
    padding: '12px', 
    boxSizing: 'border-box', 
    border: '2px solid #eee', 
    borderRadius: '8px', 
    outline: 'none', 
    color: 'black',
    // CRITICAL: Ensures the cursor and text start on the right for Arabic
    textAlign: 'inherit',
    direction: 'inherit'
  },
  text: { 
    color: 'black', 
    marginBlock: '8px',
    // Resetting horizontal margins to allow the dir attribute to control alignment
    marginInline: '0' 
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 'bold',
    textAlign: 'inherit'
  }
};

export default Dashboard;
