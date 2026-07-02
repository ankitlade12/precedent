import { randomUUID } from 'node:crypto';

import type { Ledger } from '@precedent/ledger-core';
import { type DecisionProposal, type Detector, recall, type ThreadMessage, toDecisionContent } from '@precedent/proposer';
import { App } from '@slack/bolt';

import {
  buildBackfillPrompt,
  buildDecisionProposalCard,
  buildRecallAnswer,
  CONFIRM_ACTION,
  DISMISS_ACTION,
  EDIT_ACTION,
} from './blocks';
import { createRtsSearchClient } from './rts';

export interface SlackAppConfig {
  token: string;
  appToken: string;
  signingSecret: string;
}

export interface SlackAppDeps {
  ledger: Ledger;
  detector: Detector;
}

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

  const pending = new Map<string, DecisionProposal>();

  // `/precedent why <topic>` — structured recall; RTS backfill on a miss.
  app.command('/precedent', async ({ command, ack, respond, client }) => {
    await ack();
    const [subcommand, ...rest] = command.text.trim().split(/\s+/);
    const topic = rest.join(' ');

    if (subcommand === 'why' && topic.length > 0) {
      const answer = recall(deps.ledger, topic);
      if (answer.decided) {
        await respond({ blocks: buildRecallAnswer(topic, answer) });
        return;
      }
      try {
        const candidates = await createRtsSearchClient(client).searchContext(topic);
        await respond({ blocks: buildBackfillPrompt(topic, candidates) });
      } catch {
        await respond({ blocks: buildRecallAnswer(topic, answer) });
      }
      return;
    }
    await respond('Usage: `/precedent why <topic>` — ask what the team decided, with the receipts.');
  });

  // Message shortcut: capture a decision from a thread.
  app.shortcut('log_decision', async ({ shortcut, ack, client }) => {
    await ack();
    if (shortcut.type !== 'message_action') {
      return;
    }
    const channelId = shortcut.channel.id;
    const rootTs = (shortcut.message as { thread_ts?: string }).thread_ts ?? shortcut.message_ts;

    const replies = await client.conversations.replies({ channel: channelId, ts: rootTs, limit: 100 });
    const messages: ThreadMessage[] = await Promise.all(
      (replies.messages ?? []).map(async (message): Promise<ThreadMessage> => {
        const ts = message.ts ?? '';
        const link = await client.chat.getPermalink({ channel: channelId, message_ts: ts });
        return { userId: message.user ?? 'unknown', text: message.text ?? '', ts, channelId, permalink: link.permalink ?? '' };
      }),
    );

    const proposal = await deps.detector.detect({ channelId, threadTs: rootTs, messages });
    if (proposal === null) {
      await client.chat.postEphemeral({
        channel: channelId,
        user: shortcut.user.id,
        text: "I couldn't spot a clear decision in that thread. Use `/precedent why …` to search, or capture one by hand.",
      });
      return;
    }

    const token = randomUUID();
    pending.set(token, proposal);
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: rootTs,
      blocks: buildDecisionProposalCard(proposal, token),
      text: 'Log this decision?',
    });
  });

  // Confirm → append an immutable, cited record to the ledger.
  app.action(CONFIRM_ACTION, async ({ ack, body, action, respond }) => {
    await ack();
    const token = 'value' in action ? action.value : undefined;
    const proposal = token === undefined ? undefined : pending.get(token);
    if (token === undefined || proposal === undefined) {
      await respond({ text: 'That proposal has expired — re-run the capture.' });
      return;
    }

    const decidedAt = isoFromSlackTs(proposal.citations[0]?.ts) ?? new Date().toISOString();
    const confirmedBy = 'id' in body.user ? body.user.id : 'unknown';
    const record = deps.ledger.append(toDecisionContent(proposal, { decidedAt }), {
      confirmedBy,
      confidence: proposal.confidence,
    });
    pending.delete(token);
    await respond({ replace_original: true, text: `:white_check_mark: Logged to the decision ledger as \`${record.id}\`.` });
  });

  app.action(EDIT_ACTION, async ({ ack }) => {
    await ack();
    // TODO: open a modal pre-filled with the proposal for inline editing.
  });

  app.action(DISMISS_ACTION, async ({ ack, action, respond }) => {
    await ack();
    const token = 'value' in action ? action.value : undefined;
    if (token !== undefined) {
      pending.delete(token);
    }
    await respond({ replace_original: true, text: 'Dismissed — no record kept.' });
  });

  return app;
}

function isoFromSlackTs(ts: string | undefined): string | undefined {
  if (ts === undefined) {
    return undefined;
  }
  const seconds = Number.parseFloat(ts);
  return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : undefined;
}
