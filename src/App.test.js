import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { BASE_MESSAGES, buildPreparedLocaleBundle } from './translateLocaleBundle';

function submitLocale(value, trigger = 'enter') {
  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value } });

  if (trigger === 'blur') {
    fireEvent.blur(input);
  } else {
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });
  }

  return input;
}

function expectTextContentContains(value) {
  expect(document.body.textContent).toContain(value);
}

function expectNoTranslateRequest() {
  expect(
    global.fetch.mock.calls.some(([url]) => url === '/api/translate-locale-bundle')
  ).toBe(false);
}

function expectPreparedValuesFor(inputLocale) {
  const bundle = buildPreparedLocaleBundle({ inputLocale, messages: BASE_MESSAGES });
  expectTextContentContains(bundle.values.languageName);
  expectTextContentContains(bundle.values.regionName);
  expectTextContentContains(bundle.values.firstDayOfWeek);
  return bundle;
}

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
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
  jest.resetAllMocks();
});

test('renders the prompt before locale preparation', () => {
  render(<App />);

  expect(screen.getByRole('heading')).toBeInTheDocument();
  expect(screen.getByLabelText(/Enter Locale to display locale based values:/)).toBeInTheDocument();
  expect(screen.queryByText(/Locale Used:/)).not.toBeInTheDocument();
});

test('prepares Japanese content after Enter is pressed', async () => {
  render(<App />);

  submitLocale('ja-JP');

  expect(await screen.findByRole('heading')).toBeInTheDocument();
  expectPreparedValuesFor('ja-JP');
  expect(screen.getByRole('button')).toBeInTheDocument();
});

test('uses backend-translated bundle for arbitrary unsupported locales after Enter', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      locale: 'it-IT',
      messages: {
        ...BASE_MESSAGES,
        title: 'IT backend heading',
        chooseLocale: 'IT backend prompt',
        searchPlaceholder: 'it backend placeholder',
        inputLocaleSentence: 'IT locale used: {inputLocale}',
        languageSentence: 'IT language: {languageName}',
        regionSentence: 'IT region: {regionName}',
        icuSectionTitle: 'IT ICU section',
        dateSentence: 'IT date: {currentDate}',
        numberSentence: 'IT number {todayDate}: {value}',
        percentSentence: 'IT percent: {percentValue}',
        firstDayOfWeekSentence: 'IT first day: {firstDayOfWeek}',
        share: 'IT copy link',
        pluralSentence: 'IT plurals:\n{exampleOne, plural, one {uno} other {altri}}\n{exampleThree, plural, one {uno} other {altri}}\n{exampleFive, plural, one {uno} other {altri}}\n{count, plural, one {uno} other {altri}}'
      }
    })
  });

  render(<App />);
  submitLocale('it-IT');

  expect(await screen.findByRole('heading', { name: 'IT backend heading' })).toBeInTheDocument();
  expectTextContentContains('IT locale used: it-IT');
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/translate-locale-bundle',
    expect.objectContaining({ method: 'POST' })
  );
});

