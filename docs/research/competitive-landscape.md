# Competitive landscape (source-verified)

> Every claim below was checked against primary sources in July 2026. Being precise about what exists is what keeps Precedent from being dismissed on novelty — and it sharpens exactly where the whitespace is.

## The verdict

The market is **more crowded than a naive pitch assumes**, but the specific combination Precedent targets is unoccupied:

> **Automatic, supersession-aware capture of decisions as first-class objects — from ambient Slack chat, with rejected alternatives, grounded in permalinks, callable by other agents over MCP.**

Two honest caveats to carry into any demo or writeup:

1. **Decision *detection* is not novel.** [Decision Tracker](https://slack.com/marketplace/A010B2YL469-decision-tracker) already "automatically suggests tracking when it detects decisions" in Slack (though its own listing says it uses **no LLM** — it's rule-based). Don't lead with "nobody detects decisions."
2. **"Supersession" and "rejected alternatives" are decades-old concepts.** The ADR/MADR format has had a `superseded by ADR-NNNN` status and a "Considered Options" section for ~20 years ([adr.github.io/madr](https://adr.github.io/madr/), [Nygard 2011](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html)). The novelty is doing them **automatically and live, from chat** — not inventing them.

Lead instead with the **precise combination** and the **agent-callable recall** (`has_this_been_decided`), which is the part no one ships.

## By category

### Slack-native decision loggers — the closest competitors
- **Decision Tracker** ([marketplace](https://slack.com/marketplace/A010B2YL469-decision-tracker)) — auto-*suggests* decisions (rule-based, no LLM), links context. **No** rejected alternatives, **no** supersession. The single closest competitor on detection.
- **Decision Desk** ([decisiondesk.io](https://decisiondesk.io/)) — markets a *"Decision Ledger… single source of truth in Slack"* (so the generic phrase "decision ledger" is taken — we keep the name **Precedent** instead). Manual capture; no alternatives, no supersession.
- **Loqbooq** ([loqbooq.app](https://loqbooq.app/slack-integration)), **Cloverpop**, **DecisionBot**, **Decider** — Slack decision-capture apps, all manual and without linked supersession.

### AI-native "company memory" startups — the strategic threat
- **Hyper** (YC) ([ycombinator.com/companies/hyper-4](https://www.ycombinator.com/companies/hyper-4)) — "graph-backed memory of the company's decisions… which facts are stale," ingests Slack, provenance + staleness, injected via **MCP**. The nearest thing to Precedent. **Difference:** Hyper is a *horizontal* "remember everything" memory; Precedent models **decisions as first-class, auditable objects** with rejected alternatives and true linked supersession. Position focus + auditability as the moat, not scale.
- **Glean, Dust, Sana (Workday), Qatalog (ClickUp)** — enterprise search / RAG / agent builders over connected data. None model decisions as objects; none track supersession. ([Glean KG](https://docs.glean.com/security/knowledge-graph), [Dust docs](https://docs.dust.tt/docs/connections))

### Generic Slack Q&A agents
- **Slack AI**, **ChatGPT/Claude/Perplexity Slack connectors**, **Glean/Dust** — semantic search + summaries with citations. "Decisions" appear only as retrievable text or marketing prose, never a curated ledger with supersession. Slack's own blog recommends *pinning + search* as the workaround, confirming there's no native decision object. ([Slack AI](https://slack.com/help/articles/25076892548883-Guide-to-AI-features-in-Slack))

### Meeting assistants
- **Fellow, Otter, Fireflies, Spinach, Fathom, Granola** — extract summaries/action items from **audio/video transcripts**, not ambient Slack text. "Decisions" are a summary section, not tracked objects; no supersession. ("Slack Huddles" capture is *voice*, not channel text.) Adjacent, not competing.
- **Decisions** ([meetingdecisions.com](https://www.meetingdecisions.com/)) on MS Teams auto-maintains a decision log — but Teams + meeting-scoped, no supersession. A strong "this is inevitable in Slack" signal.

### Task / reminder / incident tools
- **Asana, Linear, Todoist, Slack reminders** — track *tasks/reminders*, not decisions-with-rationale. (Tellingly, Asana users [request a "Decision" type](https://forum.asana.com/t/adding-a-decision-type-of-tasks/82794) that doesn't exist — the gap is real and unmet.)
- **incident.io Scribe, Rootly, FireHydrant, PagerDuty/Jeli** — auto-capture "key moments" incl. decisions, but **incident-scoped** and ephemeral (timeline entries), with no durable decision object and no supersession. ([incident.io Scribe](https://docs.incident.io/ai/scribe))

### Manual decision logs & the prior art
- **Confluence Decisions/DACI, Jira, Notion/Coda decision templates, ADR/MADR** — all **manual**. The ADR "superseded by" convention and Notion's ADR two-way *Supersedes/Superseded-By* relation are the closest supersession analogs, but human-set and page-to-page, not auto-detected from chat. ([MADR](https://adr.github.io/madr/))

### Academic prior art (worth knowing, not competing)
- **Rationale management** — IBIS (Rittel & Kunz 1970), gIBIS (Conklin 1988), QOC (MacLean 1991), DRL (Lee & Lai 1991): capturing issues + *options* + arguments is a 50-year-old field.
- **ConDec** (Kleebaum & Paech, Heidelberg) — a decision *knowledge graph* with status and change-over-time, even a Slack plugin — but research-grade and SE-centric.
- **Chat rationale extraction** — REACT / Alkadhi et al. (2017–2018) extracted rationale from dev chat with *classical ML* (pre-LLM). The genuinely open space today is **LLM-based decision detection from chat + a supersession-aware ledger**, which no verified product ships.

## What this means for the build

- **Claim the combination, not the pieces.** The 5-column table in the [README](../../README.md#where-precedent-sits) is the honest framing — Precedent is the only row green across *ambient-detect · rejected-alternatives · auto-supersession · permalink-provenance · agent-callable-MCP*.
- **Lead the demo with supersession + `has_this_been_decided`** — the two things incumbents provably lack.
- **Show detection quality honestly** (the confirm step, a precision/recall number) — judges know detection is the hard part.
