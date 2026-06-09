# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS runner

WORKDIR /app

# Install production dependencies + tsx for runtime TS support
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm install tsx && npm cache clean --force

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy backend source
COPY api ./api

# Create data and uploads directories
RUN mkdir -p /app/api/data /app/uploads /app/uploads/tmp

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Data volume for persistence
VOLUME ["/app/api/data", "/app/uploads"]

CMD ["node", "--import", "tsx", "api/server.ts"]
