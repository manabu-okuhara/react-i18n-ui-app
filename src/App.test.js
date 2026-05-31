import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { BASE_MESSAGES, buildPreparedLocaleBundle } from './translateLocaleBundle';

beforeEach(() => {
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    value: ['en-US']
  });
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: 'en-US'
  });
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: jest.fn().mockResolvedValue(undefined)
    }
  });
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  jest.resetAllMocks();
});

test('renders the prompt before locale preparation', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /Internationalization Demo App using React JavaScript \/ TypeScript on Node\.js tooling/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/Enter Locale to display locale based values:/)).toBeInTheDocument();
  expect(screen.queryByText(/Locale Used:/)).not.toBeInTheDocument();
});

test('prepares Japanese content after Enter is pressed', async () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'ja-JP' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByRole('heading', { name: /Node\.js ツール上の React JavaScript \/ TypeScript による国際化デモアプリ/ })).toBeInTheDocument();
  expect(screen.getByText(/使用ロケール:/)).toBeInTheDocument();
  expect(screen.getByText(/言語:/)).toBeInTheDocument();
  expect(screen.getByText(/地域:/)).toBeInTheDocument();
  expect(screen.getByText(/ICU ライブラリに基づく値/)).toBeInTheDocument();
  expect(screen.getByText(/日付 \/ 時刻:/)).toBeInTheDocument();
  expect(screen.getByText(/パーセント値:/)).toBeInTheDocument();
  expect(screen.getByText(/週の最初の曜日:/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'リンクをコピー' })).toBeInTheDocument();
});

test('uses backend-translated bundle for arbitrary locales after Enter', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      locale: 'ko-KR',
      messages: {
        title: 'Node.js 도구에서 React JavaScript / TypeScript를 사용하는 국제화 데모 앱',
        chooseLocale: '로캘 기반 값을 표시할 로캘을 입력하세요:',
        searchPlaceholder: '예: ko, ko-KR, en, en-US',
        inputLocaleSentence: '사용된 로캘: {inputLocale}',
        languageSentence: '언어: {languageName}',
        regionSentence: '지역: {regionName}',
        icuSectionTitle: 'ICU 라이브러리 기반 값',
        dateSentence: '날짜 / 시간: {currentDate}',
        numberSentence: '숫자(오늘 날짜 {todayDate}): {value}',
        percentSentence: '백분율 값: {percentValue}',
        firstDayOfWeekSentence: '주의 첫째 요일: {firstDayOfWeek}',
        share: '링크 복사',
        copyConfirmation: '링크가 복사되었습니다.',
        copyError: '링크를 복사할 수 없습니다.',
        pluralSentence: '복수형(ICU 메시지 형식):\n{exampleOne, plural, other {사과 #<accent>개</accent>가 있습니다.}}\n{exampleThree, plural, other {사과 #<accent>개</accent>가 있습니다.}}\n{exampleFive, plural, other {사과 #<accent>개</accent>가 있습니다.}}\n{count, plural, other {사과 #<accent>개</accent>가 있습니다.}}'
      }
    })
  });

  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'ko-KR' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByRole('heading', { name: /Node\.js 도구에서 React JavaScript \/ TypeScript를 사용하는 국제화 데모 앱/ })).toBeInTheDocument();
  expect(screen.getByText(/사용된 로캘:/)).toBeInTheDocument();
  expect(screen.getByText(/언어:/)).toBeInTheDocument();
  expect(screen.getByText(/지역:/)).toBeInTheDocument();
  expect(screen.getByText(/ICU 라이브러리 기반 값/)).toBeInTheDocument();
  expect(screen.getByText(/날짜 \/ 시간:/)).toBeInTheDocument();
  expect(screen.getByText(/백분율 값:/)).toBeInTheDocument();
  expect(screen.getByText(/주의 첫째 요일:/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '링크 복사' })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/translate-locale-bundle',
    expect.objectContaining({
      method: 'POST'
    })
  );
});

