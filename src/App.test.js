import { fireEvent, render, screen } from '@testing-library/react';
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
  window.history.replaceState({}, '', '/');
});

test('renders localized dashboard content for a supported locale', () => {
  window.history.replaceState({}, '', '/?hl=ja-JP');

  render(<App />);

  expect(screen.getByRole('heading', { name: 'システムダッシュボード' })).toBeInTheDocument();
  expect(screen.getByLabelText(/ロケール.*入力してください/)).toBeInTheDocument();
  expect(screen.getByText(/入力ロケール:/)).toBeInTheDocument();
  expect(screen.getByText(/言語:/)).toBeInTheDocument();
  expect(screen.getByText(/地域:/)).toBeInTheDocument();
  expect(screen.getByText(/日付 \/ 時刻:/)).toBeInTheDocument();
  expect(screen.getByText(/パーセント値:/)).toBeInTheDocument();
  expect(screen.getByText(/週の最初の曜日:/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'リンクをコピー' })).toBeInTheDocument();
});

test('falls back to en-US messages for an unsupported locale', () => {
  window.history.replaceState({}, '', '/?hl=de-DE');

  render(<App />);

  expect(screen.getByRole('heading', { name: 'System Dashboard' })).toBeInTheDocument();
  expect(screen.getByLabelText(/Enter Locale to display locale based values:/)).toBeInTheDocument();
  expect(screen.getByText(/Input Locale:/)).toBeInTheDocument();
  expect(screen.getByText(/Language:/)).toBeInTheDocument();
  expect(screen.getByText(/Region:/)).toBeInTheDocument();
  expect(screen.getByText(/Date \/ Time:/)).toBeInTheDocument();
  expect(screen.getByText(/Percent Value:/)).toBeInTheDocument();
  expect(screen.getByText(/First Day of Week:/)).toBeInTheDocument();
  expect(screen.getByText(/Plurals with ICU Message Format:/)).toBeInTheDocument();
  expect(
    screen.getAllByText((_, element) =>
      element?.textContent?.includes('There is 1 apple.') ?? false
    ).length
  ).toBeGreaterThan(0);
  expect(
    screen.getAllByText((_, element) =>
      element?.textContent?.includes('The calculated date-based number:') ?? false
    ).length
  ).toBeGreaterThan(0);
});

test('falls back to ja-JP for a language-only Japanese locale', () => {
  window.history.replaceState({}, '', '/?hl=ja');

  render(<App />);

  expect(screen.getByRole('heading', { name: 'システムダッシュボード' })).toBeInTheDocument();
});

test('falls back to fr-CA for a language-only French locale', () => {
  window.history.replaceState({}, '', '/?hl=fr');

  render(<App />);

  expect(screen.getByRole('heading', { name: 'Tableau de bord du systeme' })).toBeInTheDocument();
});

test('falls back to tr-TR for a language-only Turkish locale', () => {
  window.history.replaceState({}, '', '/?hl=tr');

  render(<App />);

  expect(screen.getByRole('heading', { name: 'Sistem Panosu' })).toBeInTheDocument();
});

test('applies rtl direction for Arabic', () => {
  window.history.replaceState({}, '', '/?hl=ar-EG');

  const { container } = render(<App />);
  const dashboard = container.querySelector('[dir="rtl"]');

  expect(dashboard).not.toBeNull();
  expect(screen.getByRole('button', { name: 'نسخ الرابط' })).toBeInTheDocument();
});

test('accepts Enter for a language-only locale input', () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'ja' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(screen.getByRole('heading', { name: 'システムダッシュボード' })).toBeInTheDocument();
});

test('accepts Enter for an exact locale input', () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.change(input, { target: { value: 'ja-JP' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

  expect(screen.getByRole('heading', { name: 'システムダッシュボード' })).toBeInTheDocument();
});

test('clicking a suggested locale still works', () => {
  render(<App />);

  const input = screen.getByLabelText(/Enter Locale to display locale based values:/);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'fr' } });

  const suggestion = screen.getByText('fr').closest('button');
  expect(suggestion).not.toBeNull();

  fireEvent.click(suggestion);

  expect(screen.getByRole('heading', { name: 'Tableau de bord du systeme' })).toBeInTheDocument();
});

