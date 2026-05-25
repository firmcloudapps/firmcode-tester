from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

import pytest

from firmcode_worker.review_queue import (
    CodebaseScanJobPayload,
    ReviewJobPayload,
    REVIEW_WORKER_LOCK_DURATION_MS,
    REVIEW_WORKER_LOCK_RENEW_TIME_MS,
    REVIEW_WORKER_STALLED_INTERVAL_MS,
    ReviewWorkerError,
    codebase_scan_job_payload_from_mapping,
    process_codebase_scan_job,
    process_codebase_scan_pipeline_job,
    process_review_pull_request_job,
    review_job_payload_from_mapping,
)


class RecordingReviewRunRepository:
    def __init__(self) -> None:
        self.events: list[tuple[str, str, str | None, str | None]] = []

    async def mark_running(self, review_run_id: str) -> None:
        self.events.append(("running", review_run_id, None, None))

    async def mark_succeeded(self, review_run_id: str) -> None:
        self.events.append(("succeeded", review_run_id, None, None))

    async def mark_failed(self, review_run_id: str, error_code: str, error_message: str) -> None:
        self.events.append(("failed", review_run_id, error_code, error_message))


@dataclass
class StubReviewPipeline:
    error: Exception | None = None
    payloads: list[ReviewJobPayload] = field(default_factory=list)

    async def run(self, payload: ReviewJobPayload) -> None:
        self.payloads.append(payload)
        if self.error is not None:
            raise self.error


class RecordingCodebaseScanRunRepository:
    def __init__(self) -> None:
        self.payloads: list[CodebaseScanJobPayload] = []

    async def create_queued_scan_for_scheduled_job(self, payload: CodebaseScanJobPayload) -> str:
        self.payloads.append(payload)
        return "scan-created"


@dataclass
class StubCodebaseScanPipeline:
    payloads: list[CodebaseScanJobPayload] = field(default_factory=list)

    async def run(self, payload: CodebaseScanJobPayload) -> None:
        self.payloads.append(payload)


def test_review_job_payload_from_mapping_validates_required_fields() -> None:
    payload = review_job_payload_from_mapping(
        {
            "schemaVersion": "review-job-input/v1",
            "deliveryId": "delivery-1",
            "reviewRunId": "run-1",
            "repositoryId": "repo-1",
            "pullRequestId": "pr-1",
            "pullRequestNumber": 7,
            "headSha": "abc123",
            "triggerEvent": "pull_request.opened",
        }
    )

    assert payload.review_run_id == "run-1"
    assert payload.pull_request_number == 7


def test_review_job_payload_rejects_missing_fields() -> None:
    with pytest.raises(ReviewWorkerError) as error:
        review_job_payload_from_mapping({"deliveryId": "delivery-1"})

    assert error.value.error_code == "invalid_job_payload"
    assert "reviewRunId" in str(error.value)


def test_codebase_scan_job_payload_accepts_nullable_scan_run_and_commit_sha() -> None:
    payload = codebase_scan_job_payload_from_mapping(
        {
            "schemaVersion": "codebase-scan-job-input/v1",
            "scanRunId": None,
            "repositoryId": "repo-1",
            "installationId": 101,
            "repositoryFullName": "acme/widgets",
            "defaultBranch": "main",
            "commitSha": None,
            "trigger": "scheduled",
            "correlationId": "correlation-1",
            "requestedByClerkUserId": None,
        }
    )

    assert payload.scan_run_id is None
    assert payload.commit_sha is None
    assert payload.correlation_id == "correlation-1"


def test_codebase_scan_job_payload_rejects_missing_correlation_id() -> None:
    with pytest.raises(ReviewWorkerError) as error:
        codebase_scan_job_payload_from_mapping(
            {
                "schemaVersion": "codebase-scan-job-input/v1",
                "scanRunId": "scan-1",
                "repositoryId": "repo-1",
                "installationId": 101,
                "repositoryFullName": "acme/widgets",
                "defaultBranch": "main",
                "commitSha": None,
                "trigger": "manual",
                "requestedByClerkUserId": "user-1",
            }
        )

    assert error.value.error_code == "invalid_job_payload"
    assert "correlationId" in str(error.value)


