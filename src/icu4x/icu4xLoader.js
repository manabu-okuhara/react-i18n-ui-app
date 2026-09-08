import { DEFAULT_ICU4X_VERSION, getIcu4xVersionOption } from './versionRegistry';

const moduleLoaders = {
  '2.0.0': () => import(/* webpackChunkName: "icu4x-2-0" */ 'icu4x-2-0'),
  '2.1.0': () => import(/* webpackChunkName: "icu4x-2-1" */ 'icu4x-2-1'),
  '2.2.0': () => import(/* webpackChunkName: "icu4x-2-2" */ 'icu4x-2-2')
};

const enginePromises = new Map();
const loadedEngines = new Map();

function createIcu4xEngine(version, icu4xModule) {
  const metadata = getIcu4xVersionOption(version);

  return {
    version,
    cldrVersion: metadata.cldrVersion,
    formatDateTime(locale, date) {
      const icuLocale = icu4xModule.Locale.fromString(locale);
      const formatter = icu4xModule.DateTimeFormatter.createYmdt(
        icuLocale,
        icu4xModule.DateTimeLength.Long,
        icu4xModule.TimePrecision.Minute,
        null,
        null
      );
      const isoDate = new icu4xModule.IsoDate(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate()
      );
      const time = new icu4xModule.Time(
        date.getHours(),
        date.getMinutes(),
        0,
        0
      );

      return formatter.formatIso(isoDate, time);
    }
  };
}

export function loadIcu4xEngine(version) {
  const metadata = getIcu4xVersionOption(version);

  if (!metadata) {
    return Promise.reject(new Error(`Unknown ICU4X version: ${version}`));
  }

  if (!metadata.available || !moduleLoaders[version]) {
    return Promise.reject(new Error(`ICU4X ${version} requires a custom WASM build.`));
  }

  if (!enginePromises.has(version)) {
    enginePromises.set(
      version,
      moduleLoaders[version]().then((icu4xModule) => {
        const engine = createIcu4xEngine(version, icu4xModule);
        loadedEngines.set(version, engine);
        return engine;
      })
    );
  }

  return enginePromises.get(version);
}

export function getLoadedIcu4xEngine(version) {
  return loadedEngines.get(version) || null;
}

// Begin loading the default engine as soon as the application module is evaluated.
// This keeps the React shell responsive while ensuring no user selection is required.
loadIcu4xEngine(DEFAULT_ICU4X_VERSION).catch(() => undefined);

export function applyIcu4xDateTime(bundle, engine) {
  if (!bundle || !engine) {
    return bundle;
  }

  const generatedAt = new Date(bundle.generatedAt);

  try {
    return {
      ...bundle,
      formattingEngine: {
        name: 'ICU4X',
        version: engine.version,
        cldrVersion: engine.cldrVersion,
        scope: 'date-time',
        status: 'active'
      },
      values: {
        ...bundle.values,
        currentDate: engine.formatDateTime(bundle.formattingLocale, generatedAt)
      }
    };
  } catch {
    return {
      ...bundle,
      formattingEngine: {
        name: 'Browser Intl',
        requestedName: 'ICU4X',
        version: engine.version,
        cldrVersion: engine.cldrVersion,
        scope: 'date-time',
        status: 'locale-fallback'
      }
    };
  }
}
