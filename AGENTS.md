This repository should be reviewed and modified with internationalization and localization in mind.

Current project i18n shape:
- Locale messages live in `src/locales/*.json`.
- `src/Dashboard.js` imports locale JSON files directly and maps them through the local `MESSAGES` object.
- The selected locale is driven by the `hl` URL query parameter and browser locale fallback.
- Formatting currently relies on browser `Intl` APIs such as `Intl.NumberFormat`, `Intl.PluralRules`, `Intl.Locale`, and `Intl.DisplayNames`.
- Right-to-left behavior is handled in the UI by setting `dir` and alignment from the active locale.

Project expectations:
- All user-facing strings should come from the locale JSON files or the existing message layer, not hard-coded JSX strings.
- Changes that add UI copy should update every supported locale file in `src/locales`.
- Prefer complete translatable phrases over concatenated string fragments.
- Preserve the current `hl` query-parameter locale flow unless a change request explicitly calls for a routing change.
- Date, time, number, and plural output should continue to use locale-aware browser APIs.
- Avoid locale-sensitive logic that assumes English-only casing, sorting, parsing, or region detection.
- Check loading states, empty states, validation messages, alerts, placeholders, and accessibility labels for translation coverage.
- Consider right-to-left layout and bidirectional text behavior when changing UI structure or input fields.

When asked to review code in this repo:
- Surface i18n and l10n findings first, with file and line references.
- Call out hard-coded strings that bypass `src/locales`, missing translation keys, unused keys, and inconsistent key naming.
- Check whether fallback behavior to `en-US` remains intact when a locale is unsupported.
- Mention testing gaps around locale switching, URL-driven locale changes, pluralization, and RTL behavior if they are not covered.

When asked to implement changes in this repo:
- Preserve the existing JSON-message approach unless explicitly asked to refactor it.
- Keep new strings and labels synchronized across supported locale files.
- Do not introduce a new i18n library unless explicitly requested.
