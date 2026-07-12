# Stable judging deployment

The Slack app uses Socket Mode, so the service only needs outbound Slack connectivity plus one public HTTPS route for `/mcp`. The repository includes a Docker image and an unauthenticated, data-free `/health` endpoint for managed-host readiness checks.

## Hosting requirements

- Node 22 or the included Dockerfile.
- A persistent volume mounted at `/data`; without it, ledger and audit history disappear on redeploy.
- A stable public HTTPS hostname that does not change during judging.
- An always-on process from submission through the end of judging.
- Outbound HTTPS/WebSocket access to Slack and HTTPS access to Anthropic.

## Required environment variables

- `SLACK_BOT_TOKEN`
- `SLACK_APP_TOKEN`
- `SLACK_SIGNING_SECRET`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL=claude-opus-4-8`
- `MCP_BEARER_TOKEN` — at least 32 random characters
- `MCP_PATH=/mcp`
- `DATABASE_PATH=/data/precedent.db`
- `MCP_AUDIT_PATH=/data/mcp-audit.jsonl`

The host may inject `PORT`; it takes effect when `MCP_PORT` is unset.

## Deploy and verify

1. Build and deploy the Dockerfile to a managed container host with a persistent `/data` volume.
2. Confirm `https://YOUR-HOST/health` returns `{"status":"ok"}`.
3. Update Slack App Settings → **MCP Servers** to `https://YOUR-HOST/mcp` using **No auth**. Slack still signs these requests; Precedent verifies the signature.
4. Reinstall the Slack app if requested.
5. Run the complete flow in [`judge-testing.md`](judge-testing.md) from a non-owner Member account.
6. Restart the service once and verify the genuine decision records remain available.
7. Keep the temporary tunnel only as a recording fallback; do not place its URL in the final submission.

## Credential handling

Never bake `.env` into the image. Set secrets through the host’s encrypted environment controls. Rotate all credentials that passed through chat before deployment, then remove the old credentials from Slack and Anthropic.
