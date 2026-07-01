# Security & trust

For a memory tool, trust *is* the product. This document covers both how Precedent is built to be trustworthy and how to report a vulnerability.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.** Instead, email the maintainers at **security@precedent.dev** *(replace with your project's address before publishing)* with:

- a description of the issue and its impact,
- steps to reproduce, and
- any suggested remediation.

We aim to acknowledge within 3 business days and to keep you informed through remediation. We'll credit reporters who want it.

## The product's trust posture

These are design guarantees, not aspirations — several are enforced in code and covered by tests:

- **Append-only & tamper-evident.** The ledger never updates or deletes a record. Every record is content-addressed and linked in a hash chain; `verifyChain()` detects any edit, insertion, deletion, or reordering.
- **Grounded, not generative, at the point of truth.** A language model only *proposes*; a human confirms; the deterministic engine records with real permalinks. The system cannot invent a decision or a rationale.
- **Permission-aware.** Capture and recall both respect Slack channel and user permissions.
- **Invite-only.** The agent only watches channels it is explicitly added to.
- **No training on your data.** Customer conversation is never used to train models.
- **Retrieval, not bulk storage.** Nothing is retained beyond the structured decision ledger and its links.
- **Visible before stored.** Every proposed record is shown in-channel before it is written.

## Handling secrets

Slack tokens and the MCP bearer token live in `.env` (git-ignored; see [.env.example](.env.example)) — never commit real credentials. The MCP server supports a bearer token on every request; set `MCP_BEARER_TOKEN` in any shared or deployed environment.
