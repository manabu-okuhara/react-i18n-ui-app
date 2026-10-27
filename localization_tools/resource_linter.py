"""Resource-bundle validation used by local development and CI."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path


LOCALE_FILENAME_PATTERN = re.compile(
    r"^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|[0-9]{3}))?\.json$"
)
PLACEHOLDER_PATTERN = re.compile(r"\{([A-Za-z][A-Za-z0-9_.-]*)(?=\s*[,}])")
PLURAL_ARGUMENT_PATTERN = re.compile(
    r"\{([A-Za-z][A-Za-z0-9_.-]*)\s*,\s*plural\s*,"
)


class DuplicateKeyError(ValueError):
    """Raised when a JSON object repeats a resource key."""


@dataclass(frozen=True)
class Finding:
    severity: str
    code: str
    file: str
    message: str
    key: str | None = None

    def format_location(self) -> str:
        return f"{self.file}:{self.key}" if self.key else self.file


@dataclass
class LintReport:
    source_file: str
    target_files: list[str] = field(default_factory=list)
    findings: list[Finding] = field(default_factory=list)

    @property
    def errors(self) -> list[Finding]:
        return [finding for finding in self.findings if finding.severity == "error"]

    @property
    def warnings(self) -> list[Finding]:
        return [finding for finding in self.findings if finding.severity == "warning"]

    @property
    def passed(self) -> bool:
        return not self.errors


def _reject_duplicate_keys(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise DuplicateKeyError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def load_resource_bundle(path: Path) -> dict[str, str]:
    try:
        raw = path.read_text(encoding="utf-8")
        payload = json.loads(raw, object_pairs_hook=_reject_duplicate_keys)
    except OSError as error:
        raise ValueError(f"Unable to read {path}: {error}") from error
    except json.JSONDecodeError as error:
        raise ValueError(f"Invalid JSON in {path}: {error.msg} at line {error.lineno}") from error

    if not isinstance(payload, dict):
        raise ValueError(f"Resource bundle {path} must contain a JSON object.")

    invalid_keys = [key for key, value in payload.items() if not isinstance(value, str)]
    if invalid_keys:
        joined = ", ".join(sorted(invalid_keys))
        raise ValueError(f"Resource bundle {path} has non-string values for: {joined}")

    return payload  # type: ignore[return-value]


def extract_placeholders(message: str) -> set[str]:
    """Return simple and ICU argument names without treating plural branches as arguments."""

    return set(PLACEHOLDER_PATTERN.findall(message))


def extract_plural_arguments(message: str) -> set[str]:
    return set(PLURAL_ARGUMENT_PATTERN.findall(message))


def _bundle_load_finding(path: Path, error: Exception) -> Finding:
    return Finding(
        severity="error",
        code="invalid-resource-file",
        file=str(path),
        message=str(error),
    )


def lint_bundle(
    source: dict[str, str],
    target: dict[str, str],
    target_path: Path,
) -> list[Finding]:
    findings: list[Finding] = []
    source_keys = source.keys()
    target_keys = target.keys()

    for key in sorted(source_keys - target_keys):
        findings.append(
            Finding("error", "missing-key", str(target_path), "Key is missing from target bundle.", key)
        )

    for key in sorted(target_keys - source_keys):
        findings.append(
            Finding("warning", "extra-key", str(target_path), "Key does not exist in source bundle.", key)
        )

    for key in sorted(source_keys & target_keys):
        source_value = source[key]
        target_value = target[key]

        if not target_value.strip():
            findings.append(
                Finding("error", "empty-value", str(target_path), "Translation is empty.", key)
            )
            continue

        source_placeholders = extract_placeholders(source_value)
        target_placeholders = extract_placeholders(target_value)
        if source_placeholders != target_placeholders:
            missing = sorted(source_placeholders - target_placeholders)
            extra = sorted(target_placeholders - source_placeholders)
            details = []
            if missing:
                details.append(f"missing {missing}")
            if extra:
                details.append(f"unexpected {extra}")
            findings.append(
                Finding(
                    "error",
                    "placeholder-mismatch",
                    str(target_path),
                    "Placeholder mismatch: " + "; ".join(details) + ".",
                    key,
                )
            )

        source_plurals = extract_plural_arguments(source_value)
        target_plurals = extract_plural_arguments(target_value)
        if source_plurals and source_plurals == target_plurals and "other {" not in target_value:
            findings.append(
                Finding(
                    "error",
                    "missing-plural-other",
                    str(target_path),
                    "ICU plural message must include an other category.",
                    key,
                )
            )

        if target_value == source_value:
            findings.append(
                Finding(
                    "warning",
                    "identical-to-source",
                    str(target_path),
                    "Translation is identical to the English source value.",
                    key,
                )
            )

    return findings


def find_duplicate_source_values(source: dict[str, str], source_path: Path) -> list[Finding]:
    values: dict[str, list[str]] = defaultdict(list)
    for key, value in source.items():
        if value.strip():
            values[value].append(key)

    findings: list[Finding] = []
    for keys in values.values():
        if len(keys) > 1:
            findings.append(
                Finding(
                    "warning",
                    "duplicate-source-value",
                    str(source_path),
                    f"The same English value is used by keys: {', '.join(sorted(keys))}.",
                )
            )
    return findings


def lint_locale_directory(source_path: Path, locale_dir: Path) -> LintReport:
    report = LintReport(source_file=str(source_path))

    try:
        source = load_resource_bundle(source_path)
    except (ValueError, DuplicateKeyError) as error:
        report.findings.append(_bundle_load_finding(source_path, error))
        return report

    report.findings.extend(find_duplicate_source_values(source, source_path))

    target_paths = sorted(
        path for path in locale_dir.glob("*.json") if path.resolve() != source_path.resolve()
    )
    report.target_files = [str(path) for path in target_paths]

    if not target_paths:
        report.findings.append(
            Finding(
                "warning",
                "no-target-bundles",
                str(locale_dir),
                "No target locale JSON files were found.",
            )
        )
        return report

    for target_path in target_paths:
        if not LOCALE_FILENAME_PATTERN.fullmatch(target_path.name):
            report.findings.append(
                Finding(
                    "error",
                    "invalid-locale-filename",
                    str(target_path),
                    "Locale filename must use a supported BCP 47-style form such as ja-JP.json.",
                )
            )

        try:
            target = load_resource_bundle(target_path)
        except (ValueError, DuplicateKeyError) as error:
            report.findings.append(_bundle_load_finding(target_path, error))
            continue

        report.findings.extend(lint_bundle(source, target, target_path))

    return report


def report_as_markdown(report: LintReport) -> str:
    status = "PASS" if report.passed else "FAIL"
    lines = [
        "# Python Localization Resource Check",
        "",
        f"**Status:** {status}",
        "",
        f"- Source bundle: `{report.source_file}`",
        f"- Target bundles checked: {len(report.target_files)}",
        f"- Errors: {len(report.errors)}",
        f"- Warnings: {len(report.warnings)}",
        "",
    ]

    for heading, severity in (("Errors", "error"), ("Warnings", "warning")):
        findings = [finding for finding in report.findings if finding.severity == severity]
        lines.extend([f"## {heading}", ""])
        if not findings:
            lines.append("None.")
        else:
            for finding in findings:
                lines.append(
                    f"- **{finding.code}** at `{finding.format_location()}`: {finding.message}"
                )
        lines.append("")

    return "\n".join(lines)


def report_as_json(report: LintReport) -> str:
    payload = {
        "status": "pass" if report.passed else "fail",
        "source_file": report.source_file,
        "target_files": report.target_files,
        "errors": len(report.errors),
        "warnings": len(report.warnings),
        "findings": [
            {
                "severity": finding.severity,
                "code": finding.code,
                "file": finding.file,
                "key": finding.key,
                "message": finding.message,
            }
            for finding in report.findings
        ],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
