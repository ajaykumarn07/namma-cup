# ---- build the React client ----
FROM node:22-bookworm-slim AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- install server deps (native module: better-sqlite3) ----
FROM node:22-bookworm-slim AS server-deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev

# ---- runtime ----
FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/embercup.db CLIENT_DIST=/app/client-dist
WORKDIR /app/server
COPY --from=server-deps /app/server/node_modules ./node_modules
COPY server/package*.json ./
COPY server/src ./src
COPY --from=client /app/client/dist /app/client-dist
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
