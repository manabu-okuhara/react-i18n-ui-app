import io
import json
import zipfile
from pathlib import Path

import pytest

from localization_tools.lokalise_pull import (
    LokalisePullError,
    build_download_payload,
    extract_translation_archive,
    get_bundle_url,
)


def make_archive(entries: dict[str, str]) -> bytes:
    archive_bytes = io.BytesIO()
    with zipfile.ZipFile(archive_bytes, "w") as archive:
        for filename, contents in entries.items():
            archive.writestr(filename, contents)
    return archive_bytes.getvalue()


def test_build_download_payload_requests_reviewed_json_files() -> None:
    assert build_download_payload("reviewed_only") == {
        "format": "json",
        "original_filenames": True,
        "directory_prefix": "/",
        "filter_data": "reviewed_only",
    }


def test_extract_translation_archive_imports_targets_but_never_source(tmp_path: Path) -> None:
    locale_dir = tmp_path / "locales"
    source_contents = json.dumps({"title": "English source"})
    target_contents = json.dumps({"title": "Titre"})
    archive = make_archive({"src/locales/en-US.json": source_contents, "src/locales/fr-CA.json": target_contents})

    imported = extract_translation_archive(archive, locale_dir)

    assert imported == [locale_dir / "fr-CA.json"]
    assert (locale_dir / "fr-CA.json").read_text(encoding="utf-8") == target_contents
    assert not (locale_dir / "en-US.json").exists()


def test_extract_translation_archive_rejects_unsafe_or_invalid_members(tmp_path: Path) -> None:
    unsafe_archive = make_archive({"../ja-JP.json": json.dumps({"title": "危険"})})
    invalid_name_archive = make_archive({"locale.json": json.dumps({"title": "Invalid"})})

    with pytest.raises(LokalisePullError, match="Unsafe path"):
        extract_translation_archive(unsafe_archive, tmp_path / "locales")

    with pytest.raises(LokalisePullError, match="Invalid locale filename"):
        extract_translation_archive(invalid_name_archive, tmp_path / "locales")


def test_extract_translation_archive_rejects_duplicate_json_keys(tmp_path: Path) -> None:
    archive = make_archive({"ja-JP.json": '{"title": "A", "title": "B"}'})

    with pytest.raises(LokalisePullError, match="Duplicate JSON key"):
        extract_translation_archive(archive, tmp_path / "locales")


def test_get_bundle_url_accepts_documented_response_shapes() -> None:
    assert get_bundle_url({"bundle_url": "https://example.com/export.zip"}) == "https://example.com/export.zip"
    assert get_bundle_url({"data": {"bundle_url": "https://example.com/export.zip"}}) == "https://example.com/export.zip"

    with pytest.raises(LokalisePullError, match="bundle URL"):
        get_bundle_url({"bundle_url": "not-a-url"})