test('uses client-side automated translation when backend is unavailable', async () => {
  global.fetch.mockImplementation((url) => {
    if (url === '/api/translate-locale-bundle') {
      return Promise.reject(new Error('offline'));
    }

    const requestUrl = new URL(url);
    const sourceText = requestUrl.searchParams.get('q');
    const translations = {
      'Internationalization Demo App using React JavaScript / TypeScript on Node.js tooling': '국제화 데모 앱',
      'Enter Locale to display locale based values:': '로캘 기반 값을 표시할 로캘을 입력하세요:',
      'e.g. en, en-US, ja, ja-JP, tr, tr-TR': '예: ko, ko-KR, en, en-US',
      'Locale Used: {inputLocale}': '사용된 로캘: {inputLocale}',
      'Language: {languageName}': '언어: {languageName}',
      'Region: {regionName}': '지역: {regionName}',
      'ICU Library based values': 'ICU 라이브러리 기반 값',
      'Date / Time: {currentDate}': '날짜 / 시간: {currentDate}',
      'Number (Today\'s date of {todayDate}): {value}': '숫자(오늘 날짜 {todayDate}): {value}',
      'Percent Value: {percentValue}': '백분율 값: {percentValue}',
      'First Day of Week: {firstDayOfWeek}': '주의 첫째 요일: {firstDayOfWeek}',
      'The locale "{inputLocale}" is not a valid locale tag. Showing fallback values for {fallbackLocale}.': '"{inputLocale}" 로캘 태그가 올바르지 않아 {fallbackLocale} 기준의 대체 값을 표시합니다.',
      'Copy Link': '링크 복사',
      'Link copied!': '링크가 복사되었습니다.',
      'Unable to copy the link.': '링크를 복사할 수 없습니다.',
      'Plurals (ICU Message Format):': '복수형(ICU 메시지 형식):',
      'There is 1 apple.': '사과 1개가 있습니다.',
      'There are 3 apples.': '사과 3개가 있습니다.',
      'There are 5 apples.': '사과 5개가 있습니다.'
    };

    const translatedText = translations[sourceText] || '사과 7개가 있습니다.';

    return Promise.resolve({
      ok: true,
      json: async () => ({
        responseData: { translatedText }
      })
    });
  });

  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'ko-KR' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByText(/사용된 로캘:/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '국제화 데모 앱' })).toBeInTheDocument();
  expect(screen.getByText(/언어:/)).toBeInTheDocument();
  expect(screen.getByText(/지역:/)).toBeInTheDocument();
  expect(screen.getByText(/ICU 라이브러리 기반 값/)).toBeInTheDocument();
  expect(screen.getByText(/백분율 값:/)).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getAllByText(/Korean|한국어/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/South Korea|대한민국|한국/).length).toBeGreaterThan(0);
  });
});

test('uses client-side automated translation when backend returns english fallback labels', async () => {
  global.fetch.mockImplementation((url, options) => {
    if (url === '/api/translate-locale-bundle') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          locale: 'de-DE',
          messages: BASE_MESSAGES
        })
      });
    }

    const requestUrl = new URL(url);
    const sourceText = requestUrl.searchParams.get('q');
    const translations = {
      'Internationalization Demo App using React JavaScript / TypeScript on Node.js tooling': 'Internationalisierungs-Demo-App',
      'Enter Locale to display locale based values:': 'Geben Sie Gebietsschema ein, um gebietsschemabasierte Werte anzuzeigen:',
      'e.g. en, en-US, ja, ja-JP, tr, tr-TR': 'z. B. de, de-DE, en, en-US',
      'Locale Used: {inputLocale}': 'Verwendetes Gebietsschema: {inputLocale}',
      'Language: {languageName}': 'Sprache: {languageName}',
      'Region: {regionName}': 'Region: {regionName}',
      'ICU Library based values': 'ICU-Bibliothek basierte Werte',
      'Date / Time: {currentDate}': 'Datum / Uhrzeit: {currentDate}',
      'Number (Today\'s date of {todayDate}): {value}': 'Nummer (heutiges Datum {todayDate}): {value}',
      'Percent Value: {percentValue}': 'Prozentwert: {percentValue}',
      'First Day of Week: {firstDayOfWeek}': 'Erster Tag der Woche: {firstDayOfWeek}',
      'The locale "{inputLocale}" is not a valid locale tag. Showing fallback values for {fallbackLocale}.': 'Das Gebietsschema "{inputLocale}" ist nicht gueltig. Fallback-Werte fuer {fallbackLocale} werden angezeigt.',
      'Copy Link': 'Link kopieren',
      'Link copied!': 'Link kopiert!',
      'Unable to copy the link.': 'Der Link konnte nicht kopiert werden.',
      'Plurals (ICU Message Format):': 'Plural mit ICU-Nachrichtenformat:',
      'There is 1 apple.': 'Es gibt 1 Apfel.',
      'There are 3 apples.': 'Es gibt 3 Aepfel.',
      'There are 5 apples.': 'Es gibt 5 Aepfel.'
    };

    return Promise.resolve({
      ok: true,
      json: async () => ({
        responseData: { translatedText: translations[sourceText] || 'Es gibt 7 Aepfel.' }
      })
    });
  });

  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'de-DE' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByText(/Verwendetes Gebietsschema:/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Internationalisierungs-Demo-App' })).toBeInTheDocument();
  expect(screen.getByText(/Sprache:/)).toBeInTheDocument();
  expect(screen.getByText(/Region:/)).toBeInTheDocument();
});

