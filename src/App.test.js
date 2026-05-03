import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

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

  expect(screen.getByRole('heading', { name: 'System Dashboard' })).toBeInTheDocument();
  expect(screen.getByLabelText(/Enter Locale to display locale based values:/)).toBeInTheDocument();
  expect(screen.queryByText(/Input Locale:/)).not.toBeInTheDocument();
});

test('prepares Japanese content after Enter is pressed', async () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'ja-JP' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByRole('heading', { name: 'システムダッシュボード' })).toBeInTheDocument();
  expect(screen.getByText(/入力ロケール:/)).toBeInTheDocument();
  expect(screen.getByText(/言語:/)).toBeInTheDocument();
  expect(screen.getByText(/地域:/)).toBeInTheDocument();
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
        title: '시스템 대시보드',
        chooseLocale: '로캘 기반 값을 표시할 로캘을 입력하세요:',
        searchPlaceholder: '예: ko, ko-KR, en, en-US',
        inputLocaleSentence: '입력 로캘: {inputLocale}',
        languageSentence: '언어: {languageName}',
        regionSentence: '지역: {regionName}',
        dateSentence: '날짜 / 시간: {currentDate}',
        numberSentence: '날짜 기반 계산 숫자: {value}',
        percentSentence: '백분율 값: {percentValue}',
        firstDayOfWeekSentence: '주의 첫째 요일: {firstDayOfWeek}',
        share: '링크 복사',
        copyConfirmation: '링크가 복사되었습니다.',
        copyError: '링크를 복사할 수 없습니다.',
        pluralSentence: 'ICU 메시지 형식 복수형:\n{exampleOne, plural, other {사과 #<accent>개</accent>가 있습니다.}}\n{exampleThree, plural, other {사과 #<accent>개</accent>가 있습니다.}}\n{exampleFive, plural, other {사과 #<accent>개</accent>가 있습니다.}}\n{count, plural, other {사과 #<accent>개</accent>가 있습니다.}}'
      }
    })
  });

  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'ko-KR' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByRole('heading', { name: '시스템 대시보드' })).toBeInTheDocument();
  expect(screen.getByText(/입력 로캘:/)).toBeInTheDocument();
  expect(screen.getByText(/언어:/)).toBeInTheDocument();
  expect(screen.getByText(/지역:/)).toBeInTheDocument();
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

test('falls back to english copy while keeping requested locale formatting when backend is unavailable', async () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'ko-KR' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByText(/Input Locale:/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'System Dashboard' })).toBeInTheDocument();
  expect(screen.getByText(/Language:/)).toBeInTheDocument();
  expect(screen.getByText(/Region:/)).toBeInTheDocument();
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

  expect(await screen.findByRole('heading', { name: 'システムダッシュボード' })).toBeInTheDocument();
});

test('falls back to fr-CA for a language-only French locale', async () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'fr' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByRole('heading', { name: 'Tableau de bord du systeme' })).toBeInTheDocument();
});

test('falls back to tr-TR for a language-only Turkish locale', async () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'tr' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByRole('heading', { name: 'Sistem Panosu' })).toBeInTheDocument();
});

test('reuses the ru-RU bundle for a language-only Russian locale without calling the backend', async () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'ru' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByRole('heading', { name: 'Системная панель управления' })).toBeInTheDocument();
  expect(screen.getByText(/Первый день недели:/)).toBeInTheDocument();
  expect(screen.getAllByText(/яблоко|яблока|яблок/).length).toBeGreaterThan(0);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('uses a likely region locale for unsupported language-only locales', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      locale: 'pl-PL',
      messages: {
        title: 'Panel systemowy',
        chooseLocale: 'Wpisz ustawienia regionalne, aby wyswietlic wartosci zalezne od lokalizacji:',
        searchPlaceholder: 'np. pl, pl-PL, en, en-US',
        inputLocaleSentence: 'Wprowadzona lokalizacja: {inputLocale}',
        languageSentence: 'Jezyk: {languageName}',
        regionSentence: 'Region: {regionName}',
        dateSentence: 'Data / godzina: {currentDate}',
        numberSentence: 'Liczba obliczona na podstawie daty: {value}',
        percentSentence: 'Wartosc procentowa: {percentValue}',
        firstDayOfWeekSentence: 'Pierwszy dzien tygodnia: {firstDayOfWeek}',
        share: 'Kopiuj link',
        copyConfirmation: 'Skopiowano link.',
        copyError: 'Nie udalo sie skopiowac linku.',
        pluralSentence: 'Liczba mnoga w formacie ICU:\nJest 1 <accent>jablko</accent>.\nSa 3 <accent>jablka</accent>.\nJest 5 <accent>jabłek</accent>.\nJest 6 <accent>jabłek</accent>.'
      }
    })
  });

  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'pl' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(await screen.findByRole('heading', { name: 'Panel systemowy' })).toBeInTheDocument();
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

  await screen.findByRole('heading', { name: 'لوحة تحكم النظام' });
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
  expect(screen.queryByRole('heading', { name: 'Tableau de bord du systeme' })).not.toBeInTheDocument();
});
