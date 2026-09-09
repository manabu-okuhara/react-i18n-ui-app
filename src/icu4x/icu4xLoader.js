import { DEFAULT_ICU4X_VERSION, getIcu4xVersionOption } from './versionRegistry';
import { buildPluralPreviewMessage } from '../translateLocaleBundle';

const moduleLoaders = {
  '2.0.0': () => import(/* webpackChunkName: "icu4x-2-0" */ 'icu4x-2-0'),
  '2.1.0': () => import(/* webpackChunkName: "icu4x-2-1" */ 'icu4x-2-1'),
  '2.2.0': () => import(/* webpackChunkName: "icu4x-2-2" */ 'icu4x-2-2')
};

const enginePromises = new Map();
const loadedEngines = new Map();

function createIcu4xEngine(version, icu4xModule) {
  const metadata = getIcu4xVersionOption(version);
  const decimalFormatters = new Map();
  const pluralRules = new Map();
  const pluralRuleSignatures = new Map();

  function getDecimalFormatter(locale) {
    if (!decimalFormatters.has(locale)) {
      const icuLocale = icu4xModule.Locale.fromString(locale);
      decimalFormatters.set(
        locale,
        icu4xModule.DecimalFormatter.createWithGroupingStrategy(icuLocale, null)
      );
    }

    return decimalFormatters.get(locale);
  }

  function getPluralRules(locale) {
    if (!pluralRules.has(locale)) {
      const icuLocale = icu4xModule.Locale.fromString(locale);
      pluralRules.set(locale, icu4xModule.PluralRules.createCardinal(icuLocale));
    }

    return pluralRules.get(locale);
  }

  function formatNumber(locale, value, fractionDigits) {
    const decimal = icu4xModule.Decimal.fromString(
      Number(value).toFixed(fractionDigits)
    );
    return getDecimalFormatter(locale).format(decimal);
  }

  function selectPluralCategory(locale, value) {
    const operands = icu4xModule.PluralOperands.fromString(String(value));
    return getPluralRules(locale).categoryFor(operands).value.toLowerCase();
  }

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
    },
    formatNumber(locale, value, fractionDigits = 2) {
      return formatNumber(locale, value, fractionDigits);
    },
    formatPercent(locale, value) {
      const formattedNumber = formatNumber(locale, Number(value) * 100, 0);
      const browserParts = new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).formatToParts(value);
      let includedNumber = false;

      return browserParts.map(({ type, value: partValue }) => {
        if (type === 'integer' || type === 'group' || type === 'decimal' || type === 'fraction') {
          if (includedNumber) return '';
          includedNumber = true;
          return formattedNumber;
        }
        return partValue;
      }).join('');
    },
    selectPluralCategory(locale, value) {
      return selectPluralCategory(locale, value);
    },
    getPluralRuleSignature(locale) {
      if (pluralRuleSignatures.has(locale)) {
        return pluralRuleSignatures.get(locale);
      }

      const rules = getPluralRules(locale);
      const categoryOrder = ['zero', 'one', 'two', 'few', 'many', 'other'];
      const categories = categoryOrder.filter((category) => rules.categories[category]);
      const integerSamples = Array.from({ length: 201 }, (_value, count) => count);
      const decimalSamples = [0.1, 0.5, 1.1, 1.5, 2.1, 2.5, 10.1, 100.1];
      const selections = [...integerSamples, ...decimalSamples]
        .map((count) => `${count}:${selectPluralCategory(locale, count)}`)
        .join('|');

      const signature = `${categories.join(',')}|${selections}`;
      pluralRuleSignatures.set(locale, signature);
      return signature;
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

export function applyIcu4xFormatting(bundle, engine) {
  if (!bundle || !engine) {
    return bundle;
  }

  const generatedAt = new Date(bundle.generatedAt);
  const values = { ...bundle.values };
  const activeScopes = [];
  const fallbackScopes = [];

  try {
    values.currentDate = engine.formatDateTime(bundle.formattingLocale, generatedAt);
    activeScopes.push('date-time');
  } catch {
    fallbackScopes.push('date-time');
  }

  try {
    values.formattedNumber = engine.formatNumber(
      bundle.formattingLocale,
      bundle.values.numberRawValue,
      2
    );
    activeScopes.push('number');
  } catch {
    fallbackScopes.push('number');
  }

  try {
    values.percentValue = engine.formatPercent(
      bundle.formattingLocale,
      bundle.values.percentRawValue
    );
    activeScopes.push('percent-number');
  } catch {
    fallbackScopes.push('percent');
  }

  try {
    const selectPluralCategory = (count) => engine.selectPluralCategory(
      bundle.localeUsed,
      count
    );
    values.pluralPreviewCategories = bundle.values.pluralPreviewCounts.map(
      selectPluralCategory
    );
    values.pluralMessage = buildPluralPreviewMessage(
      bundle.messages.pluralSentence,
      bundle.localeUsed,
      selectPluralCategory
    );
    values.pluralRuleSignature = engine.getPluralRuleSignature(bundle.localeUsed);
    activeScopes.push('plural');
  } catch {
    fallbackScopes.push('plural');
  }

  return {
    ...bundle,
    formattingEngine: {
      name: activeScopes.length > 0 ? 'ICU4X' : 'Browser Intl',
      requestedName: 'ICU4X',
      version: engine.version,
      cldrVersion: engine.cldrVersion,
      scope: activeScopes,
      fallbackScope: fallbackScopes,
      percentAffixSource: activeScopes.includes('percent-number') ? 'Browser Intl' : undefined,
      status: fallbackScopes.length === 0
        ? 'active'
        : activeScopes.length > 0
          ? 'partial-fallback'
          : 'locale-fallback'
    },
    values
  };
}

export const applyIcu4xDateTime = applyIcu4xFormatting;
