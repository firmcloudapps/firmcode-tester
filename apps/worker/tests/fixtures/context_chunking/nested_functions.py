from typing import Iterable


def outer(values: Iterable[int]) -> list[int]:
    factor = 2

    def inner(value: int) -> int:
        normalized = value * factor
        return normalized + 1

    return [inner(value) for value in values]
