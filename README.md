# GlobalizeApp React I18n UI Demo

A React and Node.js internationalization demo that combines locale-aware rendering, en-US comparison, dynamic locale fallback, GenAI-assisted locale QA, voice-driven input, and pull-request quality checks.

The project demonstrates how frontend locale UX, backend evaluation services, a translation-management-system guard, and CI automation can work together in an **AI-assisted internationalization operations prototype**.

## What the app does

Enter, select, or speak a locale such as `ja-JP`, `pl-PL`, `ar-EG`, or a mixed locale such as `en-JP`. The app prepares the locale bundle and displays a side-by-side comparison with an `en-US` baseline generated at the same instant.

The comparison includes:

- language and region names
- localized date and time, with an inferred date/time field pattern
- locale-aware numbers and percentages
- first day of week, including its English name where useful
- fixed ICU plural examples for `1`, `3`, and `5`

Values that differ from the en-US baseline use a soft amber background. Language and region are informational and are not marked as differences because they naturally vary by locale.

### Semantic comparisons

Not every translated value should be compared as raw text:

- **First day of week** is compared by weekday index, so `日曜日 (Sunday)` and `Sunday` are treated as the same day.
- **Plural behavior** is compared using representative `Intl.PluralRules` category selections rather than translated plural sentences.
- **Date, time, number, and percent** are compared by their rendered locale output.

The date/time annotation is inferred from `Intl.DateTimeFormat.resolvedOptions()` and `formatToParts()`. For example:

```text
ja-JP: 2026年9月7日 00:48 (yMd HH:mm)
en-US: September 7, 2026 at 12:48 AM (MMMMdy hh:mm a)
```

JavaScript uses ICU through the runtime, but it does not expose the exact underlying ICU pattern. The displayed annotation is therefore an explanatory field pattern, not a direct ICU pattern value.

## Implemented capabilities

### Locale rendering and fallback

- Built-in locale bundles for common locales
- Dynamic translation fallback for unsupported locales
- Language-only and mixed-locale resolution
- Locale-aware formatting using JavaScript `Intl`
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

### Backend services

Core files:

- [`server/translateLocaleBundle.js`](server/translateLocaleBundle.js)
- [`server/evaluateLocaleBundle.js`](server/evaluateLocaleBundle.js)
- [`server/aiLocaleReviewer.js`](server/aiLocaleReviewer.js)
- [`server/aiLocaleReviewPrompt.js`](server/aiLocaleReviewPrompt.js)

Responsibilities:

- generated translation fallback for unsupported locales
- deterministic locale-bundle evaluation
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

### Install and run

```bash
npm install
npm start
```

The Create React App development server runs at [http://localhost:3000](http://localhost:3000).

### Validate

```bash
npm test -- --watchAll=false
npm run build
```

Automated coverage includes:

- locale resolution and fallback
- mixed-locale behavior
- input submission by Enter, blur, button, and voice
- en-US comparison rendering and difference colors
- semantic weekday and plural comparison
- locale date/time pattern annotations
- deterministic and AI-service QA behavior
- English operational UI across selected locales

## CI and continuous-localization workflow

GitHub pull requests run two internationalization-focused workflows:

- [`.github/workflows/codex-i18n-review.yml`](.github/workflows/codex-i18n-review.yml)
- [`.github/workflows/lokalise-duplicate-check.yml`](.github/workflows/lokalise-duplicate-check.yml)

### Codex i18n review

The Codex workflow:

- reviews pull-request changes for internationalization issues
- uploads the review report as an artifact
- adds the result to the workflow summary
- comments on the pull request
- safely exports multiline review output
- produces a useful fallback report if the AI review cannot run

### Lokalise duplicate guard

The Lokalise workflow compares changed English source entries with the configured Lokalise project and reports duplicate keys or duplicate English values.

This is a **continuous-localization quality guard**, not a complete bidirectional translation-sync pipeline. Lokalise credentials are supplied through GitHub Actions secrets.

## Current limitations and roadmap

The application is a demo and prototype rather than a complete production localization platform. Potential next steps include:

- an ICU4X WebAssembly proof of concept with pinned ICU4X, CLDR, and TZDB versions
- selective ICU4X locale-data packaging and bundle-size measurement
- AI-assisted remediation and locale-bundle draft generation
- moderation and safety checks for generated locale content
- localization incident triage and auto-fix workflows
- speech synthesis for localized output
- responsive and visual regression coverage across LTR and RTL locales

The ICU4X experiment should be implemented in a separate branch after the current comparison changes are merged because it affects runtime initialization, locale-data packaging, formatting behavior, tests, and the frontend build.

## Project positioning

**An AI-assisted internationalization operations demo built with React, Node.js, locale-aware comparison, deterministic QA, optional GenAI review, voice interaction, and internationalization-focused CI automation.**
