import os
from pathlib import Path


def normalize(value: str) -> str:
    return value.strip()


class Runner:
    def run(self, path: Path) -> str:
        return normalize(os.fspath(path))
