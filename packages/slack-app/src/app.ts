import { randomUUID } from 'node:crypto';

import type { Alternative, DecisionRecord, DecisionType, Ledger, SupersessionType } from '@precedent/ledger-core';
import { type DecisionProposal, type Detector, recall, type ThreadMessage, toDecisionContent } from '@precedent/proposer';
import { App } from '@slack/bolt';
import { WebClient } from '@slack/web-api';

import {
  buildBackfillPrompt,
  buildDecisionProposalCard,
  buildEditDecisionModal,
  buildOnboardingBrief,
  buildRecallAnswer,
  buildRelitigationNudge,
  CONFIRM_ACTION,
  DISMISS_ACTION,
  EDIT_ALTERNATIVES_ACTION,
  EDIT_ALTERNATIVES_BLOCK,
  EDIT_DECIDERS_ACTION,
  EDIT_DECIDERS_BLOCK,
  EDIT_ACTION,
  EDIT_MODAL_CALLBACK,
  EDIT_RATIONALE_ACTION,
  EDIT_RATIONALE_BLOCK,
  EDIT_RELATION_ACTION,
  EDIT_RELATION_BLOCK,
  EDIT_SCOPE_ACTION,
  EDIT_SCOPE_BLOCK,
  EDIT_STATEMENT_ACTION,
  EDIT_STATEMENT_BLOCK,
  EDIT_SUPERSEDES_ACTION,
  EDIT_SUPERSEDES_BLOCK,
  EDIT_TYPE_ACTION,
  EDIT_TYPE_BLOCK,
} from './blocks';
import { createRtsSearchClient } from './rts';

export interface SlackAppConfig {
  token: string;
  appToken: string;
  signingSecret: string;
  /** Optional user token for permission-aware private-channel RTS results. */
  userToken?: string;
}

export interface SlackAppDeps {
  ledger: Ledger;
  detector: Detector;
}

type PendingProposals = Map<string, { proposal: DecisionProposal; expiresAt: number }>;
const PENDING_TTL_MS = 30 * 60 * 1000;
const EVENT_DEDUP_TTL_MS = 10 * 60 * 1000;

/**
 * Wire the Slack surface to the deterministic ledger and the model layer.
 *
 * - Capture: the `Log this decision` message shortcut fetches the thread, runs the
 *   detector, and posts the Block Kit proposal card. Confirming appends an
 *   immutable, cited record; dismissing keeps nothing.
 * - Recall: `/precedent why <topic>` answers from the ledger with receipts, and on
 *   a miss falls back to the Real-Time Search API to offer likely source threads.
 *
 * Socket Mode is used so the demo needs no public URL. Pending proposals are held
 * in memory keyed by a token carried on the card's buttons.
 */
