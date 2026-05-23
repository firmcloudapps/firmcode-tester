from __future__ import annotations

import asyncio
import json
import os
import re
import time
from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Protocol


DEFAULT_LLM_TIMEOUT_MS = 30_000
DEFAULT_LLM_MAX_RETRIES = 2
DEFAULT_LLM_MAX_OUTPUT_TOKENS = 2_000
DEFAULT_LLM_TEMPERATURE = 0.2
DEFAULT_RETRY_BACKOFF_MS = 100
DEFAULT_RETRY_BACKOFF_MULTIPLIER = 2.0
MAX_LOG_PREVIEW_CHARS = 160
REDACTED = "[REDACTED]"

LLMEventLogger = Callable[[Mapping[str, Any]], None]
SleepFunc = Callable[[float], Awaitable[None]]


class LLMClientError(RuntimeError):
    pass


class LLMTimeoutError(LLMClientError):
    pass


class LLMProviderError(LLMClientError):
    def __init__(self, message: str, *, transient: bool = False, code: str | None = None) -> None:
        super().__init__(message)
        self.transient = transient
        self.code = code


class LLMInvalidJsonError(LLMClientError):
    def __init__(self, message: str, *, raw_content: str) -> None:
        super().__init__(message)
        self.raw_content = raw_content


@dataclass(frozen=True)
class LLMRetryConfig:
    max_retries: int = DEFAULT_LLM_MAX_RETRIES
    backoff_initial_ms: int = DEFAULT_RETRY_BACKOFF_MS
    backoff_multiplier: float = DEFAULT_RETRY_BACKOFF_MULTIPLIER

    def __post_init__(self) -> None:
        if self.max_retries < 0:
            raise ValueError("LLM retry count must be zero or greater.")
        if self.backoff_initial_ms < 0:
            raise ValueError("LLM retry backoff must be zero or greater.")
        if self.backoff_multiplier < 1:
            raise ValueError("LLM retry backoff multiplier must be at least 1.")


@dataclass(frozen=True)
class LLMRequestOptions:
    model: str
    temperature: float = DEFAULT_LLM_TEMPERATURE
    max_tokens: int = DEFAULT_LLM_MAX_OUTPUT_TOKENS
    timeout_ms: int = DEFAULT_LLM_TIMEOUT_MS
    retry_config: LLMRetryConfig = field(default_factory=LLMRetryConfig)

    def __post_init__(self) -> None:
        if not self.model.strip():
            raise ValueError("LLM model is required.")
        if self.temperature < 0 or self.temperature > 2:
            raise ValueError("LLM temperature must be between 0 and 2.")
        if self.max_tokens <= 0:
            raise ValueError("LLM max tokens must be positive.")
        if self.timeout_ms <= 0:
            raise ValueError("LLM timeout must be positive.")


@dataclass(frozen=True)
class LLMClientConfig:
    provider: str
    api_key: str
    review_model: str
    summary_model: str | None = None
    timeout_ms: int = DEFAULT_LLM_TIMEOUT_MS
    max_retries: int = DEFAULT_LLM_MAX_RETRIES
    max_input_tokens: int | None = None
    max_output_tokens: int = DEFAULT_LLM_MAX_OUTPUT_TOKENS
    temperature: float = DEFAULT_LLM_TEMPERATURE

    @classmethod
    def from_env(cls, env: Mapping[str, str] = os.environ) -> "LLMClientConfig":
        return cls(
            provider=_read_required(env, "LLM_PROVIDER"),
            api_key=_read_required(env, "LLM_API_KEY"),
            review_model=_read_required(env, "LLM_REVIEW_MODEL"),
            summary_model=_read_optional(env, "LLM_SUMMARY_MODEL"),
            timeout_ms=_read_positive_int(env.get("LLM_TIMEOUT_MS"), DEFAULT_LLM_TIMEOUT_MS),
            max_retries=_read_non_negative_int(env.get("LLM_MAX_RETRIES"), DEFAULT_LLM_MAX_RETRIES),
            max_input_tokens=_read_optional_positive_int(env.get("LLM_MAX_INPUT_TOKENS")),
            max_output_tokens=_read_positive_int(env.get("LLM_MAX_OUTPUT_TOKENS"), DEFAULT_LLM_MAX_OUTPUT_TOKENS),
            temperature=_read_float(env.get("LLM_TEMPERATURE"), DEFAULT_LLM_TEMPERATURE),
        )

    def review_options(self) -> LLMRequestOptions:
        return LLMRequestOptions(
            model=self.review_model,
            temperature=self.temperature,
            max_tokens=self.max_output_tokens,
            timeout_ms=self.timeout_ms,
            retry_config=LLMRetryConfig(max_retries=self.max_retries),
        )


