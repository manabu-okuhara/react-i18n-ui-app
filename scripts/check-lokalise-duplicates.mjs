import fs from 'fs/promises';
import path from 'path';
import { execFile as execFileCallback } from 'child_process';
import { promisify } from 'util';

const execFile = promisify(execFileCallback);

const REPORT_PATH = 'lokalise-duplicate-report.md';
const LOCALE_FILE = 'src/locales/en-US.json';
const API_BASE = 'https://api.lokalise.com/api2';

const {
  LOKALISE_API_TOKEN,
  LOKALISE_PROJECT_ID,
  GITHUB_BASE_REF,
} = process.env;

const DIFF_MODE = process.env.DIFF_MODE || 'ci';

async function main() {
  const findings = {
    errors: [],
    warnings: [],
    notes: [],
  };

  try {
    validateEnv();

    const { newEntries, changedEntries, lineNumbers } = await getChangedEntries();

    if (Object.keys(newEntries).length === 0 && Object.keys(changedEntries).length === 0) {
      findings.notes.push(`No added or modified entries found in \`${LOCALE_FILE}\`.`);
      findings.notes.push(`Diff mode: \`${DIFF_MODE}\`.`);
      await writeReport(findings);
      return;
    }

    const lokaliseKeys = await fetchAllLokaliseKeys();
    const { keyIndex, valueIndex } = buildIndexes(lokaliseKeys);

    for (const [key, value] of Object.entries(newEntries)) {
      if (keyIndex.has(key)) {
        findings.errors.push(
          `${formatLocation(key, lineNumbers)} New key \`${key}\` already exists in Lokalise.`
        );
      }

      const duplicateKeys = (valueIndex.get(value) || []).filter((existingKey) => existingKey !== key);
      if (duplicateKeys.length > 0) {
        findings.warnings.push(
          `${formatLocation(key, lineNumbers)} English value ${JSON.stringify(value)} already exists under key(s): ${duplicateKeys
            .map((item) => `\`${item}\``)
            .join(', ')}.`
        );
      }
    }

    for (const [key, value] of Object.entries(changedEntries)) {
      const duplicateKeys = (valueIndex.get(value) || []).filter((existingKey) => existingKey !== key);
      if (duplicateKeys.length > 0) {
        findings.warnings.push(
          `${formatLocation(key, lineNumbers)} Updated English value for \`${key}\` matches existing key(s): ${duplicateKeys
            .map((item) => `\`${item}\``)
            .join(', ')}.`
        );
      }
    }

    if (findings.errors.length === 0 && findings.warnings.length === 0) {
      findings.notes.push(
        `No duplicate key names or duplicate English values were found for changed entries in \`${LOCALE_FILE}\`.`
      );
    }

    findings.notes.push(`New entries checked: ${Object.keys(newEntries).length}.`);
    findings.notes.push(`Changed entries checked: ${Object.keys(changedEntries).length}.`);
    findings.notes.push(`Diff mode: \`${DIFF_MODE}\`.`);

    await writeReport(findings);

    if (findings.errors.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    findings.errors.push(`Duplicate check failed: ${error instanceof Error ? error.message : String(error)}`);
    findings.notes.push(`Diff mode: \`${DIFF_MODE}\`.`);
    await writeReport(findings);
    process.exitCode = 1;
  }
}

function validateEnv() {
  if (!LOKALISE_API_TOKEN) {
    throw new Error('Missing required environment variable LOKALISE_API_TOKEN.');
  }

  if (!LOKALISE_PROJECT_ID) {
    throw new Error('Missing required environment variable LOKALISE_PROJECT_ID.');
  }

  if (!GITHUB_BASE_REF) {
    throw new Error('Missing required environment variable GITHUB_BASE_REF.');
  }
}

async function getChangedEntries() {
  const baseLocale = await getBaseLocaleContent();
  const { parsed: currentLocale, lineNumbers } = await getCurrentLocaleInfo();

  const newEntries = {};
  const changedEntries = {};

  for (const [key, value] of Object.entries(currentLocale)) {
    if (typeof value !== 'string') {
      continue;
    }

    if (!(key in baseLocale)) {
      newEntries[key] = value;
      continue;
    }

    if (baseLocale[key] !== value) {
      changedEntries[key] = value;
    }
  }

  return { newEntries, changedEntries, lineNumbers };
}