def test_review_worker_lifecycle_marks_run_succeeded() -> None:
    repository = RecordingReviewRunRepository()
    pipeline = StubReviewPipeline()
    payload = _payload()

    asyncio.run(process_review_pull_request_job(payload, repository, pipeline))

    assert pipeline.payloads == [payload]
    assert repository.events == [
        ("running", "run-1", None, None),
        ("succeeded", "run-1", None, None),
    ]


def test_review_worker_lifecycle_marks_run_failed_and_reraises() -> None:
    repository = RecordingReviewRunRepository()
    pipeline = StubReviewPipeline(error=ReviewWorkerError("transient_github_error", "GitHub timed out"))
    payload = _payload()

    with pytest.raises(ReviewWorkerError):
        asyncio.run(process_review_pull_request_job(payload, repository, pipeline))

    assert repository.events == [
        ("running", "run-1", None, None),
        ("failed", "run-1", "transient_github_error", "GitHub timed out"),
    ]


def test_codebase_scan_worker_creates_run_for_scheduled_job_template() -> None:
    repository = RecordingCodebaseScanRunRepository()

    scan_run_id = asyncio.run(process_codebase_scan_job(_codebase_scan_payload(scan_run_id=None), repository))

    assert scan_run_id == "scan-created"
    assert len(repository.payloads) == 1


def test_codebase_scan_worker_reuses_existing_scan_run_id() -> None:
    repository = RecordingCodebaseScanRunRepository()

    scan_run_id = asyncio.run(process_codebase_scan_job(_codebase_scan_payload(scan_run_id="scan-existing"), repository))

    assert scan_run_id == "scan-existing"
    assert repository.payloads == []


def test_codebase_scan_worker_rejects_null_scan_run_for_manual_job() -> None:
    repository = RecordingCodebaseScanRunRepository()
    payload = _codebase_scan_payload(scan_run_id=None, trigger="manual")

    with pytest.raises(ReviewWorkerError) as error:
        asyncio.run(process_codebase_scan_job(payload, repository))

    assert error.value.error_code == "invalid_job_payload"


def test_codebase_scan_pipeline_worker_creates_scheduled_run_then_processes_effective_payload() -> None:
    repository = RecordingCodebaseScanRunRepository()
    pipeline = StubCodebaseScanPipeline()

    scan_run_id = asyncio.run(
        process_codebase_scan_pipeline_job(
            _codebase_scan_payload(scan_run_id=None),
            repository,
            pipeline,
        )
    )

    assert scan_run_id == "scan-created"
    assert pipeline.payloads[0].scan_run_id == "scan-created"
    assert pipeline.payloads[0].repository_id == "repo-1"


def test_review_worker_lock_window_covers_long_publish_steps() -> None:
    assert REVIEW_WORKER_LOCK_DURATION_MS == 600_000
    assert REVIEW_WORKER_LOCK_RENEW_TIME_MS == 300_000
    assert REVIEW_WORKER_STALLED_INTERVAL_MS == 60_000


def _payload() -> ReviewJobPayload:
    return ReviewJobPayload(
        schema_version="review-job-input/v1",
        delivery_id="delivery-1",
        review_run_id="run-1",
        repository_id="repo-1",
        pull_request_id="pr-1",
        pull_request_number=7,
        head_sha="abc123",
        trigger_event="pull_request.opened",
    )


def _codebase_scan_payload(scan_run_id: str | None, trigger: str = "scheduled") -> CodebaseScanJobPayload:
    return CodebaseScanJobPayload(
        schema_version="codebase-scan-job-input/v1",
        scan_run_id=scan_run_id,
        repository_id="repo-1",
        installation_id=101,
        repository_full_name="acme/widgets",
        default_branch="main",
        commit_sha=None,
        trigger=trigger,
        correlation_id="correlation-1",
        requested_by_clerk_user_id=None,
    )
