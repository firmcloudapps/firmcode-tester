FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV SEMGREP_STARTUP_TIMEOUT_SECONDS=30
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir semgrep tree-sitter

COPY apps/worker/pyproject.toml apps/worker/pyproject.toml
COPY apps/worker/firmcode_worker apps/worker/firmcode_worker

RUN pip install --no-cache-dir ./apps/worker

RUN useradd --create-home --shell /usr/sbin/nologin firmcode
USER firmcode

HEALTHCHECK --interval=30s --timeout=15s --start-period=20s --retries=3 \
  CMD python -m firmcode_worker.runtime --check

CMD ["python", "-m", "firmcode_worker.runtime"]