test('falls back to english copy while keeping requested locale formatting when automated translation is unavailable', async () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'ko-KR' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByText(/Locale Used:/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Internationalization Demo App using React JavaScript \/ TypeScript on Node\.js tooling/i })).toBeInTheDocument();
  expect(screen.getByText(/Language:/)).toBeInTheDocument();
  expect(screen.getByText(/Region:/)).toBeInTheDocument();
  expect(screen.getByText(/ICU Library based values/)).toBeInTheDocument();
  expect(screen.getByText(/Percent Value:/)).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getAllByText(/Korean|한국어/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/South Korea|대한민국|한국/).length).toBeGreaterThan(0);
  });
});

test('falls back to ja-JP for a language-only Japanese locale', async () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'ja' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByRole('heading', { name: /Node\.js ツール上の React JavaScript \/ TypeScript による国際化デモアプリ/ })).toBeInTheDocument();
});

test('falls back to fr-CA for a language-only French locale', async () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'fr' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByRole('heading', { name: /Application de demonstration de l'internationalisation avec React JavaScript \/ TypeScript sur l'outillage Node\.js/ })).toBeInTheDocument();
});

test('falls back to tr-TR for a language-only Turkish locale', async () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'tr' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByRole('heading', { name: /Node\.js araclari uzerinde React JavaScript \/ TypeScript kullanan Uluslararasilastirma Demo Uygulamasi/ })).toBeInTheDocument();
});

test('accepts underscore locale input and normalizes it for display', async () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'en_US' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByText(/Locale Used:/)).toBeInTheDocument();
  expect(
    screen.getAllByText((_, element) =>
      element?.textContent?.includes('Locale Used: en-US') ?? false
    ).length
  ).toBeGreaterThan(0);
  expect(screen.getAllByText(/en-US/).length).toBeGreaterThan(0);
});

test('reuses the ru-RU bundle for a language-only Russian locale without calling the backend', async () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'ru' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByRole('heading', { name: /Демонстрационное приложение интернационализации на React JavaScript \/ TypeScript с инструментарием Node\.js/ })).toBeInTheDocument();
  expect(screen.getByText(/Первый день недели:/)).toBeInTheDocument();
  expect(screen.getAllByText(/яблоко|яблока|яблок/).length).toBeGreaterThan(0);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('reuses English labels for English mixed locales without calling the translator', async () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'en-JP' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByText(/Locale Used:/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Internationalization Demo App using React JavaScript \/ TypeScript on Node\.js tooling/i })).toBeInTheDocument();
  expect(screen.getAllByText(/English|英語/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Japan|日本/).length).toBeGreaterThan(0);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('uses region-based formatting values for mixed locales like tr-JP', () => {
  const now = new Date(Date.UTC(2026, 4, 14, 16, 36));
  const bundle = buildPreparedLocaleBundle({
    inputLocale: 'tr-JP',
    messages: BASE_MESSAGES,
    now
  });

  expect(bundle.inputLocale).toBe('tr-JP');
  expect(bundle.formattingLocale).toBe('ja-JP');
  expect(bundle.values.languageName.toLowerCase()).toMatch(/türkçe|turkish/);
  expect(bundle.values.regionName.toLowerCase()).toMatch(/japonya|japan/);
  expect(bundle.values.firstDayOfWeek.toLowerCase()).toMatch(/日|sunday/);
  expect(bundle.values.percentValue).toBe(
    new Intl.NumberFormat('ja-JP', {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(0.8)
  );
  expect(bundle.values.currentDate).toBe(
    now.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  );
});

test('uses Turkish regional ordering for ja-TR while keeping Japanese language display', () => {
  const now = new Date(Date.UTC(2026, 4, 14, 16, 36));
  const bundle = buildPreparedLocaleBundle({
    inputLocale: 'ja-TR',
    messages: BASE_MESSAGES,
    now
  });

  expect(bundle.inputLocale).toBe('ja-TR');
  expect(bundle.formattingLocale).toBe('tr-TR');
  expect(bundle.values.languageName).toMatch(/日本語|Japanese/);
  expect(bundle.values.regionName).toMatch(/トルコ|Turkey/);
  expect(bundle.values.currentDate).toBe(
    now.toLocaleString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  );
});

test('keeps likely locale combinations short in the locale used display', () => {
  const bundle = buildPreparedLocaleBundle({
    inputLocale: 'en-US',
    messages: BASE_MESSAGES
  });

  expect(bundle.inputLocaleDisplay).toBe('en-US');
});

test('shows a graceful fallback message for invalid locale tags', async () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'ukr_UKR' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByText(/not a valid locale tag/i)).toBeInTheDocument();
  expect(screen.getAllByText(/en-US/).length).toBeGreaterThan(0);
});

