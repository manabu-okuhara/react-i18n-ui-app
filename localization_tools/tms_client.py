"""Small, testable HTTP client for TMS automation exercises."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Callable, Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
DEFAULT_MAX_RETRIES = 3


class TmsClientError(RuntimeError):
    """Base error for TMS client failures."""


class TmsAuthenticationError(TmsClientError):
    """Raised for authentication or authorization failures."""


class TmsRetryExhaustedError(TmsClientError):
    """Raised after all retryable requests fail."""


class ResponseLike(Protocol):
    status: int

    def read(self) -> bytes: ...
    def __enter__(self) -> "ResponseLike": ...
    def __exit__(self, *args: object) -> None: ...


@dataclass(frozen=True)
class TmsResponse:
    status: int
    payload: dict[str, object]


class TmsClient:
    def __init__(
        self,
        base_url: str,
        api_token: str,
        *,
        max_retries: int = DEFAULT_MAX_RETRIES,
        opener: Callable[..., ResponseLike] = urlopen,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        if not api_token.strip():
            raise ValueError("TMS_API_TOKEN is required.")
        if max_retries < 0:
            raise ValueError("max_retries must be zero or greater.")

        self.base_url = base_url.rstrip("/")
        self.api_token = api_token
        self.max_retries = max_retries
        self._opener = opener
        self._sleep = sleep

    def request_json(
        self,
        method: str,
        path: str,
        payload: dict[str, object] | None = None,
    ) -> TmsResponse:
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = Request(
            f"{self.base_url}/{path.lstrip('/')}",
            data=body,
            method=method,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_token}",
            },
        )

        for attempt in range(self.max_retries + 1):
            try:
                with self._opener(request, timeout=30) as response:
                    raw = response.read()
                    parsed = json.loads(raw.decode("utf-8")) if raw else {}
                    if not isinstance(parsed, dict):
                        raise TmsClientError("TMS response must be a JSON object.")
                    return TmsResponse(status=response.status, payload=parsed)
            except HTTPError as error:
                if error.code in {401, 403}:
                    raise TmsAuthenticationError(
                        f"TMS authentication failed with status {error.code}."
                    ) from error

                if error.code not in RETRYABLE_STATUS_CODES:
                    raise TmsClientError(f"TMS request failed with status {error.code}.") from error

                if attempt >= self.max_retries:
                    raise TmsRetryExhaustedError(
                        f"TMS request still failed with status {error.code} after "
                        f"{self.max_retries + 1} attempts."
                    ) from error
            except URLError as error:
                if attempt >= self.max_retries:
                    raise TmsRetryExhaustedError(
                        f"TMS request failed after {self.max_retries + 1} attempts."
                    ) from error

            self._sleep(2**attempt)

        raise AssertionError("Retry loop ended unexpectedly.")
