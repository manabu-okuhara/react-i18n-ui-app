"""Download reviewed Lokalise JSON bundles safely for CI validation."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import tempfile
import zipfile
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path, PurePosixPath
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from .resource_linter import LOCALE_FILENAME_PATTERN, load_resource_bundle

API_ROOT = "https://api.lokalise.com/api2"
DEFAULT_FILTER = "reviewed_only"


class LokalisePullError(RuntimeError):
    """Raised when a Lokalise export cannot be downloaded or safely staged."""


def build_download_payload(filter_data: str) -> dict[str, object]:
    """Build the minimal, review-only JSON export request."""

    return {
        "format": "json",
        "original_filenames": True,
        "directory_prefix": "/",
        "filter_data": filter_data,
    }


def require_environment(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise LokalisePullError(f"{name} is not configured.")
    return value


def request_json(request: Request, opener: Callable[..., object] = urlopen) -> dict[str, object]:
    try:
        with opener(request, timeout=30) as response:  # type: ignore[arg-type]
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise LokalisePullError(f"Lokalise request failed with status {error.code}.") from error
    except URLError as error:
        raise LokalisePullError(f"Unable to reach Lokalise: {error.reason}") from error
    except json.JSONDecodeError as error:
        raise LokalisePullError("Lokalise returned invalid JSON.") from error

    if not isinstance(payload, dict):
        raise LokalisePullError("Lokalise returned an unexpected JSON payload.")
    return payload


def request_bytes(request: Request, opener: Callable[..., object] = urlopen) -> bytes:
    try:
        with opener(request, timeout=60) as response:  # type: ignore[arg-type]
            return response.read()
    except HTTPError as error:
        raise LokalisePullError(f"Lokalise export download failed with status {error.code}.") from error
    except URLError as error:
        raise LokalisePullError(f"Unable to download Lokalise export: {error.reason}") from error


def get_bundle_url(payload: dict[str, object]) -> str:
    direct_url = payload.get("bundle_url") or payload.get("url")
    nested_data = payload.get("data")
    nested_url = nested_data.get("bundle_url") if isinstance(nested_data, dict) else None
    bundle_url = direct_url or nested_url

    if not isinstance(bundle_url, str) or not bundle_url.startswith(("https://", "http://")):
        raise LokalisePullError("Lokalise export response did not include a valid bundle URL.")
    return bundle_url


def create_download_request(project_id: str, token: str, filter_data: str) -> Request:
    endpoint = f"{API_ROOT}/projects/{quote(project_id, safe='')}/files/download"
    data = json.dumps(build_download_payload(filter_data)).encode("utf-8")
    return Request(
        endpoint,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Api-Token": token,
        },
    )


def _validated_archive_members(archive: zipfile.ZipFile, source_name: str) -> list[tuple[zipfile.ZipInfo, str]]:
    members: list[tuple[zipfile.ZipInfo, str]] = []
    destination_names: set[str] = set()

    for member in archive.infolist():
        if member.is_dir():
            continue

        path = PurePosixPath(member.filename)
        if path.is_absolute() or ".." in path.parts:
            raise LokalisePullError(f"Unsafe path in Lokalise archive: {member.filename}")

        filename = path.name
        if not filename.endswith(".json"):
            raise LokalisePullError(f"Unexpected non-JSON file in Lokalise archive: {member.filename}")
        if filename == source_name:
            continue
        if not LOCALE_FILENAME_PATTERN.fullmatch(filename):
            raise LokalisePullError(
                f"Invalid locale filename in Lokalise archive: {member.filename}."
            )
        if filename in destination_names:
            raise LokalisePullError(f"Duplicate locale filename in Lokalise archive: {filename}")

        destination_names.add(filename)
        members.append((member, filename))

    return members


def extract_translation_archive(archive_bytes: bytes, locale_dir: Path, source_name: str = "en-US.json") -> list[Path]:
    """Validate an export archive before replacing target locale files.

    The source bundle is intentionally ignored so a TMS return flow can never overwrite
    repository-owned English source content.
    """

    try:
        archive = zipfile.ZipFile(BytesIO(archive_bytes))
    except zipfile.BadZipFile as error:
        raise LokalisePullError("Lokalise export is not a valid ZIP archive.") from error

    with archive:
        members = _validated_archive_members(archive, source_name)
        if not members:
            return []

        locale_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="lokalise-return-", dir=locale_dir.parent) as temp_dir:
            staging_dir = Path(temp_dir)
            staged_paths: list[tuple[Path, Path]] = []

            for member, filename in members:
                staged_path = staging_dir / filename
                staged_path.write_bytes(archive.read(member))
                # Validate UTF-8, JSON shape, string values, and duplicate keys before copying.
                try:
                    load_resource_bundle(staged_path)
                except ValueError as error:
                    raise LokalisePullError(
                        f"Invalid returned locale bundle {filename}: {error}"
                    ) from error
                staged_paths.append((staged_path, locale_dir / filename))

            for staged_path, destination_path in staged_paths:
                shutil.copyfile(staged_path, destination_path)

    return [locale_dir / filename for _, filename in members]


def write_metadata(
    output_path: Path,
    project_id: str,
    filter_data: str,
    archive_bytes: bytes,
    imported_paths: list[Path],
) -> None:
    payload = {
        "project_id": project_id,
        "filter_data": filter_data,
        "export_sha256": hashlib.sha256(archive_bytes).hexdigest(),
        "downloaded_at": datetime.now(UTC).isoformat(),
        "imported_files": [str(path) for path in imported_paths],
    }
    output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Download reviewed Lokalise JSON translations for local validation."
    )
    parser.add_argument("--locale-dir", type=Path, default=Path("src/locales"))
    parser.add_argument("--source-name", default="en-US.json")
    parser.add_argument("--filter-data", default=os.environ.get("LOKALISE_RETURN_FILTER", DEFAULT_FILTER))
    parser.add_argument(
        "--metadata-output", type=Path, default=Path("lokalise-return-metadata.json")
    )
    args = parser.parse_args(argv)

    token = require_environment("LOKALISE_API_TOKEN")
    project_id = require_environment("LOKALISE_PROJECT_ID")
    response = request_json(create_download_request(project_id, token, args.filter_data))
    archive_bytes = request_bytes(Request(get_bundle_url(response), headers={"Accept": "application/zip"}))
    imported_paths = extract_translation_archive(archive_bytes, args.locale_dir, args.source_name)
    write_metadata(args.metadata_output, project_id, args.filter_data, archive_bytes, imported_paths)

    if imported_paths:
        print("Downloaded reviewed Lokalise translations:")
        for path in imported_paths:
            print(f"- {path}")
    else:
        print("No target JSON locale files were returned by Lokalise.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
