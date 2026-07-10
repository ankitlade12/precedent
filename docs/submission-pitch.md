# Submission-ready pitch

## One sentence

Precedent is the decision memory for volunteer teams: it knows which Slack decision is current, why earlier calls were replaced, and gives people and agents the same source-grounded answer.

## Opening

A volunteer searches Slack before changing the project's database. They find two genuine decisions: “Use Postgres” and, six weeks later, “Switch to SQLite.” Search did its job—it found both—but it cannot tell the volunteer which one still governs the project. The maintainer who made the call has left, so the missing context has become an access barrier.

Precedent models decisions as living, cited records. It returns SQLite as the current precedent, marks Postgres as replaced, preserves why the team changed course and what it rejected, and links to the exact Slack messages. When Slackbot or another agent checks before acting, it receives the same authoritative history.

## Why it is not search

- Search ranks messages; Precedent resolves a decision lifecycle.
- Search returns contradictory history; Precedent identifies the current head.
- Search retrieves mentions; Precedent preserves rationale and rejected alternatives as structured fields.
- Search summarizes; Precedent requires human confirmation and retains source receipts.
- Search answers one user; Precedent exposes shared organizational precedent to other agents through MCP.

## For Good impact

Volunteer nonprofits and open-source communities lose institutional memory whenever maintainers rotate out. New contributors then reopen settled debates, duplicate rejected work, or abandon contributions after discovering context too late. Precedent makes historical reasoning available without requiring insider access to the person who remembers it.

The intended outcomes are reduced maintainer re-explanation time, faster newcomer onboarding, fewer duplicate proposals, and more contributors continuing after they encounter an established constraint. A pilot would measure these outcomes directly; the hackathon build does not claim unmeasured impact.

## Closing

The model proposes. A human confirms. A deterministic ledger resolves what is current. Every person and agent gets the same precedent, with the receipts.
