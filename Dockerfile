FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# Vite inlines VITE_* at build time, so the public origin has to be present
# here — a runtime env var arrives too late and link previews would ship
# pointing at localhost. In Dokploy, set this as a build argument.
ARG VITE_SITE_URL
ENV VITE_SITE_URL=$VITE_SITE_URL
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=build /app/.output ./.output
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
