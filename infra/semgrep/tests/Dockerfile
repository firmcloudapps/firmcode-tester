FROM node:22-alpine AS unsafe
# ruleid: firmcode.infra.dockerfile.root-user
USER root

FROM node:22-alpine AS safe
RUN addgroup -S app && adduser -S app -G app
# ok: firmcode.infra.dockerfile.root-user
USER app