export function createSlackApp(config: SlackAppConfig, deps: SlackAppDeps): App {
  const app = new App({
    token: config.token,
    appToken: config.appToken,
    signingSecret: config.signingSecret,
    socketMode: true,
  });

  const pending: PendingProposals = new Map();
  const seenEvents = new Map<string, number>();
  const searchClient = config.userToken === undefined ? undefined : new WebClient(config.userToken);

  // `/precedent why <topic>` — recall (RTS backfill on a miss); `/precedent log` — capture.
  app.command('/precedent', async ({ command, ack, respond, client }) => {
    await ack();
    const [subcommand, ...rest] = command.text.trim().split(/\s+/);
    const topic = rest.join(' ');

    if (subcommand === 'why' && topic.length > 0) {
      const answer = recall(deps.ledger, topic, { channelIds: [command.channel_id] });
      if (answer.decided) {
        await respond({ blocks: buildRecallAnswer(topic, answer) });
        return;
      }
      try {
        const candidates = await createRtsSearchClient(searchClient ?? client).searchContext(topic);
        await respond({ blocks: buildBackfillPrompt(topic, candidates) });
      } catch {
        await respond({ blocks: buildRecallAnswer(topic, answer) });
      }
      return;
    }

    // `/precedent log` — scan recent channel history and propose the latest decision.
    if (subcommand === 'log') {
      try {
        await client.conversations.join({ channel: command.channel_id }).catch(() => undefined);
        const history = await client.conversations.history({ channel: command.channel_id, limit: 15 });
        const messages: ThreadMessage[] = await Promise.all(
          (history.messages ?? [])
            .filter((message) => message.subtype === undefined && (message.text ?? '').trim().length > 0)
            .map(async (message): Promise<ThreadMessage> => {
              const ts = message.ts ?? '';
              const permalink = await client.chat
                .getPermalink({ channel: command.channel_id, message_ts: ts })
                .then((result) => result.permalink ?? '')
                .catch(() => '');
              return { userId: message.user ?? 'unknown', text: message.text ?? '', ts, channelId: command.channel_id, permalink };
            }),
        );
        console.log(`[capture] /precedent log scanned ${messages.length} message(s)`);
        const proposal = await deps.detector.detect({ channelId: command.channel_id, messages });
        if (proposal === null) {
          await respond("I couldn't spot a recent decision here — post something like “we're going with X over Y because Z”, then run `/precedent log`.");
          return;
        }
        const reviewedProposal = suggestLifecycle(proposal, deps.ledger);
        const token = rememberProposal(pending, reviewedProposal);
        console.log(`[capture] proposal "${reviewedProposal.statement}" (token ${token})`);
        await client.chat.postMessage({
          channel: command.channel_id,
          blocks: buildDecisionProposalCard(reviewedProposal, token, proposalCardContext(deps.ledger, reviewedProposal)),
          text: 'Log this decision?',
        });
        await respond('Found a likely decision — confirm the card I posted just above to log it. :point_up:');
      } catch (error) {
        console.error('[capture] /precedent log failed:', error);
        await respond(`Capture failed: ${safeErrorMessage(error)} Run \`/precedent log\` again in this channel; if it repeats, use the message shortcut.`);
      }
      return;
    }

    if (subcommand === 'onboard') {
      // Slash commands can be invoked before the bot has joined a public
      // channel. Join here so onboarding also activates ambient capture.
      await client.conversations.join({ channel: command.channel_id }).catch(() => undefined);
      const decisions = deps.ledger.currentDecisions().filter((record) => record.content.channelId === command.channel_id);
      await respond({ blocks: buildOnboardingBrief(decisions) });
      return;
    }

    await respond(
      'Usage:\n• `/precedent onboard` — activate Precedent in this channel\n• `/precedent log` — capture the most recent decision here\n• `/precedent why <topic>` — what did we decide, with receipts\n_Private channel? First run `/invite @Precedent`._',
    );
  });

  // Message shortcut: capture a decision from a thread.
  app.shortcut('log_decision', async ({ shortcut, ack, client }) => {
    await ack();
    if (shortcut.type !== 'message_action') {
      return;
    }
    const channelId = shortcut.channel.id;
    const rootTs = (shortcut.message as { thread_ts?: string }).thread_ts ?? shortcut.message_ts;

    try {
      // Join the channel so we can read its history (public channels only).
      await client.conversations.join({ channel: channelId }).catch(() => undefined);

      const replies = await client.conversations.replies({ channel: channelId, ts: rootTs, limit: 100 });
      const messages: ThreadMessage[] = await Promise.all(
        (replies.messages ?? []).map(async (message): Promise<ThreadMessage> => {
          const ts = message.ts ?? '';
          const permalink = await client.chat
            .getPermalink({ channel: channelId, message_ts: ts })
            .then((result) => result.permalink ?? '')
            .catch(() => '');
          return { userId: message.user ?? 'unknown', text: message.text ?? '', ts, channelId, permalink };
        }),
      );
      console.log(`[capture] shortcut on ${channelId}: ${messages.length} message(s)`);

      const proposal = await deps.detector.detect({ channelId, threadTs: rootTs, messages });
      if (proposal === null) {
        console.log('[capture] no decision detected');
        await client.chat.postEphemeral({
          channel: channelId,
          user: shortcut.user.id,
          text: "I couldn't spot a clear decision there — try a message with a commitment cue like “we're going with X”.",
        });
        return;
      }

      const reviewedProposal = suggestLifecycle(proposal, deps.ledger);
      const token = rememberProposal(pending, reviewedProposal);
      console.log(`[capture] proposal "${reviewedProposal.statement}" (token ${token})`);
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: rootTs,
        blocks: buildDecisionProposalCard(reviewedProposal, token, proposalCardContext(deps.ledger, reviewedProposal)),
        text: 'Log this decision?',
      });
    } catch (error) {
      console.error('[capture] shortcut failed:', error);
      await client.chat
        .postEphemeral({
          channel: channelId,
          user: shortcut.user.id,
          text: `Capture failed: ${safeErrorMessage(error)} Retry the shortcut on the source message, or run \`/precedent log\` in this channel.`,
        })
        .catch(() => undefined);
    }
  });

  // Confirm → append an immutable, cited record to the ledger.
  app.action(CONFIRM_ACTION, async ({ ack, body, action, respond }) => {
    await ack();
    const token = 'value' in action ? action.value : undefined;
    const proposal = token === undefined ? undefined : readProposal(pending, token);
    if (token === undefined || proposal === undefined) {
      await respond({ text: 'That proposal expired after 30 minutes. Return to the source message and choose *Log this decision* again.' });
      return;
    }

    const decidedAt = isoFromSlackTs(proposal.citations[0]?.ts) ?? new Date().toISOString();
    const confirmedBy = 'id' in body.user ? body.user.id : 'unknown';
    if (!hasValidProvenance(proposal)) {
      await respond({
        text: 'This proposal has no valid Slack source link, so it cannot be confirmed. Return to the source message and choose *Log this decision* again.',
      });
      return;
    }
    try {
      const record = deps.ledger.append(toDecisionContent(proposal, { decidedAt }), {
        confirmedBy,
        confidence: proposal.confidence,
      });
      pending.delete(token);
      console.log(`[capture] confirmed ${record.id}: "${record.content.statement}"`);
      await respond({ replace_original: true, text: `:white_check_mark: Logged to the decision ledger as \`${record.id}\`.` });
    } catch (error) {
      await respond({
        text: `Could not confirm this proposal: ${safeErrorMessage(error)} Open *Edit* and select the current decision it changes, or recapture from the source message.`,
      });
    }
  });

  app.action(EDIT_ACTION, async ({ ack, body, action, client, respond }) => {
    await ack();
    const token = 'value' in action ? action.value : undefined;
    const proposal = token === undefined ? undefined : readProposal(pending, token);
    const metadata = editMetadataFromActionBody(body);
    const triggerId = triggerIdFromActionBody(body);
    if (token === undefined || proposal === undefined || metadata === undefined || triggerId === undefined) {
      await respond({
        text: 'That proposal expired or cannot be edited from this message. Return to the source message and choose *Log this decision* again.',
      });
      return;
    }

    const selectableDecisions = editableDecisions(deps.ledger, proposal);
    await client.views.open({
      trigger_id: triggerId,
      view: buildEditDecisionModal(proposal, { token, ...metadata }, selectableDecisions),
    });
  });

  app.view(EDIT_MODAL_CALLBACK, async ({ ack, view, client }) => {
    const statement = textInputValue(view.state.values, EDIT_STATEMENT_BLOCK, EDIT_STATEMENT_ACTION).trim();
    if (statement.length === 0) {
      await ack({ response_action: 'errors', errors: { [EDIT_STATEMENT_BLOCK]: 'Add the one-line decision before saving.' } });
      return;
    }
    const decisionType = parseDecisionType(textInputValue(view.state.values, EDIT_TYPE_BLOCK, EDIT_TYPE_ACTION));
    if (decisionType === undefined) {
      await ack({
        response_action: 'errors',
        errors: { [EDIT_TYPE_BLOCK]: 'Use technical, process, policy, governance, product, or other.' },
      });
      return;
    }
    const selectedDecision = selectedOptionValue(view.state.values, EDIT_SUPERSEDES_BLOCK, EDIT_SUPERSEDES_ACTION);
    const supersedesId = selectedDecision === '__none__' ? '' : selectedDecision;
    if (supersedesId.length > 0 && deps.ledger.get(supersedesId) === undefined) {
      await ack({
        response_action: 'errors',
        errors: { [EDIT_SUPERSEDES_BLOCK]: 'That decision is no longer available. Close this modal and reopen Edit to refresh the list.' },
      });
      return;
    }
    const relationRaw = selectedOptionValue(view.state.values, EDIT_RELATION_BLOCK, EDIT_RELATION_ACTION);
    const supersessionType = parseSupersessionType(relationRaw);
    if (supersedesId.length > 0 && supersessionType === undefined) {
      await ack({ response_action: 'errors', errors: { [EDIT_RELATION_BLOCK]: 'Choose whether this replaces, reverses, or amends the earlier decision.' } });
      return;
    }

    const metadata = parseEditMetadata(view.private_metadata);
    const proposal = metadata === undefined ? undefined : readProposal(pending, metadata.token);
    if (metadata === undefined || proposal === undefined) {
      await ack({
        response_action: 'errors',
        errors: {
          [EDIT_STATEMENT_BLOCK]: 'This proposal expired. Close the modal, return to the source message, and choose Log this decision again.',
        },
      });
      return;
    }
    await ack();

    const scope = textInputValue(view.state.values, EDIT_SCOPE_BLOCK, EDIT_SCOPE_ACTION).trim();
    const { scope: _oldScope, supersedesId: _oldSupersedesId, supersessionType: _oldRelation, ...proposalBase } = proposal;
    const updated: DecisionProposal = {
      ...proposalBase,
      statement,
      rationale: textInputValue(view.state.values, EDIT_RATIONALE_BLOCK, EDIT_RATIONALE_ACTION).trim(),
      alternatives: parseAlternativesForEdit(
        textInputValue(view.state.values, EDIT_ALTERNATIVES_BLOCK, EDIT_ALTERNATIVES_ACTION),
      ),
      type: decisionType,
      decidedBy: parseUserIds(textInputValue(view.state.values, EDIT_DECIDERS_BLOCK, EDIT_DECIDERS_ACTION)),
      ...(scope.length > 0 ? { scope } : {}),
      ...(supersedesId.length > 0 ? { supersedesId, supersessionType: supersessionType ?? 'supersede' } : {}),
    };
    rememberProposal(pending, updated, metadata.token);
    await client.chat.update({
      channel: metadata.channelId,
      ts: metadata.messageTs,
      blocks: buildDecisionProposalCard(updated, metadata.token, proposalCardContext(deps.ledger, updated)),
      text: 'Log this decision?',
    });
  });

  app.action(DISMISS_ACTION, async ({ ack, action, respond }) => {
    await ack();
    const token = 'value' in action ? action.value : undefined;
    if (token !== undefined) {
      pending.delete(token);
    }
    await respond({ replace_original: true, text: 'Dismissed — no record kept.' });
  });

  // Mention recall keeps the interaction natural while preserving channel scope.
  app.event('app_mention', async ({ event, client }) => {
    const topic = event.text.replace(/<@[A-Z0-9]+>/gi, '').replace(/^\s*(?:why|what about)\s*/i, '').trim();
    if (topic.length === 0) {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts ?? event.ts,
        text: 'Ask me what was decided, for example: `@Precedent why primary datastore`.',
      });
      return;
    }
    const answer = recall(deps.ledger, topic, { channelIds: [event.channel] });
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts ?? event.ts,
      blocks: buildRecallAnswer(topic, answer),
      text: answer.current?.content.statement ?? `No recorded decision about ${topic}.`,
    });
  });

  // Ambient: watch channel messages for decisions to capture, and for settled
  // questions being relitigated. Precision-first — the detector only fires on an
  // explicit commitment, and the guard only on a clear question with a strong match.
  app.message(async ({ message, client }) => {
    const event = message as {
      subtype?: string;
      bot_id?: string;
      user?: string;
      text?: string;
      channel?: string;
      ts?: string;
      thread_ts?: string;
      channel_type?: string;
    };
    if (
      event.subtype !== undefined ||
      event.bot_id !== undefined ||
      (event.channel_type !== 'channel' && event.channel_type !== 'group')
    ) {
      return;
    }
    const text = (event.text ?? '').trim();
    const channelId = event.channel ?? '';
    const ts = event.ts ?? '';
    if (text.length < 12 || channelId === '' || ts === '') {
      return;
    }
    if (!rememberEvent(seenEvents, `${channelId}:${ts}`)) {
      return;
    }

    // 1) Relitigation guard: a settled question is being re-raised. Looser match
    //    (minOverlap 1) than `/precedent why` — this path already runs only on
    //    question/reopen phrasing, so a single distinctive decided term is enough.
    if (isQuestionOrReopen(text)) {
      const answer = recall(deps.ledger, text, { minOverlap: 1, channelIds: [channelId] });
      if (
        answer.decided &&
        answer.current !== undefined &&
        answer.current.content.citations.every((citation) => citation.ts !== ts)
      ) {
        console.log(`[guard] relitigation nudge: "${answer.current.content.statement}"`);
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: ts,
          blocks: buildRelitigationNudge(answer),
          text: 'This looks already decided.',
        });
        return;
      }
    }

    // 2) Ambient capture: this message just made a decision.
    if (!looksLikeDecision(text)) {
      return;
    }
    try {
      const threadTs = event.thread_ts;
      const messages =
        threadTs === undefined
          ? [{ userId: event.user ?? 'unknown', text, ts, channelId, permalink: await permalinkFor(client, channelId, ts) }]
          : await fetchThreadMessages(client, channelId, threadTs, ts);
      const proposal = await deps.detector.detect({ channelId, ...(threadTs !== undefined ? { threadTs } : {}), messages });
      if (proposal !== null) {
        const reviewedProposal = suggestLifecycle(proposal, deps.ledger);
        const token = rememberProposal(pending, reviewedProposal);
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: ts,
          blocks: buildDecisionProposalCard(reviewedProposal, token, proposalCardContext(deps.ledger, reviewedProposal)),
          text: 'Log this decision?',
        });
      }
    } catch (error) {
      console.error('[capture] ambient detection failed:', safeErrorMessage(error));
    }
  });

  // Home tab: a browsable ledger surface for all current decisions.
  app.event('app_home_opened', async ({ event, client }) => {
    if (event.tab !== 'home') {
      return;
    }
    const channelIds = await visibleChannelIds(client, event.user);
    const visibleDecisions = deps.ledger.currentDecisions().filter((record) => channelIds.has(record.content.channelId));
    await client.views.publish({
      user_id: event.user,
      view: { type: 'home', blocks: buildOnboardingBrief(visibleDecisions) },
    });
  });

  return app;
}