@dataclass(frozen=True)
class LLMMessage:
    role: str
    content: str

    def __post_init__(self) -> None:
        if self.role not in {"system", "user", "assistant"}:
            raise ValueError("LLM message role must be system, user, or assistant.")
        if not isinstance(self.content, str):
            raise ValueError("LLM message content must be a string.")


@dataclass(frozen=True)
class LLMTokenUsage:
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0

    def __post_init__(self) -> None:
        if self.input_tokens < 0 or self.output_tokens < 0 or self.total_tokens < 0:
            raise ValueError("LLM token usage cannot be negative.")

    @classmethod
    def from_counts(cls, *, input_tokens: int = 0, output_tokens: int = 0, total_tokens: int | None = None) -> "LLMTokenUsage":
        return cls(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens if total_tokens is not None else input_tokens + output_tokens,
        )


@dataclass(frozen=True)
class LLMCostEstimate:
    model: str
    amount_usd: Decimal | None


@dataclass(frozen=True)
class LLMProviderResponse:
    content: str
    usage: LLMTokenUsage = field(default_factory=LLMTokenUsage)
    model: str | None = None
    finish_reason: str | None = None


@dataclass(frozen=True)
class LLMStructuredResponse:
    content: Mapping[str, Any]
    raw_content: str
    model: str
    usage: LLMTokenUsage
    latency_ms: int
    attempts: int
    finish_reason: str | None = None


class LLMProvider(Protocol):
    async def complete_structured(
        self,
        *,
        messages: Sequence[LLMMessage],
        schema: Mapping[str, Any],
        options: LLMRequestOptions,
    ) -> LLMProviderResponse:
        ...


class LLMClient(Protocol):
    async def complete_structured(
        self,
        prompt: str | Sequence[LLMMessage],
        schema: Mapping[str, Any],
        options: LLMRequestOptions,
    ) -> LLMStructuredResponse:
        ...

    async def repair_structured_output(
        self,
        raw: str,
        schema: Mapping[str, Any],
        options: LLMRequestOptions,
    ) -> LLMStructuredResponse:
        ...

    def estimate_cost(self, usage: LLMTokenUsage, *, model: str) -> LLMCostEstimate:
        ...


