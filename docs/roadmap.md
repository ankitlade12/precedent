# Roadmap

Tiers: **[MVP]** ships in the hackathon build · **[v1]** the near term after · **[Later]** scale & enterprise. The full feature catalog lives in the [product brief](product-brief.md); this is the shape.

## MVP — this build

- **Capture:** ambient detection (precision-first heuristic) + manual `/precedent log`; thread-level assembly.
- **Confirm loop:** in-channel Block Kit card with Confirm / Edit / Dismiss; one-tap dismiss.
- **Decision record:** statement, type, rationale, rejected alternatives, deciders, citations, scope.
- **Supersession:** detection + linked chain; recall resolves to the current head.
- **Recall:** `/precedent why …` and @mention, supersession-aware, answered with receipts.
- **Provenance:** permalink grounding; append-only ledger with a hash chain.
- **MCP server:** `has_this_been_decided`, `get_decision`, `list_decisions`.
- **Seed workspace:** a believable community history with a reversed decision, for the demo.

## v1 — near term

- **Persistent store** (libSQL/SQLite with append-only triggers; Turso/Postgres scale path).
- **RTS backfill wizard** — retroactively propose decisions for threads older than the ledger.
- **Emoji nomination**, pending queue + batch confirm, confirmer routing & policy.
- **Richer records** — tags, related links (relates-to / depends-on), reversibility flag, review-by date, record version history.
- **Proactive intelligence** — relitigation guard (surface precedent when a settled question resurfaces), newcomer context, onboarding brief.
- **Recall** — browse/filter, Home-tab ledger, topic rollups, uncertainty caveats.
- **Integrations** — GitHub (link decisions to issues/PRs, detect decisions in PR discussion), ADR import/export, Slack Canvas index.
- **MCP** — `propose_decision` (agents log into the same governed ledger), the precedent gate.
- **Digests** — weekly decisions digest; change notifications to subscribers.
- **Eval harness** — standing precision/recall on a labeled set, so quality claims are backed by numbers.

## Later — scale & enterprise

- **Governance** — admin console, roles, approval workflows, retention & legal hold, SSO/SCIM.
- **Multi-workspace / org-wide ledger**, multi-tenancy isolation.
- **Analytics** — reversal rate, decision velocity, most-relitigated topics, participation/inclusion signals.
- **Auto-confirm** for high-confidence decisions in trusted channels (off by default).
- **Capture from canvases & linked docs**, multilingual detection.
- **Public decision page / governance log** for radically transparent open-source projects.

## The path from community to product

The community tier is the wedge and the credibility; the same engine is the enterprise product the day after — decision provenance as a compliance and continuity line item. **The code does not change between them.** See §9 of the [product brief](product-brief.md).
