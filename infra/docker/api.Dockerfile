FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/prompts/package.json packages/prompts/package.json

RUN npm ci --include=dev \
  --workspace @firmcode/api \
  --workspace @firmcode/shared \
  --workspace @firmcode/prompts \
  --include-workspace-root=false

FROM deps AS build

COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/shared packages/shared
COPY packages/prompts packages/prompts

RUN npm run build --workspace @firmcode/shared \
  && npm run build --workspace @firmcode/api

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/prompts/package.json packages/prompts/package.json
RUN npm ci --omit=dev \
  --workspace @firmcode/api \
  --workspace @firmcode/shared \
  --workspace @firmcode/prompts \
  --include-workspace-root=false \
  && npm cache clean --force

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/packages/shared/dist packages/shared/dist

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3001) + '/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start", "--workspace", "@firmcode/api"]
