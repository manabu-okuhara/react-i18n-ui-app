# GlobalizeApp React I18n UI Demo

A React and Node.js internationalization demo that combines locale-aware rendering, en-US comparison, dynamic locale fallback, GenAI-assisted locale QA, voice-driven input, and pull-request quality checks.

The project demonstrates how frontend locale UX, backend evaluation services, a translation-management-system guard, and CI automation can work together in an **AI-assisted internationalization operations prototype**.

## What the app does

Enter, select, or speak a locale such as `ja-JP`, `pl-PL`, `ar-EG`, or a mixed locale such as `en-JP`. The app prepares the locale bundle and displays a side-by-side comparison with an `en-US` baseline generated at the same instant.

The comparison includes:

- language and region names
- localized date and time, with an inferred date/time field pattern
- locale-aware numbers and percentages, with inferred number-format patterns
- first day of week, including its English name where useful
- fixed ICU plural examples for `1`, `3`, and `5`, annotated with the selected plural category

Values that differ from the en-US baseline use a soft amber background. Language and region are informational and are not marked as differences because they naturally vary by locale.

The first column also shows compact formatting-provenance badges without changing either value column. Purple badges identify the selected ICU4X/CLDR engine, blue badges identify browser `Intl` APIs, gray badges identify application-owned preview logic, and amber badges identify an ICU4X fallback. Browser `Intl` badges say `browser runtime` because browsers do not expose a reliable ICU or CLDR version through the JavaScript API.

### Semantic comparisons

Not every translated value should be compared as raw text:

- **First day of week** is compared by weekday index, so `日曜日 (Sunday)` and `Sunday` are treated as the same day.
- **Plural behavior** is compared using representative ICU4X plural-category selections when the selected engine is active, with `Intl.PluralRules` as the fallback.
- **Date, time, number, and percent** are compared by their rendered locale output.

The date/time annotation is inferred from `Intl.DateTimeFormat.resolvedOptions()` and `formatToParts()`. For example:

```text
ja-JP: 2026年9月7日 00:48 (yMd HH:mm)
en-US: September 7, 2026 at 12:48 AM (MMMMdy hh:mm a)
```

JavaScript uses ICU through the runtime, but it does not expose the exact underlying ICU pattern. The displayed annotation is therefore an explanatory field pattern, not a direct ICU pattern value.

Number and percent rows follow the same convention, such as `90,820.26 (#,##0.00)` and `80% (#,##0%)`. Each plural example shows its resolved ICU plural category, such as `(one)`, `(few)`, or `(other)`.

## Implemented capabilities

### Locale rendering and fallback

- Built-in locale bundles for common locales
- Dynamic translation fallback for unsupported locales
- Language-only and mixed-locale resolution
- Locale-aware formatting using JavaScript `Intl`
- Localized language and region names with non-duplicated English equivalents
- ICU4X 2.2.0 WebAssembly date/time, decimal, and plural formatting for the selected locale and en-US comparison
- ICU4X-backed percent digits with browser `Intl` supplying percent-sign placement because the ICU4X 2.0–2.2 JavaScript bindings do not expose a percent formatter
- Application-owned ICU4X 2.0.0–2.2.0 formatting WASM builds with unrelated components removed
- Lazy-loaded ICU4X 2.0.0 and 2.1.0 comparison engines
- ICU Message Format-style plural examples
- Shared timestamps for fair selected-locale and en-US comparisons
- Apply button, Enter-key submission, and blur/tab-out submission
- Removal of the previous random plural example
- Safe rendering of plural `<accent>` markers as React elements

### English operational UI

The following application and QA controls intentionally remain in English for every selected locale:

- application title
- locale-entry prompt
- Copy Link action
- Apply Locale and voice controls
- Locale Comparison labels and guidance
- GenAI-Assisted Locale QA labels and service messages

The AI review prompt also requests that summaries, findings, and recommended next steps be returned in English regardless of the locale under review.

### GenAI-assisted evaluation

The app includes a backend evaluation service at `/api/evaluate-locale-bundle` with:

- deterministic QA for every prepared locale bundle
- optional OpenAI-backed quality review
- AI summary, score, confidence, findings, and recommended next step
- graceful deterministic fallback when AI is unavailable, misconfigured, or rate-limited
- color-coded status, severity, findings, and deterministic checks

The QA system supports three modes:

- `ai-service`: backend evaluation and AI review succeeded
- `deterministic-service`: backend evaluation succeeded but AI review was unavailable
- `deterministic-local`: the frontend used local deterministic evaluation because the backend route was unavailable

### Voice interaction

- Browser speech recognition when supported
- English voice command processing
- Spoken locale resolution, including:
  - `Japanese Turkey` → `ja-TR`
  - `English Japan` → `en-JP`
  - `Polish` → `pl-PL`
