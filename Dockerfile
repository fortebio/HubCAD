# Debian (glibc) + Node 22: better-sqlite3 12.x ships prebuilt binaries only for
# glibc and Node >= 22, so no node-gyp toolchain is needed.

# ---- build: compile the Vite frontend -------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime: Express serves /api, /uploads and dist/ ----------------------
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends wget \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci --omit=dev && npm cache clean --force
# server/ is run through tsx (a runtime dep): the PDF templates are .jsx and
# a few services import helpers from src/lib.
COPY server ./server
COPY src ./src
COPY --from=build /app/dist ./dist

# SQLite file + uploaded models/images live on volumes (see docker-compose.yml)
VOLUME ["/app/data", "/app/uploads"]
EXPOSE 3001
CMD ["npx", "tsx", "server/index.js"]
