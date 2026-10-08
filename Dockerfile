# --- client build ---
FROM node:22-bookworm AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# --- server deps ---
FROM node:22-bookworm AS server
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./

# --- runtime ---
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/ohno.db \
    CLIENT_DIST=/app/client/dist
WORKDIR /app
COPY --from=server /app/server/package.json ./server/package.json
COPY --from=server /app/server/node_modules ./server/node_modules
COPY --from=server /app/server/src ./server/src
COPY --from=client /app/client/dist ./client/dist
EXPOSE 3000
CMD ["node", "server/src/index.js"]
