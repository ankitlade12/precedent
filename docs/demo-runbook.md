# Hackathon demo runbook

Use only genuine messages captured through Precedent in the judging sandbox. The running product has no synthetic seeding mode.

## Preflight

1. Revoke every credential that appeared in chat and place the replacements in `.env`.
2. Generate a strong MCP token (`openssl rand -hex 32`) and set `MCP_BEARER_TOKEN`.
3. Re-apply `manifest.json` to the Slack app, reinstall if Slack requests it, and invite Precedent to the demo channel.
4. Run `npm run typecheck`, `npm test`, then `npm start`.
5. Verify `/precedent`, `@Precedent`, the Home tab, one RTS miss, and one authenticated MCP call before recording.
6. In App Settings, confirm the app has an **MCP Servers** feature. Slack is still rolling this feature out to developers.
7. Follow [`deployment.md`](deployment.md) and deploy the app and MCP endpoint at a stable public host before submitting. A temporary `trycloudflare.com` or free ngrok URL is suitable for recording, not for unattended judging.
8. Follow [`judge-testing.md`](judge-testing.md) from a non-owner Member account.

## Judge access — mandatory

Developer sandboxes cap membership and manage users at the Enterprise organization level. Before submission:

1. Click the organization name → **Tools & settings** → **Organization settings**.
2. Open **People** → **Members**.
3. Deactivate unused placeholder accounts if the eight-user sandbox cap blocks invitations.
4. Invite `slackhack@salesforce.com` and `testing@devpost.com` as **Members**, not Guests.
5. Confirm both addresses appear in the organization member list.
6. Put the exact sandbox URL and the instructions from [`judge-testing.md`](judge-testing.md) in Devpost.

## Real source messages

Have human sandbox users post these naturally in one public demo channel:

1. `We're going with Postgres over DynamoDB because relational integrity matters and the maintainers already know it.`
2. Confirm the proposal card.
3. Later: `We're switching to SQLite instead of Postgres because a volunteer team should not carry the extra infrastructure.`
4. Confirm that the proposal card says it supersedes or reverses the earlier `DR-…` record. Use **Edit** to correct the relationship if needed, then confirm.

This produces real Slack permalinks and a real deterministic supersession chain.

## Three-minute story

- **0:00–0:25 — Contradiction, not search:** a new volunteer searches for the primary datastore. Put the old Postgres result and newer SQLite result on screen together. Say: “Both messages are real. Search cannot tell which one still governs the project.”
- **0:25–0:55 — Quiet capture:** show the proposal card, rationale, rejected alternative, source grounding, and human confirmation.
- **0:55–1:35 — Knockout moment:** run `/precedent why primary datastore`. Say: “Precedent is not returning the best matching message. It resolves the decision lifecycle.” Show SQLite under **Current precedent**, show Postgres as replaced in **Decision history**, and click the real receipt.
- **1:35–1:55 — Prevention:** ask the settled question again and show the relitigation guard intervene in-thread.
- **1:55–2:20 — Independent agent guardrail:** switch to a DM with Slackbot and say: “We're going with Postgres over DynamoDB as the primary datastore because relational integrity matters and the maintainers know it.” Approve the tool call. Slackbot—not the Precedent bot and not a terminal—must consult Precedent before acting, identify SQLite as current, explain that Postgres was previously tried and reversed, and require the proposal to address the reasons for that reversal.
- **2:20–2:40 — Day-one value:** query an unlogged topic and show RTS finding likely historical source messages.
- **2:40–3:00 — Human impact:** “The maintainer who made the original call has left. A new volunteer can still recover the reason, rejected alternative, current decision, and source without asking an insider. That means less re-explanation, faster onboarding, and fewer contributors abandoning work after stepping on invisible history.” Close with: “The model proposes. A human confirms. The ledger decides what is current. Every agent gets the same precedent.”

## Connect Precedent to Slackbot

Precedent accepts two MCP authentication paths: bearer auth for ordinary agents and Slack-signed requests for Slackbot. Use Slack's **No auth** connector setting; “No auth” still signs every request, and Precedent verifies that signature with `SLACK_SIGNING_SECRET`.

1. Start Precedent with a strong `MCP_BEARER_TOKEN`:

   ```bash
   npm start
   ```

2. Expose port 3010 through a stable HTTPS URL. Slack's official local-development example uses ngrok:

   ```bash
   ngrok http 3010
   ```

3. Open the app at `api.slack.com/apps` → **Features** → **MCP Servers** → **Get Started**.
4. Enter:
   - Name: `Precedent decision memory`
   - URL: `https://YOUR-NGROK-HOST/mcp`
   - Auth type: **No auth**
5. Save and reinstall the app. The manifest already includes `mcp:connect`.
6. Open a Slackbot DM. In the message composer, click the **plug icon** (Apps/Integrations) and connect Precedent. Do not use the **Skills** catalog; it is a separate Slack feature.
7. First ask: `What tools are available from Precedent?` Confirm that `Check team precedent`, `Get one decision record`, and `List current team decisions` appear.
8. Then say: `We're going with Postgres over DynamoDB as the primary datastore because relational integrity matters and the maintainers know it.`
9. Choose **Allow once**. Record the visible `Used Check team precedent from Precedent decision memory MCP` indicator and Slackbot stopping to surface the current SQLite decision, the reversed Postgres history, and the objections the new proposal must address.

If the **MCP Servers** feature is absent, the feature has not reached this developer account. Do not fake Slackbot footage: use an independently branded MCP client in a second window and state that Slackbot access is still rolling out.

## For Good story and success measures

The beneficiary is a volunteer joining a nonprofit or open-source community after the maintainer who made a consequential decision has left. They are not careless; the context is inaccessible. Precedent gives that newcomer the same decision history an insider would have.

For a post-hackathon pilot, measure:

- median time from a newcomer asking “why?” to opening the cited source;
- repeated questions where the relitigation guard surfaced an existing decision;
- percentage of confirmed decisions with a rationale, rejected alternative, and valid receipt;
- maintainer time spent re-explaining settled choices before and after installation;
- contributors who continue their task after receiving precedent instead of abandoning or duplicating work.

These are evaluation targets, not claims about outcomes that have not yet been measured.

## Do not improvise during judging

- Every displayed decision must have a clickable receipt leading to the genuine source message.
- Do not expose `.env`, terminal history containing credentials, or the MCP bearer token.
- Do not claim semantic RTS if the sandbox only supports keyword results.
- Do not claim MCP is user-permission-aware: Slack surfaces are channel-scoped; MCP uses a workspace service credential and accepts an explicit `channelId` constraint.
- Keep a screen recording of the complete successful flow as a fallback.
