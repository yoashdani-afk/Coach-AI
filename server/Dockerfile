# Build context = repo root (Coach-AI). Runtime is the analysis server only.
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/ ./

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npx", "tsx", "index.ts"]