class RetryingLLMClient:
    def __init__(
        self,
        *,
        provider: LLMProvider,
        provider_name: str,
        api_key: str | None = None,
        event_logger: LLMEventLogger | None = None,
        sleep: SleepFunc = asyncio.sleep,
    ) -> None:
        self._provider = provider
        self._provider_name = provider_name
        self._api_key = api_key
        self._event_logger = event_logger or _default_event_logger
        self._sleep = sleep

    async def complete_structured(
        self,
        prompt: str | Sequence[LLMMessage],
        schema: Mapping[str, Any],
        options: LLMRequestOptions,
    ) -> LLMStructuredResponse:
        messages = _coerce_messages(prompt)
        return await self._request_structured(
            operation="complete_structured",
            messages=messages,
            schema=schema,
            options=options,
        )

    async def repair_structured_output(
        self,
        raw: str,
        schema: Mapping[str, Any],
        options: LLMRequestOptions,
    ) -> LLMStructuredResponse:
        messages = (
            LLMMessage(
                role="system",
                content="Repair the supplied model output so it is valid JSON matching the requested schema. Return only JSON.",
            ),
            LLMMessage(role="user", content=raw),
        )
        return await self._request_structured(
            operation="repair_structured_output",
            messages=messages,
            schema=schema,
            options=options,
        )

    def estimate_cost(self, usage: LLMTokenUsage, *, model: str) -> LLMCostEstimate:
        _ = usage
        return LLMCostEstimate(model=model, amount_usd=None)

    async def _request_structured(
        self,
        *,
        operation: str,
        messages: Sequence[LLMMessage],
        schema: Mapping[str, Any],
        options: LLMRequestOptions,
    ) -> LLMStructuredResponse:
        started = time.monotonic_ns()
        attempt = 0
        last_error: LLMClientError | None = None

        while attempt <= options.retry_config.max_retries:
            attempt += 1
            self._log_request_started(operation=operation, messages=messages, schema=schema, options=options, attempt=attempt)

            try:
                provider_response = await asyncio.wait_for(
                    self._provider.complete_structured(messages=messages, schema=schema, options=options),
                    timeout=options.timeout_ms / 1000,
                )
                try:
                    parsed = _parse_structured_content(provider_response.content)
                except json.JSONDecodeError as error:
                    raise LLMInvalidJsonError(
                        f"LLM response was not valid JSON: {error.msg}.",
                        raw_content=provider_response.content,
                    ) from error
                except ValueError as error:
                    raise LLMInvalidJsonError(str(error), raw_content=provider_response.content) from error
                latency_ms = _elapsed_ms(started)
                self._event_logger(
                    {
                        "event": "llm.request.completed",
                        "provider": self._provider_name,
                        "operation": operation,
                        "model": provider_response.model or options.model,
                        "attempt": attempt,
                        "latencyMs": latency_ms,
                        "usage": _usage_to_dict(provider_response.usage),
                        "finishReason": provider_response.finish_reason,
                    }
                )
                return LLMStructuredResponse(
                    content=parsed,
                    raw_content=provider_response.content,
                    model=provider_response.model or options.model,
                    usage=provider_response.usage,
                    latency_ms=latency_ms,
                    attempts=attempt,
                    finish_reason=provider_response.finish_reason,
                )
            except asyncio.TimeoutError:
                last_error = LLMTimeoutError(f"LLM request timed out after {options.timeout_ms} ms.")
            except LLMProviderError as error:
                last_error = error
            except ValueError as error:
                raise LLMClientError(str(error)) from error

            should_retry = _is_retryable(last_error) and attempt <= options.retry_config.max_retries
            self._event_logger(
                {
                    "event": "llm.request.failed",
                    "provider": self._provider_name,
                    "operation": operation,
                    "model": options.model,
                    "attempt": attempt,
                    "retrying": should_retry,
                    "errorCode": getattr(last_error, "code", None) or last_error.__class__.__name__,
                    "error": _redact_text(str(last_error), sensitive_values=self._sensitive_values()),
                }
            )

            if not should_retry:
                raise last_error

            await self._sleep(_retry_delay_seconds(options.retry_config, attempt))

        raise last_error or LLMClientError("LLM request failed.")

    def _log_request_started(
        self,
        *,
        operation: str,
        messages: Sequence[LLMMessage],
        schema: Mapping[str, Any],
        options: LLMRequestOptions,
        attempt: int,
    ) -> None:
        self._event_logger(
            {
                "event": "llm.request.started",
                "provider": self._provider_name,
                "operation": operation,
                "model": options.model,
                "temperature": options.temperature,
                "maxTokens": options.max_tokens,
                "timeoutMs": options.timeout_ms,
                "attempt": attempt,
                "prompt": _redacted_prompt_preview(messages, self._sensitive_values()),
                "schemaKeys": sorted(str(key) for key in schema.keys()),
            }
        )

    def _sensitive_values(self) -> tuple[str, ...]:
        return (self._api_key,) if self._api_key else ()


class FakeLLMClient:
    def __init__(
        self,
        responses: Sequence[Mapping[str, Any] | LLMStructuredResponse] | None = None,
        *,
        usage: LLMTokenUsage | None = None,
        latency_ms: int = 0,
    ) -> None:
        self._responses = list(responses or [])
        self._usage = usage or LLMTokenUsage()
        self._latency_ms = latency_ms
        self.requests: list[tuple[tuple[LLMMessage, ...], Mapping[str, Any], LLMRequestOptions]] = []

    async def complete_structured(
        self,
        prompt: str | Sequence[LLMMessage],
        schema: Mapping[str, Any],
        options: LLMRequestOptions,
    ) -> LLMStructuredResponse:
        messages = tuple(_coerce_messages(prompt))
        self.requests.append((messages, schema, options))

        if not self._responses:
            raise LLMProviderError("Fake LLM response queue is empty.", transient=False, code="fake_response_missing")

        response = self._responses.pop(0)
        if isinstance(response, LLMStructuredResponse):
            return response

        raw_content = json.dumps(response, sort_keys=True)
        return LLMStructuredResponse(
            content=response,
            raw_content=raw_content,
            model=options.model,
            usage=self._usage,
            latency_ms=self._latency_ms,
            attempts=1,
            finish_reason="stop",
        )

    async def repair_structured_output(
        self,
        raw: str,
        schema: Mapping[str, Any],
        options: LLMRequestOptions,
    ) -> LLMStructuredResponse:
        return await self.complete_structured(
            (
                LLMMessage(role="system", content="Repair the supplied model output as JSON."),
                LLMMessage(role="user", content=raw),
            ),
            schema,
            options,
        )

    def estimate_cost(self, usage: LLMTokenUsage, *, model: str) -> LLMCostEstimate:
        _ = usage
        return LLMCostEstimate(model=model, amount_usd=Decimal("0"))


