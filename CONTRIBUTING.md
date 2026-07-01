# Contributing to Precedent

Thanks for helping build durable decision memory for teams and communities. Precedent is, itself, a project about preserving *why* — so we try to model good governance in how we work.

By participating you agree to our [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

```bash
nvm use            # Node >= 20 (see .nvmrc)
npm install        # npm workspaces links the packages
npm test           # vitest, all packages
npm run typecheck  # strict TypeScript across the workspace
```

## Project structure

See the [monorepo table in the README](README.md#monorepo-layout). The dependency direction is deliberate and enforced by review.

## The one rule that matters

**The deterministic core (`packages/ledger-core`) stays deterministic and dependency-free.** It must never import Slack, an LLM, or HTTP, and it must never call `Date.now()`/`new Date()` directly (inject a `Clock`). Everything a model produces is a *proposal a human confirms* — the ledger never trusts model output directly. This boundary is the product's trust guarantee; PRs that blur it will be asked to move the logic to the right layer.

Concretely:
- New detection logic → `packages/proposer` (behind the `Detector` / `LlmClient` port).
- New storage → implement the `LedgerStore` port in a new adapter; don't reach into the ledger internals.
- New agent capability → a tool in `packages/mcp-server`.
- New Slack UI → `packages/slack-app` (keep Block Kit builders pure and testable).

## Making a change

1. **Branch** off `main`.
2. **Write a test first** where it makes sense — the ledger core and recall logic are meant to be provable, not vibes. `npm test` and `npm run typecheck` must pass.
3. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`), scoped to a package where relevant, e.g. `feat(ledger-core): …`.
4. **Open a PR** describing the *why*, not just the *what*. If your change is itself a notable decision, say so — that's on brand.

## Reporting bugs & proposing features

Use the [issue templates](.github/ISSUE_TEMPLATE). For anything security-sensitive, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
