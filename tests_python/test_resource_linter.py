import json
from pathlib import Path

import pytest

from localization_tools.resource_linter import (
    DuplicateKeyError,
    extract_placeholders,
    lint_bundle,
    lint_locale_directory,
    load_resource_bundle,
    report_as_markdown,
)


def write_bundle(path: Path, payload: dict[str, str]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def test_extract_placeholders_handles_simple_and_icu_arguments() -> None:
    message = (
        "Hello {userName}. "
        "{count, plural, one {There is # item.} other {There are # items.}}"
    )
    assert extract_placeholders(message) == {"userName", "count"}


def test_lint_bundle_reports_missing_extra_and_placeholder_mismatch(tmp_path: Path) -> None:
    source = {"welcome": "Welcome, {name}!", "logout": "Log out"}
    target = {"welcome": "ようこそ、{user}さん！", "extra": "追加"}

    findings = lint_bundle(source, target, tmp_path / "ja-JP.json")
    codes = {finding.code for finding in findings}

    assert "missing-key" in codes
    assert "extra-key" in codes
    assert "placeholder-mismatch" in codes


def test_lint_bundle_allows_locale_specific_plural_categories(tmp_path: Path) -> None:
    source = {"items": "{count, plural, one {# item} other {# items}}"}
    target = {"items": "{count, plural, other {# 個}}"}

    findings = lint_bundle(source, target, tmp_path / "ja-JP.json")
    assert not [finding for finding in findings if finding.severity == "error"]


def test_load_resource_bundle_rejects_duplicate_keys(tmp_path: Path) -> None:
    path = tmp_path / "en-US.json"
    path.write_text('{"welcome": "Welcome", "welcome": "Hello"}', encoding="utf-8")

    with pytest.raises(DuplicateKeyError, match="welcome"):
        load_resource_bundle(path)


def test_directory_report_fails_for_missing_target_key(tmp_path: Path) -> None:
    source = tmp_path / "en-US.json"
    target = tmp_path / "ja-JP.json"
    write_bundle(source, {"welcome": "Welcome", "logout": "Log out"})
    write_bundle(target, {"welcome": "ようこそ"})

    report = lint_locale_directory(source, tmp_path)
    markdown = report_as_markdown(report)

    assert not report.passed
    assert len(report.errors) == 1
    assert "missing-key" in markdown


def test_current_repository_locale_bundles_have_matching_keys() -> None:
    source = Path("src/locales/en-US.json")
    report = lint_locale_directory(source, source.parent)

    assert report.passed, report_as_markdown(report)
