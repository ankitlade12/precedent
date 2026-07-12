# Submission status — July 10, 2026

Deadline: **July 13, 2026 at 5:00 PM PDT / 7:00 PM CDT**.

## Product and submission assets complete

- [x] Genuine Slack capture, confirmation, reversal history, timestamps, real users, and receipts.
- [x] Independent Slackbot MCP invocation returns the same authoritative current decision.
- [x] Native Block Kit UI, Home onboarding, error recovery, relitigation guard, and MCP audit events.
- [x] No production demo seeding or synthetic product records.
- [x] 59 tests across 14 files; strict TypeScript passes.
- [x] Production Docker image builds with zero known production dependency vulnerabilities.
- [x] Upload-ready 1600×900 architecture PNG and editable SVG.
- [x] Timed 2:50 demo script, judge testing guide, field-by-field Devpost copy, and deployment guide.
- [x] GitHub repository pushed through commit `248b2ab`; the submission-package changes after that commit are currently local until reviewed and pushed.

## Human/external actions still required

- [ ] **Invite both judge accounts as organization-level Members:**
  - `slackhack@salesforce.com`
  - `testing@devpost.com`
- [ ] Confirm both appear under Organization settings → People → Members. The app token cannot verify this because it lacks `users:read.email`; the July 10 API check returned `missing_scope` for both lookups.
- [ ] Rotate all Slack and Anthropic credentials that passed through chat.
- [ ] Deploy the verified Docker image to an always-on host with a persistent `/data` volume.
- [ ] Replace the temporary tunnel in Slack’s MCP Server settings with the stable `https://HOST/mcp` URL.
- [ ] Reinstall the Slack app if requested and test from a non-owner Member account.
- [ ] Create the Devpost draft and select **Slack Agent for Good**.
- [ ] Record the real product using `video-script.md`; keep it below three minutes.
- [ ] Upload the video publicly to YouTube or Vimeo and verify playback in an incognito window.
- [ ] Upload `assets/precedent-architecture.png` in the dedicated Architecture Diagram field.
- [ ] Paste the exact developer sandbox URL and the instructions from `judge-testing.md`.
- [ ] Personalize the opening paragraph in `devpost-submission.md` so it sounds like the builder, not generic AI copy.
- [ ] Submit early enough for Devpost eligibility feedback; do not wait for the final hour.

## Go/no-go gate

Do not submit until all of these are true:

1. Both judge emails are visible as Members.
2. The public video plays without login and is under three minutes.
3. The stable host survives a restart without losing the real decision ledger.
4. Slackbot invokes the stable MCP URL successfully.
5. A non-owner Member can complete `judge-testing.md` end to end.
