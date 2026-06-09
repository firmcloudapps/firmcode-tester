FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci --include=dev \
  --workspace @firmcode/web \
  --workspace @firmcode/shared \
  --include-workspace-root=false

FROM deps AS build

ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3000
ARG NEXT_PUBLIC_AUTH_PROVIDER=insforge
ARG NEXT_PUBLIC_INSFORGE_BASE_URL=https://h35yzuga.eu-central.insforge.app
ARG NEXT_PUBLIC_INSFORGE_URL=https://h35yzuga.eu-central.insforge.app
ARG NEXT_PUBLIC_INSFORGE_ANON_KEY
ARG INSFORGE_BASE_URL=https://h35yzuga.eu-central.insforge.app
ARG INSFORGE_ANON_KEY

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DASHBOARD_URL=$NEXT_PUBLIC_DASHBOARD_URL
ENV NEXT_PUBLIC_AUTH_PROVIDER=$NEXT_PUBLIC_AUTH_PROVIDER
ENV NEXT_PUBLIC_INSFORGE_BASE_URL=$NEXT_PUBLIC_INSFORGE_BASE_URL
ENV NEXT_PUBLIC_INSFORGE_URL=$NEXT_PUBLIC_INSFORGE_URL
ENV NEXT_PUBLIC_INSFORGE_ANON_KEY=$NEXT_PUBLIC_INSFORGE_ANON_KEY
ENV INSFORGE_BASE_URL=$INSFORGE_BASE_URL
ENV INSFORGE_ANON_KEY=$INSFORGE_ANON_KEY

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

RUN npm run build --workspace @firmcode/shared \
  && npm run build --workspace @firmcode/web

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci --omit=dev \
  --workspace @firmcode/web \
  --workspace @firmcode/shared \
  --include-workspace-root=false \
  && npm cache clean --force

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/web/.next apps/web/.next
COPY --from=build /app/apps/web/next.config.mjs apps/web/next.config.mjs
COPY --from=build /app/apps/web/postcss.config.mjs apps/web/postcss.config.mjs
COPY --from=build /app/apps/web/tailwind.config.ts apps/web/tailwind.config.ts

RUN chown -R node:node apps/web/.next

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/sign-in').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start", "--workspace", "@firmcode/web", "--", "-H", "0.0.0.0"]