test('uses client-side automated translation when backend is unavailable for unsupported locales', async () => {
  global.fetch.mockImplementation((url) => {
    if (url === '/api/translate-locale-bundle') {
      return Promise.reject(new Error('offline'));
    }

    const requestUrl = new URL(url);
    const sourceText = requestUrl.searchParams.get('q') || '';

    let translatedText = 'IT client count';
    if (sourceText.includes('Internationalization Demo App')) translatedText = 'IT client heading';
    else if (sourceText.includes('Enter Locale')) translatedText = 'IT client prompt';
    else if (sourceText.includes('e.g.')) translatedText = 'IT client placeholder';
    else if (sourceText.includes('Locale Used')) translatedText = 'IT client locale: {inputLocale}';
    else if (sourceText.includes('Language:')) translatedText = 'IT client language: {languageName}';
    else if (sourceText.includes('Region:')) translatedText = 'IT client region: {regionName}';
    else if (sourceText.includes('ICU Library')) translatedText = 'IT client ICU section';
    else if (sourceText.includes('Date / Time')) translatedText = 'IT client date: {currentDate}';
    else if (sourceText.includes('Today') && sourceText.includes('{todayDate}')) translatedText = 'IT client number {todayDate}: {value}';
    else if (sourceText.includes('Percent Value')) translatedText = 'IT client percent: {percentValue}';
    else if (sourceText.includes('First Day of Week')) translatedText = 'IT client first day: {firstDayOfWeek}';
    else if (sourceText.includes('not a valid locale tag')) translatedText = 'IT client invalid locale';
    else if (sourceText.includes('Copy Link')) translatedText = 'IT client copy link';
    else if (sourceText.includes('Link copied')) translatedText = 'IT client copied';
    else if (sourceText.includes('Unable to copy')) translatedText = 'IT client copy error';
    else if (sourceText.includes('Plurals')) translatedText = 'IT client plurals';
    else if (sourceText.includes('There is 1 apple')) translatedText = 'IT client one';
    else if (sourceText.includes('There are 3 apples')) translatedText = 'IT client three';
    else if (sourceText.includes('There are 5 apples')) translatedText = 'IT client five';

    return Promise.resolve({
      ok: true,
      json: async () => ({
        responseData: { translatedText }
      })
    });
  });

  render(<App />);
  submitLocale('it-IT');

  expect(await screen.findByRole('heading', { name: 'IT client heading' })).toBeInTheDocument();
  expectTextContentContains('IT client locale: it-IT');
  expectPreparedValuesFor('it-IT');
});

test('uses client-side automated translation when backend returns english fallback labels for unsupported locales', async () => {
  global.fetch.mockImplementation((url) => {
    if (url === '/api/translate-locale-bundle') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          locale: 'nl-NL',
          messages: BASE_MESSAGES
        })
      });
    }

    const requestUrl = new URL(url);
    const sourceText = requestUrl.searchParams.get('q') || '';

    let translatedText = 'NL client count';
    if (sourceText.includes('Internationalization Demo App')) translatedText = 'NL client heading';
    else if (sourceText.includes('Enter Locale')) translatedText = 'NL client prompt';
    else if (sourceText.includes('e.g.')) translatedText = 'NL client placeholder';
    else if (sourceText.includes('Locale Used')) translatedText = 'NL client locale: {inputLocale}';
    else if (sourceText.includes('Language:')) translatedText = 'NL client language: {languageName}';
    else if (sourceText.includes('Region:')) translatedText = 'NL client region: {regionName}';
    else if (sourceText.includes('ICU Library')) translatedText = 'NL client ICU section';
    else if (sourceText.includes('Date / Time')) translatedText = 'NL client date: {currentDate}';
    else if (sourceText.includes('Today') && sourceText.includes('{todayDate}')) translatedText = 'NL client number {todayDate}: {value}';
    else if (sourceText.includes('Percent Value')) translatedText = 'NL client percent: {percentValue}';
    else if (sourceText.includes('First Day of Week')) translatedText = 'NL client first day: {firstDayOfWeek}';
    else if (sourceText.includes('not a valid locale tag')) translatedText = 'NL client invalid locale';
    else if (sourceText.includes('Copy Link')) translatedText = 'NL client copy link';
    else if (sourceText.includes('Link copied')) translatedText = 'NL client copied';
    else if (sourceText.includes('Unable to copy')) translatedText = 'NL client copy error';
    else if (sourceText.includes('Plurals')) translatedText = 'NL client plurals';
    else if (sourceText.includes('There is 1 apple')) translatedText = 'NL client one';
    else if (sourceText.includes('There are 3 apples')) translatedText = 'NL client three';
    else if (sourceText.includes('There are 5 apples')) translatedText = 'NL client five';

    return Promise.resolve({
      ok: true,
      json: async () => ({
        responseData: { translatedText }
      })
    });
  });

  render(<App />);
  submitLocale('nl-NL');

  expect(await screen.findByRole('heading', { name: 'NL client heading' })).toBeInTheDocument();
  expectTextContentContains('NL client locale: nl-NL');
});

test('falls back to english copy while keeping requested locale formatting when automated translation is unavailable', async () => {
  render(<App />);
  submitLocale('it-IT');

  expect(await screen.findByRole('heading')).toHaveTextContent(/Internationalization Demo App/);
  await waitFor(() => expect(document.body.textContent).toContain('it-IT'));
  expectPreparedValuesFor('it-IT');
});

