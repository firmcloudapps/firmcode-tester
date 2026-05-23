from __future__ import annotations

import asyncio
import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

import pytest

from firmcode_worker.llm import (
    FakeLLMClient,
    LLMClientConfig,
    LLMMessage,
    LLMProviderError,
    LLMProviderResponse,
    LLMRequestOptions,
    LLMRetryConfig,
    LLMTimeoutError,
    LLMTokenUsage,
    RetryingLLMClient,
)


SCHEMA = {"type": "object", "required": ["summary"]}


@dataclass
class ScriptedProvider:
    outcomes: list[LLMProviderResponse | Exception]
    calls: list[tuple[tuple[LLMMessage, ...], Mapping[str, Any], LLMRequestOptions]] = field(default_factory=list)

    async def complete_structured(
        self,
        *,
        messages: Sequence[LLMMessage],
        schema: Mapping[str, Any],
        options: LLMRequestOptions,
    ) -> LLMProviderResponse:
        self.calls.append((tuple(messages), schema, options))
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


class SleepingProvider:
    async def complete_structured(
        self,
        *,
        messages: Sequence[LLMMessage],
        schema: Mapping[str, Any],
        options: LLMRequestOptions,
    ) -> LLMProviderResponse:
        _ = (messages, schema, options)
        await asyncio.sleep(0.05)
        return LLMProviderResponse(content=json.dumps({"summary": "too late"}))


def test_fake_llm_client_returns_structured_response_and_records_request() -> None:
    client = FakeLLMClient(
        [{"summary": "Looks good", "riskLevel": "low"}],
        usage=LLMTokenUsage.from_counts(input_tokens=11, output_tokens=7),
    )
    options = LLMRequestOptions(model="fake-review-model")

    response = asyncio.run(client.complete_structured("review this", SCHEMA, options))

    assert response.content["summary"] == "Looks good"
    assert response.model == "fake-review-model"
    assert response.usage.total_tokens == 18
    assert client.requests[0][0][0].content == "review this"


def test_retrying_llm_client_retries_transient_provider_errors_and_captures_metrics() -> None:
    provider = ScriptedProvider(
        [
            LLMProviderError("rate limited", transient=True, code="rate_limit"),
            LLMProviderResponse(
                content=json.dumps({"summary": "retry worked"}),
                usage=LLMTokenUsage.from_counts(input_tokens=20, output_tokens=5),
                model="provider-model",
                finish_reason="stop",
            ),
        ]
    )
    events: list[Mapping[str, Any]] = []
    sleeps: list[float] = []

    async def record_sleep(delay: float) -> None:
        sleeps.append(delay)

    client = RetryingLLMClient(
        provider=provider,
        provider_name="example",
        event_logger=events.append,
        sleep=record_sleep,
    )
    options = LLMRequestOptions(
        model="review-model",
        retry_config=LLMRetryConfig(max_retries=1, backoff_initial_ms=25),
    )

    response = asyncio.run(client.complete_structured("review", SCHEMA, options))

    assert response.content["summary"] == "retry worked"
    assert response.model == "provider-model"
    assert response.usage.total_tokens == 25
    assert response.attempts == 2
    assert len(provider.calls) == 2
    assert sleeps == [0.025]
    assert [event["event"] for event in events] == [
        "llm.request.started",
        "llm.request.failed",
        "llm.request.started",
        "llm.request.completed",
    ]
    assert events[-1]["latencyMs"] >= 0
    assert events[-1]["usage"]["inputTokens"] == 20


def test_retrying_llm_client_times_out_provider_calls() -> None:
    client = RetryingLLMClient(
        provider=SleepingProvider(),
        provider_name="slow",
        event_logger=lambda _event: None,
    )
    options = LLMRequestOptions(
        model="review-model",
        timeout_ms=1,
        retry_config=LLMRetryConfig(max_retries=0),
    )

    with pytest.raises(LLMTimeoutError):
        asyncio.run(client.complete_structured("review", SCHEMA, options))


def test_retrying_llm_client_redacts_secrets_from_request_logs() -> None:
    provider = ScriptedProvider([LLMProviderResponse(content=json.dumps({"summary": "ok"}))])
    events: list[Mapping[str, Any]] = []
    client = RetryingLLMClient(
        provider=provider,
        provider_name="example",
        api_key="sk-secret-api-key",
        event_logger=events.append,
    )

    asyncio.run(
        client.complete_structured(
            "token=github_pat_1234567890 and api_key=sk-secret-api-key",
            SCHEMA,
            LLMRequestOptions(model="review-model"),
        )
    )

    started_event = events[0]
    serialized_event = json.dumps(started_event, sort_keys=True)

    assert "sk-secret-api-key" not in serialized_event
    assert "github_pat_1234567890" not in serialized_event
    assert "[REDACTED]" in serialized_event


def test_llm_client_config_reads_strategy_environment() -> None:
    config = LLMClientConfig.from_env(
        {
            "LLM_PROVIDER": "example",
            "LLM_API_KEY": "secret",
            "LLM_REVIEW_MODEL": "review-model",
            "LLM_SUMMARY_MODEL": "summary-model",
            "LLM_TIMEOUT_MS": "1234",
            "LLM_MAX_RETRIES": "3",
            "LLM_MAX_INPUT_TOKENS": "50000",
            "LLM_MAX_OUTPUT_TOKENS": "4000",
        }
    )

    options = config.review_options()

    assert config.provider == "example"
    assert config.summary_model == "summary-model"
    assert config.max_input_tokens == 50000
    assert options.model == "review-model"
    assert options.timeout_ms == 1234
    assert options.max_tokens == 4000
    assert options.retry_config.max_retries == 3
