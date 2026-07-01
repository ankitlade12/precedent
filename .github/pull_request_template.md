<!-- Describe the WHY, not just the what. If this change is itself a notable decision, note it. -->

## What & why

## How it was tested
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] Added/updated tests for the change

## Checklist
- [ ] `packages/ledger-core` stays deterministic and dependency-free (no Slack/LLM/HTTP, no `Date.now()`)
- [ ] Model output remains a *proposal a human confirms* — the ledger is not trusted to guess
- [ ] Conventional Commit title (e.g. `feat(ledger-core): …`)
