export const DEFAULT_ICU4X_VERSION = '2.2.0';

export const ICU4X_VERSION_OPTIONS = [
  {
    id: '2.2.0',
    cldrVersion: '48.2',
    loading: 'preloaded',
    available: true
  },
  {
    id: '2.1.0',
    cldrVersion: '48',
    loading: 'lazy',
    available: true
  },
  {
    id: '2.0.0',
    cldrVersion: '47',
    loading: 'lazy',
    available: true
  },
  {
    id: '1.5.0',
    cldrVersion: '45',
    loading: 'custom-wasm-required',
    available: false
  },
  {
    id: '1.4.0',
    cldrVersion: '44',
    loading: 'custom-wasm-required',
    available: false
  }
];

export function getIcu4xVersionOption(version) {
  return ICU4X_VERSION_OPTIONS.find((option) => option.id === version) || null;
}
