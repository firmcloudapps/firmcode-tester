from firmcode_worker.runtime import load_worker_config, run_startup_checks


def test_worker_config_requires_database_and_redis_urls() -> None:
    config = load_worker_config(
        {
            "DATABASE_URL": "postgresql://firmcode:firmcode@ep-example.us-east-2.aws.neon.tech:5432/firmcode",
            "REDIS_URL": "redis://redis:6379",
        }
    )

    assert config.database_url.startswith("postgresql://")
    assert config.redis_url == "redis://redis:6379"


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