interface EditMessageMetadata {
  channelId: string;
  messageTs: string;
}

interface EditModalMetadata extends EditMessageMetadata {
  token: string;
}

interface ActionBodyWithMessage {
  trigger_id?: string;
  channel?: { id?: string };
  container?: { channel_id?: string; message_ts?: string };
}

type ViewStateValues = Record<
  string,
  Record<string, { value?: string | null; selected_option?: { value?: string } | null }>
>;

function triggerIdFromActionBody(body: unknown): string | undefined {
  return (body as ActionBodyWithMessage).trigger_id;
}

function editMetadataFromActionBody(body: unknown): EditMessageMetadata | undefined {
  const actionBody = body as ActionBodyWithMessage;
  const channelId = actionBody.container?.channel_id ?? actionBody.channel?.id;
  const messageTs = actionBody.container?.message_ts;
  if (channelId === undefined || messageTs === undefined) {
    return undefined;
  }
  return { channelId, messageTs };
}

function parseEditMetadata(raw: string | undefined): EditModalMetadata | undefined {
  if (raw === undefined || raw.length === 0) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<EditModalMetadata>;
    if (
      typeof parsed.token === 'string' &&
      typeof parsed.channelId === 'string' &&
      typeof parsed.messageTs === 'string'
    ) {
      return { token: parsed.token, channelId: parsed.channelId, messageTs: parsed.messageTs };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function textInputValue(values: ViewStateValues, blockId: string, actionId: string): string {
  return values[blockId]?.[actionId]?.value ?? '';
}

function selectedOptionValue(values: ViewStateValues, blockId: string, actionId: string): string {
  return values[blockId]?.[actionId]?.selected_option?.value ?? '';
}

function parseAlternativesForEdit(raw: string): Alternative[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [option, ...reasonParts] = line.split(/\s+-\s+/);
      const reason = reasonParts.join(' - ').trim();
      return {
        option: (option ?? '').trim(),
        reason: reason.length > 0 ? reason : 'Considered and not chosen in the source thread.',
      };
    })
    .filter((alternative) => alternative.option.length > 0);
}

