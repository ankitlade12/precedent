# Architecture

Precedent's single most important design decision is a **hard boundary between a language model that proposes and a deterministic engine that owns the truth.**

- The **model** (or the built-in heuristic) is allowed to be fuzzy. Everything it produces is a *proposal*: a candidate decision with an extracted statement, rationale, rejected alternatives, deciders, and citations. A human confirms, edits, or dismisses it.
- The **deterministic engine** is never allowed to guess. It mints stable IDs, attaches source permalinks, maintains an append-only hash chain, resolves the supersession graph, and assembles cited answers. Its correctness is *code*, proven by tests — not model output.

This boundary is the reason Precedent cannot hallucinate a decision into existence, and it is what the "Technological Implementation" of the product rests on.

## The two layers of a decision

A decision is modeled in two parts (see [`packages/ledger-core/src/types.ts`](../packages/ledger-core/src/types.ts)):

- **`DecisionContent`** — the immutable, identity-bearing payload. It *alone* determines a decision's content-addressed ID, so two captures of the same decision produce the same ID (idempotent capture), and any change to the content changes the ID (tamper-evident).
- **`DecisionRecord`** — the content plus ledger metadata (ID, sequence, hash-chain links, who confirmed it and when) written when a human confirms the decision into the ledger.

### The decision record schema

| Field | Meaning |
|---|---|
| `id` | Content-addressed identifier, e.g. `DR-a1b2c3d4e5f6`. |
| `statement` | The decision in one line. |
| `status` | Stored as `confirmed`; effective status (`superseded`/`reversed`) is *derived*, never mutated. |
| `type` | `technical`, `process`, `policy`, `governance`, `product`, `other`. |
| `rationale` | Why, grounded in the source conversation. |
| `alternatives` | Rejected options, each with the reason it lost. |
| `decidedBy` | The people who made the call, as Slack user IDs. |
| `decidedAt` | When the decision was made (from the source messages). |
| `citations` | Exact source-message permalinks. **The anti-hallucination guarantee.** |
| `channel` / `threadTs` | Where it happened. |
| `supersedesId` / `supersessionType` | The decision this one overrides, and whether it *supersedes*, *reverses*, or *amends* it. |
| `scope` | Project, repo, component, or team it applies to. |
| `confidence` | The model's detection confidence at proposal time (metadata, not identity). |
| `sequence` / `prevHash` / `recordHash` | Append-order and hash-chain links for integrity. |

## Deterministic guarantees (and how they're tested)

Everything below is verified in [`packages/ledger-core/test`](../packages/ledger-core/test):

- **Content-addressed identity.** `id = "DR-" + sha256(canonicalJSON(content))[:12]`. Canonical JSON sorts object keys recursively and omits `undefined`, so identity is independent of key order. → idempotent capture / dedup.
- **Append-only.** The store exposes `append`, never `update` or `delete`. Lifecycle changes are expressed as *new* records that point back at what they replace — never as edits.
- **Hash chain.** `recordHash = sha256(prevHash + id)`. `verifyChain()` recomputes the chain from genesis and detects any edit, insertion, deletion, or reordering (returning the index of the first broken link).
- **Supersession resolution.** `supersedesId` is the only link stored (forward). "Is X superseded?", "what's the current head?", and "show the history" are all *derived* by walking the graph — so recall correctness is code, and a reversed decision is never returned as current.
- **Injected clock.** The core never calls `Date.now()`; a `Clock` is injected, so every `confirmedAt` is reproducible under test.

## Ports and adapters

`ledger-core` depends on nothing but Node's `crypto`. Everything variable is a **port**:

- **`LedgerStore`** — persistence. `InMemoryLedgerStore` keeps domain tests fast; the running app uses the durable SQLite adapter — see [Storage](#storage).
- **`Detector` / `LlmClient`** (in `proposer`) — decision detection. `HeuristicDetector` is the precision-first default; `LlmDetector` is the pluggable production path behind a provider-agnostic port.
- **`SearchClient`** (in `proposer`) — the Real-Time Search backfill, implemented in production by `assistant.search.context`.

## The three flows

**Capture.** A candidate decision is detected in a thread → the proposer drafts a record with citations → it's posted as a Block Kit card (`Confirm` / `Edit` / `Dismiss`) → on confirm, the deterministic layer appends an immutable, cited record and resolves any supersession link. False positives cost one tap, which is what lets detection favor precision.

**Recall.** Someone asks *"why did we decide X?"* (via `/precedent why …` or an @mention) → the deterministic layer searches the structured ledger, resolves supersession, and answers with receipts: the decision, rationale, rejected alternatives, deciders, and permalinks. For decisions older than the ledger, the RTS backfill port finds likely source threads and offers to create a record.

**Agent consult (MCP).** Precedent runs its own MCP server (`/mcp`, Streamable HTTP). Any agent calls `has_this_been_decided(topic)` and gets the current decision + history + citations before it acts. Ordinary clients use bearer authentication; Slackbot connects through Slack's MCP client and signed-request verification. Each consultation writes a minimal structured event to the append-only JSONL audit path, making the agent guardrail visible and debuggable. This is the through-line to agent governance: making agents accountable to a durable record of prior decisions.

## <a id="storage"></a>Storage: the production path

The running app uses **SQLite via Node's built-in `node:sqlite`** (local file for self-hosting; Turso or Postgres/Neon remain scale paths — a decision ledger is an append-heavy, read-mostly, single-writer workload, which is SQLite's sweet spot):

```sql
CREATE TABLE decision_records (
  id           TEXT PRIMARY KEY,   -- content-addressed
  sequence     INTEGER NOT NULL UNIQUE,
  status       TEXT NOT NULL,
  prev_hash    TEXT NOT NULL,
  record_hash  TEXT NOT NULL,
  confirmed_by TEXT NOT NULL,
  confirmed_at TEXT NOT NULL,
  content_json TEXT NOT NULL,      -- canonical JSON of DecisionContent
  supersedes_id TEXT REFERENCES decision_records(id)
);

-- Enforce append-only at the database, not just in code.
CREATE TRIGGER decision_records_no_update BEFORE UPDATE ON decision_records
  BEGIN SELECT RAISE(ABORT, 'decision_records is append-only'); END;
CREATE TRIGGER decision_records_no_delete BEFORE DELETE ON decision_records
  BEGIN SELECT RAISE(ABORT, 'decision_records is append-only'); END;
```

The `LedgerStore` port stays synchronous so the deterministic core remains simple and testable. The current local SQLite adapter uses synchronous `node:sqlite`; a remote database adapter would introduce an async composition boundary.

## Trust posture

For a memory tool, trust *is* the product, so the guarantees are on the surface: Precedent only watches channels it is invited to; every proposed record is visible before it is stored; Slack permissions are respected on both capture and recall; the ledger is append-only with a full trail of who confirmed and edited; and customer conversation is never used to train models. See [SECURITY.md](../SECURITY.md).
