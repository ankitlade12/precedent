# Devpost submission package

Copy this into a draft, then rewrite a few phrases in your own voice before final submission. Judges explicitly recommend specific, human-written descriptions over generic AI prose.

## Project name

**Precedent**

## Tagline

**The decision memory your team—and its agents—can trust.**

## Project overview fields

- **Project name:** `Precedent`
- **Elevator pitch:** `Precedent turns Slack conversations into human-confirmed decision memory, so people and agents know what was decided, why it changed, and what is still true.`
- **Thumbnail:** [`assets/precedent-devpost-thumbnail.png`](assets/precedent-devpost-thumbnail.png)

## Track

**Slack Agent for Good**

This avoids the Organizations track’s Marketplace submission and five-active-workspace requirements. The social-impact beneficiary must stay specific: volunteer-led nonprofits and open-source communities experiencing maintainer turnover.

## What it does

Precedent turns consequential Slack conversations into a living decision record. It detects when a team makes a commitment, drafts a structured proposal containing the rationale, rejected alternatives, deciders, scope, and source messages, and asks a human to confirm, edit, or dismiss it.

When a later decision changes an earlier one, Precedent links the two instead of returning contradictory search results. Asking `/precedent why primary datastore` returns the current call, the old-to-new timeline, and real Slack receipts. Slackbot and other agents can consult the same authoritative history through Precedent’s MCP server before they act.

## Inspiration

Volunteer communities often rely on one or two maintainers who remember why important choices were made. When those people rotate out, new contributors inherit the chat history but not the context. They reopen expensive debates, repeat rejected work, or abandon a contribution after discovering an invisible constraint too late. Precedent makes the missing “why” available without requiring access to an insider.

## How we built it

Precedent is a TypeScript monorepo built with Slack Bolt, Block Kit, Socket Mode, Claude structured extraction, Slack’s Real-Time Search API, an MCP server, and SQLite.

Its central design is a hard trust boundary. Claude may extract a candidate decision, but the result is only a proposal. A human confirms it before a deterministic ledger assigns a content-addressed ID, appends it to a hash chain, and resolves any supersession or reversal. SQLite triggers reject updates and deletes. Recall is deterministic and always includes genuine Slack permalinks. Slack-signed requests let Slackbot consume the MCP tools, while bearer authentication supports other agents; MCP invocations are recorded in a bounded audit log.

## Challenges we ran into

The difficult part was not summarization—it was lifecycle correctness. Search can find Postgres and SQLite, but deciding which one is current cannot safely depend on a model’s wording. We separated fuzzy extraction from deterministic resolution, added explicit human confirmation, and modeled changes as new immutable records linked to earlier decisions.

Connecting Slackbot was another important challenge. Precedent supports Slack-signed, stateless MCP requests so Slackbot can independently discover and call its tools without weakening the bearer-authenticated path used by ordinary clients.

## Accomplishments we’re proud of

- A native Block Kit capture flow with Confirm, Edit, and Dismiss.
- A compact old → new lifecycle visual before a reversal is committed.
- Deterministic current-decision resolution with complete history and real receipts.
- A live Slackbot MCP consultation—not a terminal simulation.
- Append-only SQLite enforcement, hash-chain integrity checks, provenance validation, event deduplication, channel scoping, and MCP audit events.
- 59 automated tests across 14 files, plus strict TypeScript checks.

## What we learned

Agent memory needs a stronger contract than retrieval. A useful organizational memory layer must distinguish proposals from truth, preserve rejected alternatives, make changes explicit, respect Slack permissions, and give both humans and agents the same source-grounded answer.

## What’s next

The next step is a pilot with volunteer-led teams. We will measure maintainer re-explanation time, newcomer time-to-context, repeated settled questions, and whether contributors continue their work after receiving precedent. Product work includes a guided RTS backfill flow, stable managed hosting, multi-workspace support, retention controls, ADR export, and aggregate impact reporting.

## Built with

`slack` `block-kit` `bolt` `mcp` `real-time-search` `typescript` `node.js` `sqlite` `anthropic-claude`

## Required links and uploads

- Source code: `https://github.com/ankitlade12/precedent`
- Public demo video: **TODO — public YouTube/Vimeo URL**
- Slack developer sandbox: **TODO — exact sandbox URL**
- Architecture diagram upload: [`assets/precedent-architecture.png`](assets/precedent-architecture.png) (editable source: [`precedent-architecture.svg`](assets/precedent-architecture.svg))
- Testing instructions: [`judge-testing.md`](judge-testing.md)
- Stable deployment guide: [`deployment.md`](deployment.md)
- Slack App ID: `A0BEREDDAQM` (optional for this track, useful for verification)

## Submission gate

- [ ] Join the hackathon and create a draft submission.
- [ ] Select **Slack Agent for Good**.
- [ ] Paste and personalize the description above.
- [ ] Upload the architecture SVG using Devpost’s dedicated architecture field.
- [ ] Record a working demo below 3 minutes using [`video-script.md`](video-script.md).
- [ ] Upload it publicly to YouTube or Vimeo and verify it in an incognito window.
- [ ] Paste the exact Slack developer sandbox URL.
- [ ] Invite `slackhack@salesforce.com` and `testing@devpost.com` as **Members** at the organization level.
- [ ] Confirm both appear in the organization member list.
- [ ] Keep the hosted Slack app and stable MCP endpoint online throughout judging.
- [ ] Rotate every credential exposed during development and test again with the replacements.
- [ ] Submit before **July 13, 2026 at 5:00 PM PDT**; submit early enough for eligibility feedback.
