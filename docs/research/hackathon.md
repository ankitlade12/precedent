# Slack Agent Builder Challenge — verified brief

> Cross-checked against the [Devpost pages](https://slackhack.devpost.com/) and official Slack developer docs, July 2026. **Discrepancies with common assumptions are flagged at the bottom — read those.**

## Key facts

| | |
|---|---|
| **Hackathon** | Slack Agent Builder Challenge (organized by Salesforce / Slack, on Devpost) |
| **Submission deadline** | **July 13, 2026, 5:00 PM PDT** (= 8:00 PM EDT) |
| **Judging period** | July 14 – Aug 6, 2026 · **Winners ~Aug 11, 2026** |
| **Our track** | **Slack Agent for Good** |
| **Prize (per track)** | 1st **$8,000** · 2nd **$4,000**; plus **Best UX / Most Innovative / Best Technical** at **$2,000** each. Pool: **$42,000** |
| **Eligibility** | 18+, specific countries (Canada **excl. Quebec**), teams up to **4** |

## Required technology (use at least one)

1. **Slack AI capabilities**, 2. **MCP server integration**, or 3. **Real-Time Search (RTS) API**.

Precedent uses **the RTS API** (recall backfill) and consumes the **Slack MCP server** for actions.

**New (June 2026) — Slackbot is now an MCP *client*.** You can connect *your own* MCP server to Slackbot and it auto-discovers and invokes your tools from conversation ([announcement](https://docs.slack.dev/changelog/2026/06/18/slackbot-mcp-client/), [blog](https://slack.com/blog/news/slackbots-mcp-client)). So connecting **Precedent's MCP server to Slackbot** — a user asks Slackbot *"have we decided X?"* → Slackbot calls `has_this_been_decided()` → answers with the current decision and its supersession — is both a native demo of *agents consulting Precedent* and a legitimate Slack-side MCP integration. (This softens an earlier caveat: an *isolated* self-hosted MCP server with no Slack consumer was the weak compliance story; Slackbot's client fixes it. Keep the RTS API in the demo regardless.) Auth options: Slack identity auth, no-auth, Dynamic Client Registration, or manual OAuth. Both MCP and RTS require an **internal or directory-published** app; **semantic** RTS needs a **Slack AI–enabled** workspace.

## Judging criteria (four, equally weighted)

1. **Technological Implementation** — quality software; real use of the required tech.
2. **Design** — is the UX well thought out?
3. **Potential Impact** — impact on the Slack community.
4. **Quality of the Idea** — creative, unique, an improvement over existing concepts.

How Precedent maps: **Tech** — deterministic core + RTS + our own MCP server (target *Best Technical*). **Design** — non-intrusive capture + a legible supersession/history view (target *Best UX*). **Impact** — institutional-memory continuity for communities. **Idea** — the precise, defensible combination (see [competitive-landscape.md](competitive-landscape.md)).

## Submission checklist

- [ ] Track selected (**Slack Agent for Good**)
- [ ] Text description of features/functionality
- [ ] **Demo video < 3 minutes** (story-first; lead with the supersession moment)
- [ ] **Architecture diagram** (see [architecture.md](../architecture.md))
- [ ] **Slack sandbox URL**, with test access granted to **BOTH** `slackhack@salesforce.com` **and** `testing@devpost.com`
- [ ] **Slack App ID**

## Getting access (critical path)

Enroll in the **[Slack Developer Program](https://api.slack.com/developer-program)** (free), then provision a **developer sandbox** from the dashboard.

⚠️ **Provisioning requires a paid-plan workspace OR a payment method on your developer workspace** — but the card is **for identity verification only; you are not charged**, and sandboxes are **free** (up to 10 over 30 days, 2 active at a time, 6 months each, up to 3 workspaces, 8 users, Free-plan message/file policies). Practical unblock: *add a card → provision → build.*

⚠️ **Slack AI Search is not guaranteed in a sandbox** (they run at Free-plan level). Since **semantic** RTS needs a Slack AI–enabled workspace, plan to demo on **keyword** RTS for backfill; Precedent's core recall runs on the deterministic ledger regardless, so it degrades gracefully. Verify with `assistant.search.info`.

Then register the app (internal) from [`manifest.json`](../../manifest.json) → add scopes → complete OAuth → grant test access to both submission emails. Support flows through the **hackathon Slack channel**.

## ⚠️ Discrepancies & risks (don't miss)

1. **"For Good" fit is not automatic.** The track is scored on social impact (nonprofit ops, education, economic opportunity, accessibility, sustainability, public health) — there is **no "open source" criterion**. We resolve this by aiming the beneficiary at **under-resourced nonprofits / NGOs / volunteer OSS communities** (institutional-memory continuity + inclusion). If that framing ever feels forced, the fallback is the **New Slack Agent** track.
2. **The "5 active workspaces" requirement is confirmed — but Organizations-track only.** Per the official *"Ship It Right"* update (July 2026), the **Slack Agent for Organizations** track requires the app to be installed on **≥5 active workspaces** (used in the last 28 days), fully built/tested (no "coming soon"), with a complete Marketplace listing (icon, screenshots, and working landing/support/privacy pages) and **built in a production workspace, not the sandbox**. **None of this applies to *For Good* or *New Agent*** — the update explicitly points teams who can't meet it to those tracks. For us: no Marketplace listing, no installs, and the **developer sandbox is sufficient** ("the sandbox is for testing and judging").
3. **Own-MCP-server ≠ the MCP requirement** (see above). Ensure a real Slack-side integration (RTS and/or Slack MCP) is demoed.
4. **Semantic recall needs a Slack AI–enabled sandbox** — verify with `assistant.search.info`; don't assume it's on.
5. **Grant both test emails.** Missing either can invalidate the submission.