test.each([
  'ja',
  'fr',
  'tr',
  'ko',
  'de',
  'zh',
  'pl',
  'th',
  'ru'
])('uses the built-in bundle for language-only locale %s', async (inputLocale) => {
  render(<App />);
  submitLocale(inputLocale);

  expect(await screen.findByRole('heading')).toBeInTheDocument();
  expectPreparedValuesFor(inputLocale);
  expectNoTranslateRequest();
});

test.each([
  'zh-TW',
  'es-ES',
  'es-419'
])('uses the built-in bundle for exact locale %s without calling the backend', async (inputLocale) => {
  render(<App />);
  submitLocale(inputLocale);

  expect(await screen.findByRole('heading')).toBeInTheDocument();
  expectPreparedValuesFor(inputLocale);
  expectTextContentContains(inputLocale);
  expectNoTranslateRequest();
});

test('accepts underscore locale input and normalizes it for display', async () => {
  render(<App />);
  submitLocale('en_US');

  await screen.findByRole('heading');
  expectTextContentContains('en-US');
});

test('reuses English labels for English mixed locales without calling the translator', async () => {
  render(<App />);
  submitLocale('en-JP');

  expect(await screen.findByRole('heading')).toHaveTextContent(/Internationalization Demo App/);
  expectPreparedValuesFor('en-JP');
  expectNoTranslateRequest();
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
  submitLocale('ukr_UKR');

  expect(await screen.findByText(/not a valid locale tag/i)).toBeInTheDocument();
  expectTextContentContains('en-US');
});

test('uses a likely region locale for unsupported language-only locales', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      locale: 'nl-NL',
      messages: {
        ...BASE_MESSAGES,
        title: 'NL likely heading',
        inputLocaleSentence: 'NL likely locale: {inputLocale}',
        languageSentence: 'NL likely language: {languageName}',
        regionSentence: 'NL likely region: {regionName}'
      }
    })
  });

  render(<App />);
  submitLocale('nl');

  await waitFor(() => expect(document.body.textContent).toContain('nl-NL'));
  expectPreparedValuesFor('nl');
  expect(global.fetch).toHaveBeenCalled();
});

test('applies rtl direction for Arabic after Enter using ICU direction info', async () => {
  render(<App />);
  submitLocale('ar-EG');

  await screen.findByRole('heading');
  const dashboard = document.querySelector('[dir="rtl"]');
  expect(dashboard).not.toBeNull();
  expect(screen.getByRole('button')).toBeInTheDocument();
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
  expect(screen.queryByText(/fr-CA/)).not.toBeInTheDocument();
});

test('blurring the locale input prepares the locale content', async () => {
  render(<App />);
  submitLocale('ja-JP', 'blur');

  expect(await screen.findByRole('heading')).toBeInTheDocument();
  expectPreparedValuesFor('ja-JP');
});

test('accepts locale input through browser speech recognition', async () => {
  let recognition;

  class MockSpeechRecognition {
    constructor() {
      recognition = this;
    }

    start() {
      this.onstart?.();
    }

    stop() {}
  }

  Object.defineProperty(window, 'webkitSpeechRecognition', {
    configurable: true,
    value: MockSpeechRecognition
  });

  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: /Use voice locale input/i }));
  expectTextContentContains('Listening for a locale...');

  await act(async () => {
    recognition.onresult({
      results: [[{ transcript: 'Japanese Turkey' }]]
    });
    recognition.onend?.();
  });

  await waitFor(() => expect(screen.getByDisplayValue('ja-TR')).toBeInTheDocument());
  expectPreparedValuesFor('ja-TR');
});

test('shows a side-by-side locale comparison card with en-US baseline values', async () => {
  render(<App />);
  submitLocale('ja-JP');

  expect(await screen.findByRole('heading', { name: /Locale Comparison/i })).toBeInTheDocument();
  expectTextContentContains('Highlighted values differ from the en-US baseline.');
  expectTextContentContains('Selected Locale: ja-JP');
  expectTextContentContains('en-US Baseline');
  expect(screen.getByTestId('comparison-cell-language-selected')).toHaveTextContent('日本語');
  expect(screen.getByTestId('comparison-cell-language-baseline')).toHaveTextContent('English');
});

