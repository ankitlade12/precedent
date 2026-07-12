FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/ledger-core/package.json packages/ledger-core/package.json
COPY packages/llm-anthropic/package.json packages/llm-anthropic/package.json
COPY packages/mcp-server/package.json packages/mcp-server/package.json
COPY packages/proposer/package.json packages/proposer/package.json
COPY packages/slack-app/package.json packages/slack-app/package.json
COPY packages/store-sqlite/package.json packages/store-sqlite/package.json
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

ENV NODE_ENV=production
ENV PORT=3010
ENV DATABASE_PATH=/data/precedent.db
ENV MCP_AUDIT_PATH=/data/mcp-audit.jsonl

RUN mkdir -p /data && chown -R node:node /app /data

# Railway mounts persistent volumes at runtime after image ownership is set.
# The mounted directory is root-owned, so the process must retain write access
# in order for SQLite and the append-only MCP audit log to initialize.

EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3010)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "start"]
