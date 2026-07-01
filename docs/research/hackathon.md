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

Precedent uses **the RTS API** (recall backfill) and can consume the **Slack MCP server** for actions. ⚠️ **Nuance:** "MCP server integration" means integrating **Slack's** MCP server (`https://mcp.slack.com/mcp`) — *exposing our own MCP server does not, by itself, satisfy the rule.* Our own MCP server is a differentiator, not the compliance story; the RTS API (and/or consuming Slack's MCP server) is. Both surfaces require an **internal or directory-published** app; **semantic** RTS needs a **Slack AI–enabled** workspace.

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

Enroll in the **[Slack Developer Program](https://api.slack.com/developer-program)** → provision a free developer **sandbox** → register an app (internal) → add scopes (`search:read.public` + the manifest's bot scopes) → complete OAuth. Access is **self-serve** — there is no documented partnership waitlist. The real gates are structural: (a) the app must be internal/directory-published, and (b) **semantic** search needs a Slack AI–enabled plan; plain RTS/keyword works without it. Support flows through the **hackathon Slack channel**.

## ⚠️ Discrepancies & risks (don't miss)

1. **"For Good" fit is not automatic.** The track is scored on social impact (nonprofit ops, education, economic opportunity, accessibility, sustainability, public health) — there is **no "open source" criterion**. We resolve this by aiming the beneficiary at **under-resourced nonprofits / NGOs / volunteer OSS communities** (institutional-memory continuity + inclusion). If that framing ever feels forced, the fallback is the **New Slack Agent** track.
2. **The "5 active workspaces" requirement is unverified** and, per the rules, applies (if at all) only to the **Organizations** track — **not** to *For Good* or *New Agent*. Moot for us: our track needs no Marketplace submission.
3. **Own-MCP-server ≠ the MCP requirement** (see above). Ensure a real Slack-side integration (RTS and/or Slack MCP) is demoed.
4. **Semantic recall needs a Slack AI–enabled sandbox** — verify with `assistant.search.info`; don't assume it's on.
5. **Grant both test emails.** Missing either can invalidate the submission.