test('uses background colors to distinguish different and matching comparison values', async () => {
  render(<App />);
  submitLocale('ja-JP');

  await screen.findByRole('heading', { name: /Locale Comparison/i });

  expect(screen.getByTestId('comparison-cell-language-selected')).toHaveStyle({
    backgroundColor: '#fff4d6'
  });
  expect(screen.getByTestId('comparison-cell-number-selected')).toHaveStyle({
    backgroundColor: '#f8f9fb'
  });
});


test('shows built-in locale QA for ko-KR', async () => {
  render(<App />);
  submitLocale('ko-KR');

  expect(await screen.findByText(/GenAI-Assisted Locale QA/i)).toBeInTheDocument();
  expectTextContentContains('Bundle Source: built_in');
  expectTextContentContains('Issue Type: built-in-locale');
});

test('uses backend locale evaluation when the service is available', async () => {
  global.fetch.mockImplementation((url) => {
    if (url === '/api/evaluate-locale-bundle') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          status: 'pass',
          checks: [],
          triage: {
            category: 'built-in-locale',
            severity: 'low',
            recommendation: 'No action needed.'
          },
          serviceMeta: {
            mode: 'deterministic-service',
            genAiReady: true,
            aiUsed: false,
            aiUnavailableReason: 'service_limits'
          },
          aiReview: null
        })
      });
    }

    return Promise.reject(new Error('offline'));
  });

  render(<App />);
  submitLocale('ko-KR');

  expect(await screen.findByText(/GenAI-Assisted Locale QA/i)).toBeInTheDocument();
  expectTextContentContains('Evaluation Service: deterministic-service');
  expectTextContentContains('AI review is temporarily unavailable because the AI service is rate-limited or has no available quota, so the app is using deterministic checks.');
});

test('shows AI review details when the backend evaluation service returns them', async () => {
  global.fetch.mockImplementation((url) => {
    if (url === '/api/evaluate-locale-bundle') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          status: 'warn',
          checks: [],
          triage: {
            category: 'mixed-locale',
            severity: 'low',
            recommendation: 'No action needed.'
          },
          serviceMeta: {
            mode: 'ai-service',
            genAiReady: true,
            aiUsed: true
          },
          aiReview: {
            summary: 'Labels are coherent, but the mixed locale should be explained.',
            score: 88,
            confidence: 'high',
            recommendedNextStep: 'Keep the current behavior unless you want custom hybrid formatting.',
            findings: [
              {
                id: 'mixed-locale-clarity',
                severity: 'low',
                message: 'Consider clarifying why labels and formatted values use different locale families.'
              }
            ]
          }
        })
      });
    }

    return Promise.reject(new Error('offline'));
  });

  render(<App />);
  submitLocale('en-JP');

  expect(await screen.findByText(/GenAI-Assisted Locale QA/i)).toBeInTheDocument();
  expectTextContentContains('Evaluation Service: ai-service');
  expectTextContentContains('GenAI Review Summary: Labels are coherent, but the mixed locale should be explained.');
  expectTextContentContains('AI Score: 88');
  expectTextContentContains('AI Confidence: high');
  expectTextContentContains('Recommended Next Step: Keep the current behavior unless you want custom hybrid formatting.');
});

test('shows mixed-locale QA for en-JP', async () => {
  render(<App />);
  submitLocale('en-JP');

  expect(await screen.findByText(/GenAI-Assisted Locale QA/i)).toBeInTheDocument();
  expectTextContentContains('Issue Type: mixed-locale');
});

test('shows invalid-locale QA for bad locale input', async () => {
  render(<App />);
  submitLocale('ukr_UKR');

  expect(await screen.findByText(/GenAI-Assisted Locale QA/i)).toBeInTheDocument();
  expectTextContentContains('Issue Type: invalid-locale');
});


test('falls back to local QA evaluation when backend evaluation is unavailable', async () => {
  global.fetch.mockImplementation((url) => {
    if (url === '/api/evaluate-locale-bundle') {
      return Promise.reject(new Error('offline'));
    }

    return Promise.reject(new Error('offline'));
  });

  render(<App />);
  submitLocale('ko-KR');

  expect(await screen.findByText(/GenAI-Assisted Locale QA/i)).toBeInTheDocument();
  expectTextContentContains('Evaluation Service: deterministic-local');
  expectTextContentContains('AI review is temporarily unavailable because the evaluation service could not be reached, so the app is using deterministic checks.');
});
