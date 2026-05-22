from dataclasses import dataclass


@dataclass(frozen=True)
class WorkerHealth:
    service: str
    status: str
    version: str


def get_worker_health(version: str = "0.1.0") -> WorkerHealth:
    return WorkerHealth(service="worker", status="ok", version=version)