async function getBaseLocaleContent() {
  const baseRef = `origin/${GITHUB_BASE_REF}`;

  await execFile('git', ['fetch', 'origin', GITHUB_BASE_REF], { cwd: process.cwd() });

  const result = await execFile(
    'git',
    ['show', `${baseRef}:${LOCALE_FILE}`],
    { cwd: process.cwd() }
  );

  return JSON.parse(result.stdout);
}

async function getCurrentLocaleInfo() {
  if (DIFF_MODE === 'working-tree') {
    return getWorkingTreeLocaleInfo();
  }

  return getHeadLocaleInfo();
}

async function getWorkingTreeLocaleInfo() {
  const localePath = path.join(process.cwd(), LOCALE_FILE);
  const raw = await fs.readFile(localePath, 'utf8');
  return parseLocaleInfo(raw);
}

async function getHeadLocaleInfo() {
  const result = await execFile(
    'git',
    ['show', `HEAD:${LOCALE_FILE}`],
    { cwd: process.cwd() }
  );

  return parseLocaleInfo(result.stdout);
}

function parseLocaleInfo(raw) {
  const parsed = JSON.parse(raw);

  const lineNumbers = new Map();
  raw.split('\n').forEach((line, index) => {
    const match = line.match(/^\s*"([^"]+)":/);
    if (match) {
      lineNumbers.set(match[1], index + 1);
    }
  });

  return { parsed, lineNumbers };
}

function formatLocation(key, lineNumbers) {
  const line = lineNumbers.get(key);
  return line ? `[${LOCALE_FILE}:${line}]` : `[${LOCALE_FILE}]`;
}

async function fetchAllLokaliseKeys() {
  const allKeys = [];
  let page = 1;
  const limit = 500;

  while (true) {
    const url = new URL(`${API_BASE}/projects/${LOKALISE_PROJECT_ID}/keys`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('page', String(page));
    url.searchParams.set('include_translations', '1');

    const response = await fetch(url, {
      headers: {
        'X-Api-Token': LOKALISE_API_TOKEN,
      },
    });

    if (!response.ok) {
      throw new Error(`Lokalise API request failed with status ${response.status}.`);
    }

    const data = await response.json();
    const keys = data.keys || [];
    allKeys.push(...keys);

    const totalResults = data.total_results || 0;
    const totalPages = Math.ceil(totalResults / limit);

    if (page >= totalPages || keys.length === 0) {
      break;
    }

    page += 1;
  }

  return allKeys;
}

function buildIndexes(keys) {
  const keyIndex = new Map();
  const valueIndex = new Map();

  for (const item of keys) {
    const keyName =
      item.key_name?.web ||
      item.key_name?.ios ||
      item.key_name?.android ||
      item.key_name?.other;

    if (!keyName) {
      continue;
    }

    keyIndex.set(keyName, item);

    const translations = item.translations || [];
    for (const translation of translations) {
      const value = translation.translation;
      if (typeof value !== 'string' || !value.trim()) {
        continue;
      }

      const existing = valueIndex.get(value) || [];
      existing.push(keyName);
      valueIndex.set(value, existing);
    }
  }

  return { keyIndex, valueIndex };
}

async function writeReport(findings) {
  const lines = ['## Lokalise Duplicate Check', ''];

  if (findings.errors.length > 0) {
    lines.push('### Errors');
    for (const error of findings.errors) {
      lines.push(`- ${error}`);
    }
    lines.push('');
  }

  if (findings.warnings.length > 0) {
    lines.push('### Warnings');
    for (const warning of findings.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push('');
  }

  lines.push('### Notes');
  if (findings.notes.length > 0) {
    for (const note of findings.notes) {
      lines.push(`- ${note}`);
    }
  } else {
    lines.push('- Checked changed entries in `src/locales/en-US.json` against existing Lokalise keys and values.');
  }
  lines.push('');

  await fs.writeFile(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
}

await main();

