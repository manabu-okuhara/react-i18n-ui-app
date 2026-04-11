import { render, screen } from '@testing-library/react';
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
  expect(screen.getByLabelText('表示を更新するには、ロケールを検索または入力してください：')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'リンクをコピー' })).toBeInTheDocument();
});

test('falls back to en-US messages for an unsupported locale', () => {
  window.history.replaceState({}, '', '/?hl=de-DE');

  render(<App />);

  expect(screen.getByRole('heading', { name: 'System Dashboard' })).toBeInTheDocument();
  expect(screen.getByLabelText('Please search for or type a locale to update the view:')).toBeInTheDocument();
  expect(
    screen.getByText(/There is 1 apple\. There are 3 apples\. There are 5 apples\./)
  ).toBeInTheDocument();
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

test('applies rtl direction for Arabic', () => {
  window.history.replaceState({}, '', '/?hl=ar-EG');

  const { container } = render(<App />);
  const dashboard = container.querySelector('[dir="rtl"]');

  expect(dashboard).not.toBeNull();
  expect(screen.getByRole('button', { name: 'نسخ الرابط' })).toBeInTheDocument();
});