def _coerce_messages(prompt: str | Sequence[LLMMessage]) -> tuple[LLMMessage, ...]:
    if isinstance(prompt, str):
        return (LLMMessage(role="user", content=prompt),)
    return tuple(prompt)


def _parse_structured_content(content: str) -> Mapping[str, Any]:
    parsed = json.loads(content)
    if not isinstance(parsed, Mapping):
        raise ValueError("LLM structured response must be a JSON object.")
    return parsed


def _redacted_prompt_preview(messages: Sequence[LLMMessage], sensitive_values: Sequence[str]) -> list[dict[str, str]]:
    return [
        {
            "role": message.role,
            "contentPreview": _redact_text(_truncate(message.content, MAX_LOG_PREVIEW_CHARS), sensitive_values=sensitive_values),
        }
        for message in messages
    ]


def _redact_text(text: str, *, sensitive_values: Sequence[str]) -> str:
    redacted = text
    for value in sensitive_values:
        if value:
            redacted = redacted.replace(value, REDACTED)

    redacted = re.sub(r"\b(?:sk|ghp|glpat|xoxb)-[A-Za-z0-9_\-]{8,}\b", REDACTED, redacted)
    redacted = re.sub(r"\bgithub_pat_[A-Za-z0-9_]{8,}\b", REDACTED, redacted)
    redacted = re.sub(
        r"(?i)\b(api[_-]?key|authorization|bearer|client[_-]?secret|password|secret|token)\b\s*[:=]\s*([^\s,;]+)",
        lambda match: f"{match.group(1)}={REDACTED}",
        redacted,
    )
    return redacted


def _truncate(value: str, max_chars: int) -> str:
    if len(value) <= max_chars:
        return value
    return value[: max_chars - 3] + "..."


def _is_retryable(error: LLMClientError) -> bool:
    if isinstance(error, LLMTimeoutError):
        return True
    if isinstance(error, LLMProviderError):
        return error.transient
    return False


def _retry_delay_seconds(config: LLMRetryConfig, attempt: int) -> float:
    return (config.backoff_initial_ms / 1000) * (config.backoff_multiplier ** max(attempt - 1, 0))


def _usage_to_dict(usage: LLMTokenUsage) -> dict[str, int]:
    return {
        "inputTokens": usage.input_tokens,
        "outputTokens": usage.output_tokens,
        "totalTokens": usage.total_tokens,
    }


def _default_event_logger(event: Mapping[str, Any]) -> None:
    print(json.dumps(event, sort_keys=True), flush=True)


def _read_required(env: Mapping[str, str], name: str) -> str:
    value = env.get(name, "").strip()
    if not value:
        raise ValueError(f"{name} is required")
    return value


def _read_optional(env: Mapping[str, str], name: str) -> str | None:
    value = env.get(name, "").strip()
    return value or None


def _read_positive_int(value: str | None, default: int) -> int:
    raw_value = (value or "").strip()
    if not raw_value:
        return default
    try:
        parsed = int(raw_value)
    except ValueError as error:
        raise ValueError("LLM integer configuration values must be valid integers.") from error
    if parsed <= 0:
        raise ValueError("LLM integer configuration values must be positive.")
    return parsed


def _read_optional_positive_int(value: str | None) -> int | None:
    raw_value = (value or "").strip()
    if not raw_value:
        return None
    return _read_positive_int(raw_value, 1)


def _read_non_negative_int(value: str | None, default: int) -> int:
    raw_value = (value or "").strip()
    if not raw_value:
        return default
    try:
        parsed = int(raw_value)
    except ValueError as error:
        raise ValueError("LLM retry configuration must be a valid integer.") from error
    if parsed < 0:
        raise ValueError("LLM retry configuration must be zero or greater.")
    return parsed


def _read_float(value: str | None, default: float) -> float:
    raw_value = (value or "").strip()
    if not raw_value:
        return default
    try:
        return float(raw_value)
    except ValueError as error:
        raise ValueError("LLM temperature must be a valid number.") from error


def _elapsed_ms(started_monotonic_ns: int) -> int:
    return max(round((time.monotonic_ns() - started_monotonic_ns) / 1_000_000), 0)
