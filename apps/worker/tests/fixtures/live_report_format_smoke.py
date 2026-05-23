"""Fixture used by live PR smoke tests for FirmcodeAI report rendering."""


def normalize_smoke_label(value: str) -> str:
    """Return a stable label for live report-format smoke checks."""
    return " ".join(value.strip().split()).lower()
