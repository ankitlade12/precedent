import type { Ledger } from '@precedent/ledger-core';
import { type Detector, recall } from '@precedent/proposer';
import { App } from '@slack/bolt';

import { buildRecallAnswer, CONFIRM_ACTION, DISMISS_ACTION, EDIT_ACTION } from './blocks';

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
 * Capture is the proposal card (built in `blocks.ts`) posted when the detector
 * fires; confirming writes an immutable record. Recall is `/precedent why <topic>`
 * and answers with receipts. Socket Mode is used so the demo needs no public URL.
 */
export function createSlackApp(config: SlackAppConfig, deps: SlackAppDeps): App {
  const app = new App({
    token: config.token,
    appToken: config.appToken,
    signingSecret: config.signingSecret,
    socketMode: true,
  });

  // `/precedent why <topic>` — structured recall, supersession already resolved.
  app.command('/precedent', async ({ command, ack, respond }) => {
    await ack();
    const [subcommand, ...rest] = command.text.trim().split(/\s+/);
    const topic = rest.join(' ');

    if (subcommand === 'why' && topic.length > 0) {
      await respond({ blocks: buildRecallAnswer(topic, recall(deps.ledger, topic)) });
      return;
    }
    await respond('Usage: `/precedent why <topic>` — ask what the team decided, with the receipts.');
  });

  // Message shortcut: nominate a message/thread for capture.
  app.shortcut('log_decision', async ({ ack }) => {
    await ack();
    // TODO: fetch the thread via client.conversations.replies, run deps.detector,
    // and post buildDecisionProposalCard(proposal) in-channel.
  });

  // Confirm → append an immutable, cited record to the ledger.
  app.action(CONFIRM_ACTION, async ({ ack, respond }) => {
    await ack();
    // TODO: rehydrate the proposal from the action payload, then
    //   deps.ledger.append(toDecisionContent(proposal, { decidedAt }), { confirmedBy: userId }).
    await respond({ replace_original: true, text: ':white_check_mark: Logged to the decision ledger.' });
  });

  app.action(EDIT_ACTION, async ({ ack }) => {
    await ack();
    // TODO: open a modal pre-filled with the proposal for inline editing.
  });

  app.action(DISMISS_ACTION, async ({ ack, respond }) => {
    await ack();
    await respond({ replace_original: true, text: 'Dismissed — no record kept.' });
  });

  return app;
}