function isQuestionOrReopen(text: string): boolean {
  return (
    /\?\s*$/.test(text) ||
    /\b(should we|shouldn'?t we|why (?:don'?t|not)|can we|what about|reconsider|reopen|revisit|are we still|do we still)\b/i.test(
      text,
    )
  );
}

async function permalinkFor(client: WebClient, channel: string, messageTs: string): Promise<string> {
  return client.chat
    .getPermalink({ channel, message_ts: messageTs })
    .then((result) => result.permalink ?? '')
    .catch(() => '');
}

function isoFromSlackTs(ts: string | undefined): string | undefined {
  if (ts === undefined) {
    return undefined;
  }
  const seconds = Number.parseFloat(ts);
  return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : undefined;
}

function rememberProposal(pending: PendingProposals, proposal: DecisionProposal, token: string = randomUUID()): string {
  const now = Date.now();
  for (const [candidate, entry] of pending) {
    if (entry.expiresAt <= now) {
      pending.delete(candidate);
    }
  }
  pending.set(token, { proposal, expiresAt: now + PENDING_TTL_MS });
  return token;
}

function readProposal(pending: PendingProposals, token: string): DecisionProposal | undefined {
  const entry = pending.get(token);
  if (entry === undefined) {
    return undefined;
  }
  if (entry.expiresAt <= Date.now()) {
    pending.delete(token);
    return undefined;
  }
  return entry.proposal;
}

