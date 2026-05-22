from firmcode_worker import get_worker_health


def test_worker_health_payload() -> None:
    assert get_worker_health().__dict__ == {
        "service": "worker",
        "status": "ok",
        "version": "0.1.0",
    }
