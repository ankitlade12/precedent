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
- **Grounded, not autonomous, at the point of truth.** A language model only *proposes*; a human reviews; Slack confirmation rejects missing or invalid source permalinks. A permalink proves provenance, while the human remains responsible for checking that the summary is faithful to its source.
- **Permission-aware Slack surfaces.** Slash-command, mention, onboarding, relitigation, and Home-tab recall are constrained to the current or viewer-accessible channels. MCP is a workspace-level service credential and should additionally receive `channelId` whenever the calling agent has channel context.
- **Invite-only.** The agent only watches channels it is explicitly added to.
- **Provider data handling.** When Claude detection is enabled, relevant message text is sent to the configured Anthropic API account. Operators must verify that account's retention and training terms; use the local heuristic detector when external processing is not acceptable.
- **Retrieval, not bulk conversation storage.** Source conversations are not copied into a shadow archive; Precedent retains structured decision records, source links, and minimal operational audit metadata.
- **Minimal MCP audit trail.** MCP consultations append tool name, timestamp, caller IDs when Slack provides them, bounded input fields, and outcome metadata to a local JSONL audit file. Tokens and full Slack messages are never written to that audit trail. Configure its location with `MCP_AUDIT_PATH` and apply your retention policy to that file.
- **Visible before stored.** Every proposed record is shown in-channel before it is written.

## Handling secrets

Slack tokens and the MCP bearer token live in `.env` (git-ignored; see [.env.example](.env.example)) — never commit real credentials. Ordinary MCP clients authenticate with `MCP_BEARER_TOKEN`. Slackbot's no-auth connector still signs every request; Precedent independently verifies that signature with `SLACK_SIGNING_SECRET` and rejects stale or modified requests.
