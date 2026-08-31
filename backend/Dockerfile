# ============================================================
# Palta backend — production image (multi-stage)
# ============================================================
# Stage 1 installs deps + generates the Prisma client.
# Stage 2 is a lean runtime image with only what's needed to run.
# ============================================================

# ---- Stage 1: build ----
FROM node:22-slim AS build
WORKDIR /app

# System deps Prisma needs (openssl).
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies (cached unless package files change).
COPY package*.json ./
RUN npm install

# Copy source + generate the Prisma client against the schema.
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src

# ---- Stage 2: runtime ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy installed deps + generated client + app source from the build stage.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY package*.json ./

# Run as the built-in non-root user for safety.
USER node

EXPOSE 4000

# Simple container healthcheck hitting the liveness endpoint.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