- English voice status and fallback messages

## Technical architecture

### Frontend

Core files:

- [`src/Dashboard.js`](src/Dashboard.js)
- [`src/translateLocaleBundle.js`](src/translateLocaleBundle.js)
- [`src/localeBundleClient.js`](src/localeBundleClient.js)
- [`src/localeQa.js`](src/localeQa.js)
- [`src/localeQaClient.js`](src/localeQaClient.js)
- [`src/components/LocaleQaPanel.js`](src/components/LocaleQaPanel.js)

Responsibilities:

- locale input and voice interaction
- locale bundle preparation and fallback handling
- locale-sensitive value generation
- semantic comparison with en-US
- QA panel rendering
- local deterministic QA fallback

`config-overrides.js` adds the minimal Create React App webpack settings required by the official ICU4X JavaScript/WebAssembly packages. It disables the packages' unreachable browser-side `fs` resolution, enables asynchronous WebAssembly with top-level await, and replaces the ICU4X 2.0.0–2.2.0 package WASM files with their verified feature-sliced artifacts in [`vendor/icu4x`](vendor/icu4x). Set `ICU4X_USE_FULL_WASM=1` to restore all three official full package artifacts for troubleshooting.

### ICU4X WebAssembly build

Each artifact is built from a pinned upstream source commit with its release-era Rust toolchain and the same minimal feature set:

```text
std,compiled_data,datetime,decimal,locale,plurals
```

This preserves the locale parsing, date/time, decimal-formatting, and plural-rule APIs used by the app while removing unrelated ICU4X components. The artifacts are checked against their committed SHA-256 digests and required WASM exports before local startup or production builds.

| ICU4X version | Official npm WASM | App formatting WASM | Uncompressed reduction | Approximate gzip reduction |
| --- | ---: | ---: | ---: | ---: |
| 2.0.0 / CLDR 47 | 12,263,559 bytes | 5,136,022 bytes | 58.1% | 70.3% |
| 2.1.0 / CLDR 48 | 15,706,643 bytes | 5,263,935 bytes | 66.5% | 75.5% |
| 2.2.0 / CLDR 48.2 | 16,423,917 bytes | 5,273,094 bytes | 67.9% | 75.9% |
| **Total** | **44,394,119 bytes** | **15,673,051 bytes** | **64.7%** | **74.2%** |

The build still contains ICU4X's compiled locale data. Filtering that data to a product-owned locale allowlist remains a separate follow-up because it requires a custom data provider or generated baked-data crate.

### Backend services

Core files:

- [`server/translateLocaleBundle.js`](server/translateLocaleBundle.js)
- [`server/evaluateLocaleBundle.js`](server/evaluateLocaleBundle.js)
- [`server/aiLocaleReviewer.js`](server/aiLocaleReviewer.js)
- [`server/aiLocaleReviewPrompt.js`](server/aiLocaleReviewPrompt.js)

Responsibilities:

- generated translation fallback for unsupported locales
- deterministic locale-bundle evaluation
- visible re-evaluation state when locale or ICU4X version changes
- active ICU4X and CLDR version reporting in deterministic QA checks
- optional AI-backed review through the OpenAI Responses API
- normalization of AI output into a UI-safe response
- classification of AI fallback reasons

## GenAI configuration

The AI path is optional. Without an API key or available quota, the application remains functional through deterministic evaluation.

The default evaluation model is:

```text
gpt-4.1-mini
```

It can be overridden with `OPENAI_EVAL_MODEL`.

Create an untracked `.env.local` file for local development:

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_EVAL_MODEL=gpt-4.1-mini
```

Never commit an API key to the repository.

## Local development

### Prerequisites

- Node.js 20 or newer
- npm
- Rustup and the pinned Rust 1.86.0, 1.90.0, and 1.93.1 toolchains only when regenerating the custom ICU4X WASM artifacts

### Install and run

```bash
npm install
npm start
```

The Create React App development server runs at [http://localhost:3000](http://localhost:3000).

### Validate

```bash
npm test -- --watchAll=false
npm run verify:icu4x-wasm
npm run build
```

To regenerate the pinned ICU4X artifacts from official source:

```bash
npm run build:icu4x-wasm
```

Individual versions can also be regenerated with `build:icu4x-wasm:2.0`, `build:icu4x-wasm:2.1`, or `build:icu4x-wasm:2.2`.

Automated coverage includes:

- locale resolution and fallback
- mixed-locale behavior
- input submission by Enter, blur, button, and voice
- en-US comparison rendering and difference colors
- semantic weekday and plural comparison
- localized language and region display names, including RTL isolation
- locale date/time pattern annotations
- number, percent, and plural-category annotations
- per-row ICU4X, CLDR, browser `Intl`, application-logic, and fallback provenance badges
- deterministic and AI-service QA behavior
- English operational UI across selected locales

## Python localization automation

The repository also treats the React application as a realistic target for a separate Python localization-tooling layer. The Python CLI reads the same JSON bundles used by React and reports blocking errors and non-blocking warnings without participating in the browser runtime.

The current checks cover:

- missing and extra resource keys
- duplicate JSON keys and duplicate English source values
- empty translations
- simple and ICU placeholder parity
- required ICU plural `other` categories while allowing locale-specific plural rules
- target values that remain identical to English
- BCP 47-style locale filenames

Run the linter and its tests locally:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --requirement requirements-python-dev.txt
python -m localization_tools.cli
python -m pytest
```

