import io
import json
from urllib.error import HTTPError

import pytest

from localization_tools.tms_client import (
    TmsAuthenticationError,
    TmsClient,
    TmsRetryExhaustedError,
)


class FakeResponse:
    def __init__(self, payload: dict[str, object], status: int = 200) -> None:
        self.status = status
        self._body = json.dumps(payload).encode("utf-8")

    def read(self) -> bytes:
        return self._body

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *args: object) -> None:
        return None


class SequenceOpener:
    def __init__(self, outcomes: list[object]) -> None:
        self.outcomes = outcomes
        self.calls = 0

    def __call__(self, request: object, timeout: int) -> FakeResponse:
        outcome = self.outcomes[self.calls]
        self.calls += 1
        if isinstance(outcome, Exception):
            raise outcome
        assert isinstance(outcome, FakeResponse)
        return outcome


def http_error(status: int) -> HTTPError:
    return HTTPError(
        url="https://tms.example.test/projects",
        code=status,
        msg="test error",
        hdrs=None,
        fp=io.BytesIO(b"{}"),
    )


def test_missing_token_fails_fast() -> None:
    with pytest.raises(ValueError, match="TMS_API_TOKEN"):
        TmsClient("https://tms.example.test", "")


def test_successful_json_request() -> None:
    opener = SequenceOpener([FakeResponse({"status": "ok"})])
    client = TmsClient("https://tms.example.test", "token", opener=opener)

    response = client.request_json("GET", "/projects")

    assert response.status == 200
    assert response.payload == {"status": "ok"}
    assert opener.calls == 1


def test_authentication_error_is_not_retried() -> None:
    opener = SequenceOpener([http_error(401)])
    client = TmsClient("https://tms.example.test", "token", opener=opener)

    with pytest.raises(TmsAuthenticationError):
        client.request_json("GET", "/projects")

    assert opener.calls == 1


def test_rate_limit_is_retried_then_succeeds() -> None:
    opener = SequenceOpener([http_error(429), FakeResponse({"status": "ok"})])
    sleeps: list[float] = []
    client = TmsClient(
        "https://tms.example.test", "token", opener=opener, sleep=sleeps.append
    )

    response = client.request_json("POST", "/files", {"name": "messages.json"})

    assert response.payload == {"status": "ok"}
    assert opener.calls == 2
    assert sleeps == [1]


def test_server_error_exhausts_retries() -> None:
    opener = SequenceOpener([http_error(503), http_error(503), http_error(503)])
    sleeps: list[float] = []
    client = TmsClient(
        "https://tms.example.test",
        "token",
        max_retries=2,
        opener=opener,
        sleep=sleeps.append,
    )

    with pytest.raises(TmsRetryExhaustedError, match="3 attempts"):
        client.request_json("GET", "/projects")

    assert opener.calls == 3
    assert sleeps == [1, 2]
