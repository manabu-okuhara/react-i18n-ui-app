"""Command-line entry point for localization resource validation."""

from __future__ import annotations

import argparse
from pathlib import Path

from .resource_linter import lint_locale_directory, report_as_json, report_as_markdown


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate React locale JSON bundles.")
    parser.add_argument("--source", type=Path, default=Path("src/locales/en-US.json"))
    parser.add_argument("--locale-dir", type=Path, default=Path("src/locales"))
    parser.add_argument("--report", type=Path, default=Path("python-localization-report.md"))
    parser.add_argument(
        "--json-report", type=Path, default=Path("python-localization-report.json")
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    report = lint_locale_directory(args.source, args.locale_dir)

    markdown = report_as_markdown(report)
    args.report.write_text(markdown, encoding="utf-8")
    args.json_report.write_text(report_as_json(report), encoding="utf-8")
    print(markdown)

    return 0 if report.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