The TMS client exercise is intentionally provider-neutral and tested with mocked HTTP responses. It demonstrates fail-fast token validation, JSON payload handling, non-retryable authentication errors, exponential backoff, and bounded retries for rate limits and temporary server failures without writing to a real TMS during CI.

## CI and continuous-localization workflow

The repository includes four internationalization-focused GitHub Actions workflows. Three run on pull requests, and one manually pushes reviewed English source strings to Lokalise:

- [`.github/workflows/codex-i18n-review.yml`](.github/workflows/codex-i18n-review.yml)
- [`.github/workflows/lokalise-duplicate-check.yml`](.github/workflows/lokalise-duplicate-check.yml)
- [`.github/workflows/lokalise-push.yml`](.github/workflows/lokalise-push.yml)
- [`.github/workflows/python-localization-check.yml`](.github/workflows/python-localization-check.yml)

### Codex i18n review

The Codex workflow:

- reviews pull-request changes for internationalization issues
- uploads the review report as an artifact
- adds the result to the workflow summary
- comments on the pull request
- safely exports multiline review output
- produces a useful fallback report if the AI review cannot run

### Lokalise continuous-localization integration

The Lokalise workflow compares changed English source entries with the configured Lokalise project and reports duplicate keys or duplicate English values.

After reviewed source changes are merged, the **Push Source Locale to Lokalise** workflow can be started manually from GitHub Actions. It validates and uploads only [`src/locales/en-US.json`](src/locales/en-US.json), preserves application-owned placeholder syntax, detects ICU plural messages, and waits for Lokalise to finish processing the upload.

The integration requires the GitHub Actions secrets `LOKALISE_API_TOKEN` and `LOKALISE_PROJECT_ID`, plus a repository variable named `LOKALISE_BASE_LANG_ISO`. The variable accepts `en`, `en_US`, or `en-US` case-insensitively. Before uploading, the workflow retrieves the project's base language and passes Lokalise's exact configured value to the push action.

The manual trigger is the safe first rollout. After its project mapping and upload behavior are verified, a follow-up can trigger the same workflow automatically when `src/locales/en-US.json` changes on `main`. Pulling completed target-language translations back into a GitHub pull request remains a separate next step.

### Python localization check

The Python workflow runs the resource linter and pytest suite when locale bundles or Python automation files change. It uploads both human-readable Markdown and machine-readable JSON reports, adds the report to the GitHub Actions summary, and blocks the pull request when resource errors are present. Warnings remain visible without blocking the merge.

## Current limitations and roadmap

The application is a demo and prototype rather than a complete production localization platform. Potential next steps include:

- adopt a native ICU4X percent formatter when one becomes available in the supported JavaScript bindings
- build and publish application-owned ICU4X 1.4/1.5 WASM artifacts, which are not available through the current official `icu` npm package history
- add ICU4X 2.3.x after validating its release data and comparison behavior
- selective ICU4X locale-data packaging using a custom provider or baked-data crate
- AI-assisted remediation and locale-bundle draft generation
- moderation and safety checks for generated locale content
- localization incident triage and auto-fix workflows
- speech synthesis for localized output
- responsive and visual regression coverage across LTR and RTL locales

The ICU4X experiment uses a pinned, preloaded 2.2.0 engine with CLDR 48.2. ICU4X 2.0.0/CLDR 47 and 2.1.0/CLDR 48 are loaded only when selected. Both comparison columns use the same selected engine. ICU4X 1.4/CLDR 44 and 1.5/CLDR 45 remain visible as unavailable roadmap entries until reproducible custom WASM artifacts are added.

The official full-data WASM files are approximately 12–16 MB each before transfer compression. All three selectable 2.x engines now use 5.1–5.3 MB feature-sliced artifacts. The default 2.2 engine begins loading in the background at application startup, while the historical engines are requested only after selection. A production follow-up should filter locale data to reduce the artifacts further.

## Project positioning

**An AI-assisted internationalization operations demo built with React, Node.js, locale-aware comparison, deterministic QA, optional GenAI review, voice interaction, and internationalization-focused CI automation.**
