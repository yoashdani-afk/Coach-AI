# Coach AI analysis server — same Node entrypoint as local `npm start` (tsx index.ts).
# Does not change Gemini / analyse pipeline code.
FROM node:22-bookworm-slim

WORKDIR /app

# System deps for sharp / tfjs-node native bindings
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# Include devDependencies: runtime entry is `tsx index.ts` (same as local npm start).
RUN npm ci

COPY . .

ENV NODE_ENV=production
# Railway injects PORT; server already listens on 0.0.0.0
EXPOSE 3001

CMD ["npx", "tsx", "index.ts"]