test('uses a likely region locale for unsupported language-only locales', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      locale: 'pl-PL',
      messages: {
        title: 'Aplikacja demonstracyjna internacjonalizacji z React JavaScript / TypeScript na narzedziach Node.js',
        chooseLocale: 'Wpisz ustawienia regionalne, aby wyswietlic wartosci zalezne od lokalizacji:',
        searchPlaceholder: 'np. pl, pl-PL, en, en-US',
        inputLocaleSentence: 'Uzyta lokalizacja: {inputLocale}',
        languageSentence: 'Jezyk: {languageName}',
        regionSentence: 'Region: {regionName}',
        icuSectionTitle: 'Wartosci oparte na bibliotece ICU',
        dateSentence: 'Data / godzina: {currentDate}',
        numberSentence: 'Liczba (dzisiejsza data: {todayDate}): {value}',
        percentSentence: 'Wartosc procentowa: {percentValue}',
        firstDayOfWeekSentence: 'Pierwszy dzien tygodnia: {firstDayOfWeek}',
        share: 'Kopiuj link',
        copyConfirmation: 'Skopiowano link.',
        copyError: 'Nie udalo sie skopiowac linku.',
        pluralSentence: 'Liczby mnogie (format komunikatow ICU):\nJest 1 <accent>jablko</accent>.\nSa 3 <accent>jablka</accent>.\nJest 5 <accent>jabłek</accent>.\nJest 6 <accent>jabłek</accent>.'
      }
    })
  });

  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'pl' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByRole('heading', { name: /Aplikacja demonstracyjna internacjonalizacji z React JavaScript \/ TypeScript na narzedziach Node\.js/ })).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getAllByText(/polski/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Polska/i).length).toBeGreaterThan(0);
  });
});

test('applies rtl direction for Arabic after Enter using ICU direction info', async () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'ar-EG' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  await screen.findByRole('heading', { name: /تطبيق عرض توضيحي للتدويل باستخدام React JavaScript \/ TypeScript على أدوات Node\.js/ });
  const dashboard = document.querySelector('[dir="rtl"]');
  expect(dashboard).not.toBeNull();
  expect(screen.getByRole('button', { name: 'نسخ الرابط' })).toBeInTheDocument();
});

test('clicking a suggested locale fills the input without preparing the content', () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'fr' } });

  const suggestion = screen.getByText('fr').closest('button');
  expect(suggestion).not.toBeNull();

  fireEvent.click(suggestion);

  expect(input).toHaveValue('fr');
  expect(screen.queryByRole('heading', { name: /Application de demonstration de l'internationalisation avec React JavaScript \/ TypeScript sur l'outillage Node\.js/ })).not.toBeInTheDocument();
});

test('blurring the locale input prepares the locale content', async () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'ja-JP' } });
  fireEvent.blur(input);

  expect(await screen.findByRole('heading', { name: /Node\.js ツール上の React JavaScript \/ TypeScript による国際化デモアプリ/ })).toBeInTheDocument();
});
