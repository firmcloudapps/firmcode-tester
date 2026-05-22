from __future__ import annotations

import asyncio
import signal
from typing import Any, Mapping, Protocol

from firmcode_worker.schemas.contracts import ContractValidationError, ReviewJobInput


REVIEW_QUEUE_NAME = "review-runs"
REVIEW_PULL_REQUEST_JOB_NAME = "review.pull_request"


ReviewJobPayload = ReviewJobInput


class ReviewRunRepository(Protocol):
    async def mark_running(self, review_run_id: str) -> None:
        ...

    async def mark_succeeded(self, review_run_id: str) -> None:
        ...

    async def mark_failed(self, review_run_id: str, error_code: str, error_message: str) -> None:
        ...


class ReviewPipeline(Protocol):
    async def run(self, payload: ReviewJobPayload) -> None:
        ...


class ReviewWorkerError(Exception):
    def __init__(self, error_code: str, message: str) -> None:
        super().__init__(message)
        self.error_code = error_code


class NoopReviewPipeline:
    async def run(self, payload: ReviewJobPayload) -> None:
        return None


class PostgresReviewRunRepository:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    async def mark_running(self, review_run_id: str) -> None:
        await self._update_status(
            """
UPDATE review_runs
SET status = 'running',
    started_at = COALESCE(started_at, now()),
    error_code = NULL,
    error_message = NULL,
    updated_at = now()
WHERE id = %s
""",
            (review_run_id,),
        )

    async def mark_succeeded(self, review_run_id: str) -> None:
        await self._update_status(
            """
UPDATE review_runs
SET status = 'succeeded',
    finished_at = COALESCE(finished_at, now()),
    error_code = NULL,
    error_message = NULL,
    updated_at = now()
WHERE id = %s
""",
            (review_run_id,),
        )

    async def mark_failed(self, review_run_id: str, error_code: str, error_message: str) -> None:
        await self._update_status(
            """
UPDATE review_runs
SET status = 'failed',
    finished_at = COALESCE(finished_at, now()),
    error_code = %s,
    error_message = %s,
    updated_at = now()
WHERE id = %s
""",
            (error_code, error_message, review_run_id),
        )

    async def _update_status(self, sql: str, params: tuple[Any, ...]) -> None:
        import psycopg

        async with await psycopg.AsyncConnection.connect(self.database_url) as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(sql, params)


async def process_review_pull_request_job(
    payload: ReviewJobPayload,
    repository: ReviewRunRepository,
    pipeline: ReviewPipeline,
) -> None:
    await repository.mark_running(payload.review_run_id)

    try:
        await pipeline.run(payload)
    except Exception as error:
        error_code = error.error_code if isinstance(error, ReviewWorkerError) else "review_worker_error"
        await repository.mark_failed(payload.review_run_id, error_code, _error_message(error))
        raise

    await repository.mark_succeeded(payload.review_run_id)


async def run_bullmq_review_worker(
    *,
    database_url: str,
    redis_url: str,
    queue_name: str = REVIEW_QUEUE_NAME,
    pipeline: ReviewPipeline | None = None,
) -> None:
    from bullmq import Worker

    repository = PostgresReviewRunRepository(database_url)
    review_pipeline = pipeline or NoopReviewPipeline()
    shutdown_event = asyncio.Event()

    def request_shutdown(_signum: int, _frame: object) -> None:
        shutdown_event.set()

    signal.signal(signal.SIGTERM, request_shutdown)
    signal.signal(signal.SIGINT, request_shutdown)

    async def process(job: Any, _job_token: str) -> None:
        if job.name != REVIEW_PULL_REQUEST_JOB_NAME:
            raise ReviewWorkerError("unsupported_job_name", f"Unsupported review job name: {job.name}")

        await process_review_pull_request_job(
            payload=review_job_payload_from_mapping(job.data),
            repository=repository,
            pipeline=review_pipeline,
        )

    worker = Worker(queue_name, process, {"connection": redis_url})

    try:
        await shutdown_event.wait()
    finally:
        await worker.close()


def review_job_payload_from_mapping(value: Mapping[str, Any]) -> ReviewJobPayload:
    try:
        return ReviewJobInput.from_mapping(value)
    except ContractValidationError as error:
        raise ReviewWorkerError("invalid_job_payload", str(error)) from error


def _error_message(error: Exception) -> str:
    message = str(error).strip()
    if message:
        return message[:1000]
    return error.__class__.__name__