function rememberEvent(seen: Map<string, number>, key: string): boolean {
  const now = Date.now();
  for (const [candidate, expiresAt] of seen) {
    if (expiresAt <= now) seen.delete(candidate);
  }
  if (seen.has(key)) return false;
  seen.set(key, now + EVENT_DEDUP_TTL_MS);
  return true;
}

function parseDecisionType(raw: string): DecisionType | undefined {
  const normalized = raw.trim().toLowerCase();
  return ['technical', 'process', 'policy', 'governance', 'product', 'other'].includes(normalized)
    ? (normalized as DecisionType)
    : undefined;
}

function parseSupersessionType(raw: string): SupersessionType | undefined {
  const normalized = raw.trim().toLowerCase();
  return ['supersede', 'reverse', 'amend'].includes(normalized) ? (normalized as SupersessionType) : undefined;
}

function parseUserIds(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,]+/)
        .map((value) => value.replace(/[<@>]/g, '').trim())
        .filter((value) => /^[UW][A-Z0-9]+$/.test(value)),
    ),
  ];
}

function hasValidProvenance(proposal: DecisionProposal): boolean {
  return proposal.citations.length > 0 && proposal.citations.every((citation) => {
    try {
      const url = new URL(citation.permalink);
      return url.protocol === 'https:' && (url.hostname === 'slack.com' || url.hostname.endsWith('.slack.com'));
    } catch {
      return false;
    }
  });
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  return /^(Cannot supersede|Decision .* is already superseded|Ledger is append-only)/.test(message)
    ? message
    : 'unexpected error; please try again';
}

