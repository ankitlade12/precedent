# Demo video script — 2:50 target

Record at 1080p or higher. Hide bookmarks, notifications, tokens, terminal history, and unrelated channels. Use genuine sandbox messages and a human voice if possible. Do not use copyrighted music.

## 0:00–0:20 — The problem

**Screen:** Slack search results showing both the older Postgres message and newer SQLite message.

**Narration:** “A volunteer joins a project after its maintainer leaves. Slack search finds two real decisions: use Postgres, and later switch to SQLite. Search found the words, but it cannot tell the volunteer which decision still governs the project—or why it changed.”

## 0:20–0:48 — Human-confirmed capture

**Screen:** Post a fresh, genuine decision. Show Precedent’s Block Kit proposal, source grounding, and Confirm/Edit/Dismiss controls.

**Narration:** “Precedent detects commitments in normal conversation. Claude extracts a structured proposal: the decision, rationale, rejected options, scope, decider, and source. The model cannot write history by itself. A person must confirm or correct the card.”

## 0:48–1:25 — The knockout moment

**Screen:** Run `/precedent why primary datastore`. Pause on the current decision and timeline; open the real source receipt.

**Narration:** “Precedent is not another search bot. Its deterministic ledger resolves the lifecycle. SQLite is current. Postgres is historical. We can see why the team reversed course, what else it rejected, who confirmed it, when, and the exact Slack evidence.”

## 1:25–2:02 — Agent guardrail through MCP

**Screen:** Switch visibly to Slackbot. Ask it to check before proposing Postgres. Show `Used Check team precedent from Precedent decision memory MCP` and the resulting answer.

**Narration:** “This is Slackbot, an independent agent—not the Precedent app. Before acting, it calls Precedent through MCP and receives the same authoritative history. Precedent turns organizational memory into a guardrail every agent can consult.”

## 2:02–2:28 — Why the implementation is trustworthy

**Screen:** Show the architecture diagram, then briefly return to the confirmation card and receipt.

**Narration:** “The trust boundary is deliberate: the model proposes, a human confirms, and deterministic code owns truth. Records are content-addressed, append-only, hash-chained, supersession-aware, and source-grounded. MCP calls are authenticated and audited.”

## 2:28–2:50 — For Good impact

**Screen:** Precedent Home or the clean timeline view.

**Narration:** “Volunteer nonprofits and open-source communities lose context whenever maintainers rotate out. Precedent gives newcomers equal access to the missing why—reducing repeated explanation, speeding onboarding, and preventing abandoned work. A chat log says what was said. Precedent knows what was decided, and whether it is still true.”

## Recording acceptance checklist

- [ ] Total duration is below 3:00.
- [ ] The working product appears within the first 20 seconds.
- [ ] Search contradiction, current decision, real receipt, and Slackbot MCP invocation are readable.
- [ ] No terminal-only MCP demonstration.
- [ ] No secrets, private information, fake records, copyrighted music, or unlicensed third-party assets.
- [ ] Video is public on YouTube or Vimeo and plays in an incognito window without login.
