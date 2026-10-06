# Stage 1: Install production dependencies
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Install dev dependencies and build
FROM node:20-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci

# Copy source code and config files
COPY vite.config.ts tsconfig*.json postcss.config.js tailwind.config.ts components.json index.html ./
COPY src/ ./src/
COPY public/ ./public/
COPY server/ ./server/

# Build frontend and compile backend server
RUN npm run build
RUN npx tsc -p server/tsconfig.json

# Stage 3: Production runner
FROM node:20-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV AUTH_ENABLED=true

# Copy production dependencies (including compiled better-sqlite3)
COPY --from=deps /app/node_modules/ ./node_modules/

# Copy compiled backend code and metadata
COPY --from=build /app/server/dist/ ./server/dist/
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/package.json ./package.json

# Copy frontend build output
COPY --from=build /app/dist/ ./dist/

EXPOSE 3000
VOLUME ["/app/data"]
ENTRYPOINT ["tini", "--"]
CMD ["node", "server/dist/index.js"]
