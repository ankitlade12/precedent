# Judge testing guide

## Access

- Slack developer sandbox: **paste the exact sandbox URL into Devpost and here before submission**
- App: **Precedent**
- Judge role: **Member**, not Guest
- Required invited accounts:
  - `slackhack@salesforce.com`
  - `testing@devpost.com`

The app uses Socket Mode, so no inbound Slack event URL is required. The hosted Precedent process and its MCP URL must remain online throughout judging.

## Two-minute verification

1. Open the channel named in the final Devpost instructions.
2. Run `/precedent why primary datastore`.
3. Verify that **SQLite is current**, Postgres appears earlier in the timeline, and the answer includes a clickable Slack receipt.
4. Click the receipt and confirm it opens the genuine source message.
5. Open a DM with Slackbot and send:

   > Before I propose moving the primary datastore back to Postgres, use Precedent to check what the team already decided and explain the complete history.

6. If prompted, select **Allow once** for `Check team precedent`.
7. Verify Slackbot identifies SQLite as current and explains the earlier Postgres decision rather than treating both messages as equally authoritative.

## Optional capture test

In a channel where Precedent is invited, post a genuine decision using an explicit commitment and rationale, for example:

> We’re standardizing on weekly contributor office hours instead of ad-hoc scheduling because volunteers span multiple time zones.

Precedent should show a Block Kit proposal. Review the extracted statement, rationale, decider, alternative, confidence, and source grounding. Use **Confirm**, **Edit**, or **Dismiss**. Only a human-confirmed proposal enters the ledger.

## What this proves

- Slack search can retrieve contradictory messages; Precedent resolves which decision is current.
- The AI extracts a proposal but cannot write authoritative history without human confirmation.
- The deterministic ledger maintains the immutable lifecycle and source receipts.
- Slackbot is an independent agent consuming the same organizational memory through MCP.

## Recovery

- If a slash command is attempted inside a thread, move to the channel composer; Slack does not support slash commands in thread composers.
- If Slackbot asks for tool permission, choose **Allow once**.
- If Slackbot cannot see the tool, reconnect `Precedent decision memory` from the composer’s integrations button.
- If the app is unavailable, use the contact information entered in the Devpost submission. Do not substitute screenshots for the required live sandbox test.