function looksLikeDecision(text: string): boolean {
  return /\b(decid(?:e|ed)|agreed|going with|we(?:'ll| will)|adopt|drop|switch(?:ing)?|standardize|final call|ship|stick(?:ing)? with)\b/i.test(
    text.replace(/[\u2018\u2019]/g, "'"),
  );
}

function suggestLifecycle(proposal: DecisionProposal, ledger: Ledger): DecisionProposal {
  if (
    proposal.supersedesId !== undefined ||
    !/\b(instead of|switch(?:ing)?|replac(?:e|ing)|no longer|moving from|overturn|revers)\b/i.test(
      `${proposal.statement} ${proposal.rationale}`,
    )
  ) {
    return proposal;
  }
  for (const alternative of proposal.alternatives) {
    const answer = recall(ledger, alternative.option, { minOverlap: 1, channelIds: [proposal.channelId] });
    if (answer.decided && answer.current !== undefined) {
      // Language that explicitly moves away from an existing choice is a
      // reversal, not a generic replacement. This makes the lifecycle warning
      // match how a teammate naturally describes "switching from X to Y".
      const relation: SupersessionType = /\b(overturn|revers|no longer|instead of|switch(?:ing)?|moving from)\b/i.test(
        `${proposal.statement} ${proposal.rationale}`,
      )
        ? 'reverse'
        : 'supersede';
      return { ...proposal, supersedesId: answer.current.id, supersessionType: relation };
    }
  }
  return proposal;
}

function proposalCardContext(ledger: Ledger, proposal: DecisionProposal): { supersededDecision?: DecisionRecord } {
  const supersededDecision = proposal.supersedesId === undefined ? undefined : ledger.get(proposal.supersedesId);
  return supersededDecision === undefined ? {} : { supersededDecision };
}

function editableDecisions(ledger: Ledger, proposal: DecisionProposal): DecisionRecord[] {
  const current = ledger.currentDecisions().filter((record) => record.content.channelId === proposal.channelId);
  const selected = proposal.supersedesId === undefined ? undefined : ledger.get(proposal.supersedesId);
  if (selected !== undefined && !current.some((record) => record.id === selected.id)) {
    current.unshift(selected);
  }
  return current;
}

async function fetchThreadMessages(
  client: WebClient,
  channelId: string,
  threadTs: string,
  throughTs: string,
): Promise<ThreadMessage[]> {
  const replies = await client.conversations.replies({ channel: channelId, ts: threadTs, limit: 100 });
  return Promise.all(
    (replies.messages ?? [])
      .filter((message) => (message.ts ?? '') <= throughTs && (message.text ?? '').trim().length > 0)
      .map(async (message) => {
        const ts = message.ts ?? '';
        return {
          userId: message.user ?? 'unknown',
          text: message.text ?? '',
          ts,
          channelId,
          permalink: await permalinkFor(client, channelId, ts),
        };
      }),
  );
}

async function visibleChannelIds(client: WebClient, userId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let cursor: string | undefined;
  try {
    do {
      const response = await client.users.conversations({
        user: userId,
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 200,
        ...(cursor !== undefined ? { cursor } : {}),
      });
      for (const channel of response.channels ?? []) {
        if (channel.id !== undefined) {
          ids.add(channel.id);
        }
      }
      cursor = response.response_metadata?.next_cursor || undefined;
    } while (cursor !== undefined);
  } catch (error) {
    console.error('[home] could not resolve visible channels:', safeErrorMessage(error));
  }
  return ids;
}
