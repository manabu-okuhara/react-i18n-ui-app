This repository should be reviewed and modified with internationalization and localization in mind.

Project expectations:
- All user-facing strings should be routed through the project's translation mechanism instead of being hard-coded in components.
- Prefer complete translatable phrases over concatenated string fragments.
- Changes that add UI text should also update the appropriate locale resource files.
- Date, time, number, and currency output should use locale-aware formatting.
- Avoid locale-sensitive logic that assumes English-only casing, sorting, or parsing behavior.
- Check loading states, empty states, validation messages, alerts, and accessibility labels for translation coverage.
- Consider right-to-left layout and bidirectional text behavior when changing UI structure.

When asked to review code in this repo:
- Surface i18n and l10n findings first, with file and line references.
- Call out missing translation keys, unused keys, and inconsistent key naming when visible.
- Mention testing gaps around locale switching or fallback behavior if they are not covered.

When asked to implement changes in this repo:
- Preserve the existing translation approach already used by the project.
- Do not introduce a new i18n library unless explicitly requested.
