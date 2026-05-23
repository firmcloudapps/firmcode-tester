import subprocess

from firmcode_worker.runtime import _check_semgrep, load_worker_config, run_startup_checks


def test_worker_config_requires_database_and_redis_urls() -> None:
    config = load_worker_config(
        {
            "DATABASE_URL": "postgresql://firmcode:firmcode@ep-example.us-east-2.aws.neon.tech:5432/firmcode",
            "REDIS_URL": "redis://redis:6379",
        }
    )

    assert config.database_url.startswith("postgresql://")
    assert config.redis_url == "redis://redis:6379"
    assert config.queue_name == "review-runs"
    assert config.semgrep_executable == "semgrep"
    assert config.semgrep_startup_timeout_seconds == 20.0
    assert config.semgrep_startup_version_check is False


def test_worker_config_rejects_invalid_redis_url() -> None:
    try:
        load_worker_config(
            {
                "DATABASE_URL": "postgresql://firmcode:firmcode@ep-example.us-east-2.aws.neon.tech:5432/firmcode",
                "REDIS_URL": "http://redis:6379",
            }
        )
    except ValueError as error:
        assert "REDIS_URL" in str(error)
    else:
        raise AssertionError("Expected invalid Redis URL to fail")


def test_worker_config_reads_semgrep_startup_overrides() -> None:
    config = load_worker_config(
        {
            "DATABASE_URL": "postgresql://firmcode:firmcode@ep-example.us-east-2.aws.neon.tech:5432/firmcode",
            "REDIS_URL": "redis://redis:6379",
            "SEMGREP_EXECUTABLE": "/usr/local/bin/semgrep",
            "SEMGREP_STARTUP_TIMEOUT_SECONDS": "45",
            "SEMGREP_STARTUP_VERSION_CHECK": "true",
        }
    )

    assert config.semgrep_executable == "/usr/local/bin/semgrep"
    assert config.semgrep_startup_timeout_seconds == 45.0
    assert config.semgrep_startup_version_check is True


def test_worker_config_rejects_invalid_semgrep_startup_timeout() -> None:
    try:
        load_worker_config(
            {
                "DATABASE_URL": "postgresql://firmcode:firmcode@ep-example.us-east-2.aws.neon.tech:5432/firmcode",
                "REDIS_URL": "redis://redis:6379",
                "SEMGREP_STARTUP_TIMEOUT_SECONDS": "0",
            }
        )
    except ValueError as error:
        assert "SEMGREP_STARTUP_TIMEOUT_SECONDS" in str(error)
    else:
        raise AssertionError("Expected invalid Semgrep startup timeout to fail")


def test_worker_config_rejects_invalid_semgrep_startup_version_check() -> None:
    try:
        load_worker_config(
            {
                "DATABASE_URL": "postgresql://firmcode:firmcode@ep-example.us-east-2.aws.neon.tech:5432/firmcode",
                "REDIS_URL": "redis://redis:6379",
                "SEMGREP_STARTUP_VERSION_CHECK": "maybe",
            }
        )
    except ValueError as error:
        assert "SEMGREP_STARTUP_VERSION_CHECK" in str(error)
    else:
        raise AssertionError("Expected invalid Semgrep startup version check to fail")


def test_semgrep_startup_version_timeout_does_not_block_worker(monkeypatch) -> None:
    config = load_worker_config(
        {
            "DATABASE_URL": "postgresql://firmcode:firmcode@ep-example.us-east-2.aws.neon.tech:5432/firmcode",
            "REDIS_URL": "redis://redis:6379",
            "SEMGREP_STARTUP_VERSION_CHECK": "true",
        }
    )

    monkeypatch.setattr("firmcode_worker.runtime.shutil.which", lambda executable: "/usr/local/bin/semgrep")

    def raise_timeout(*_args, **_kwargs):
        raise subprocess.TimeoutExpired(cmd=["semgrep", "--version"], timeout=1)

    monkeypatch.setattr("firmcode_worker.runtime.subprocess.run", raise_timeout)

    check = _check_semgrep(config)

    assert check.status == "ok"
    assert check.error == "version_check_timeout"


def test_worker_startup_checks_report_unavailable_dependencies() -> None:
    config = load_worker_config(
        {
            "DATABASE_URL": "postgresql://firmcode:firmcode@127.0.0.1:1/firmcode",
            "REDIS_URL": "redis://127.0.0.1:1",
        }
    )

    checks = run_startup_checks(config)
    names = {check.name for check in checks}

    assert {"database", "redis", "semgrep", "tree_sitter"}.issubset(names)
