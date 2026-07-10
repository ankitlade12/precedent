import type { DecisionRecord } from '@precedent/ledger-core';
import type { DecisionAnswer, DecisionProposal, SourceMessage } from '@precedent/proposer';
import type { KnownBlock } from '@slack/types';
import type { View } from '@slack/types/dist/views';

/** Block action ids for the proposal card buttons. */
export const CONFIRM_ACTION = 'precedent_confirm';
export const EDIT_ACTION = 'precedent_edit';
export const DISMISS_ACTION = 'precedent_dismiss';
export const EDIT_MODAL_CALLBACK = 'precedent_edit_modal';
export const EDIT_STATEMENT_BLOCK = 'precedent_edit_statement';
export const EDIT_STATEMENT_ACTION = 'statement';
export const EDIT_RATIONALE_BLOCK = 'precedent_edit_rationale';
export const EDIT_RATIONALE_ACTION = 'rationale';
export const EDIT_ALTERNATIVES_BLOCK = 'precedent_edit_alternatives';
export const EDIT_ALTERNATIVES_ACTION = 'alternatives';
export const EDIT_DECIDERS_BLOCK = 'precedent_edit_deciders';
export const EDIT_DECIDERS_ACTION = 'deciders';
export const EDIT_TYPE_BLOCK = 'precedent_edit_type';
export const EDIT_TYPE_ACTION = 'decision_type';
export const EDIT_SCOPE_BLOCK = 'precedent_edit_scope';
export const EDIT_SCOPE_ACTION = 'scope';
export const EDIT_SUPERSEDES_BLOCK = 'precedent_edit_supersedes';
export const EDIT_SUPERSEDES_ACTION = 'supersedes_id';
export const EDIT_RELATION_BLOCK = 'precedent_edit_relation';
export const EDIT_RELATION_ACTION = 'supersession_type';

export interface EditDecisionModalMetadata {
  token: string;
  channelId: string;
  messageTs: string;
}

export interface BlockRenderContext {
  /** The existing record this proposal changes, when lifecycle matching found one. */
  supersededDecision?: DecisionRecord;
}

/**
 * The capture card: a single, unobtrusive Block Kit message posted at the moment a
 * decision is detected — "here's the decision I think was made; log it?" Dismissing
 * is one tap, which is what lets detection favor precision. `token` correlates the
 * buttons back to the pending proposal held by the app.
 */
export function buildDecisionProposalCard(
  proposal: DecisionProposal,
  token?: string,
  context: BlockRenderContext = {},
): KnownBlock[] {
  const alternatives =
    proposal.alternatives.length > 0
      ? proposal.alternatives.map((alt) => `• *${escapeMrkdwn(alt.option)}* — ${escapeMrkdwn(alt.reason)}`).join('\n')
      : '_None captured._';

  const value = token ?? '';
  const lifecycle = [
    proposal.type !== undefined ? `Type: *${proposal.type}*` : undefined,
    proposal.scope !== undefined ? `Scope: *${escapeMrkdwn(proposal.scope)}*` : undefined,
    proposal.supersedesId !== undefined
      ? `${proposal.supersessionType ?? 'supersede'}s: \`${proposal.supersedesId}\``
      : undefined,
  ].filter((part): part is string => part !== undefined);

  const blocks: KnownBlock[] = [];
  if (proposal.supersedesId !== undefined) {
    const relation = proposal.supersessionType ?? 'supersede';
    const relationLabel = relation === 'reverse' ? 'REVERSAL' : relation === 'amend' ? 'AMENDMENT' : 'REPLACEMENT';
    const oldStatement = context.supersededDecision?.content.statement ?? proposal.supersedesId;
    blocks.push(
      { type: 'header', text: { type: 'plain_text', text: `↪ ${relationLabel} proposed` } },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*This ${relation}s decision \`${proposal.supersedesId}\`*\n~${escapeMrkdwn(oldStatement)}~  →  *${escapeMrkdwn(proposal.statement)}*`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `${context.supersededDecision === undefined ? 'Existing decision' : formatDate(context.supersededDecision.content.decidedAt)} · ${relationLabel.toLowerCase()} pending human confirmation`,
          },
        ],
      },
      { type: 'divider' },
    );
  }
  blocks.push(
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*I think a decision was just made:*\n> ${escapeMrkdwn(proposal.statement)}` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Rationale*\n${proposal.rationale ? escapeMrkdwn(proposal.rationale) : '_n/a_'}` },
        { type: 'mrkdwn', text: `*Decided by*\n${formatUsers(proposal.decidedBy)}` },
      ],
    },
    { type: 'section', text: { type: 'mrkdwn', text: `*Rejected alternatives*\n${alternatives}` } },
  );
  if (lifecycle.length > 0) {
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: lifecycle.join(' · ') }] });
  }
  blocks.push(
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Confidence ${(proposal.confidence * 100).toFixed(0)}% · grounded in ${proposal.citations.length} message(s)`,
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        { type: 'button', style: 'primary', text: { type: 'plain_text', text: 'Confirm' }, action_id: CONFIRM_ACTION, value },
        { type: 'button', text: { type: 'plain_text', text: 'Edit' }, action_id: EDIT_ACTION, value },
        { type: 'button', style: 'danger', text: { type: 'plain_text', text: 'Dismiss' }, action_id: DISMISS_ACTION, value },
      ],
    },
  );
  return blocks;
}

/** Modal for correcting the proposal before it is confirmed into the immutable ledger. */
export function buildEditDecisionModal(
  proposal: DecisionProposal,
  metadata: EditDecisionModalMetadata,
  decisions: readonly DecisionRecord[] = [],
): View {
  const decisionOptions = [
    { text: { type: 'plain_text' as const, text: 'No earlier decision' }, value: '__none__' },
    ...decisions.slice(0, 99).map((decision) => ({
      text: {
        type: 'plain_text' as const,
        text: truncate(`${formatPlainDate(decision.content.decidedAt)} · ${decision.content.statement}`, 75),
      },
      value: decision.id,
    })),
  ];
  const initialDecision = decisionOptions.find((option) => option.value === proposal.supersedesId) ?? decisionOptions[0]!;
  const relationOptions = [
    { text: { type: 'plain_text' as const, text: 'Replaces the earlier decision' }, value: 'supersede' },
    { text: { type: 'plain_text' as const, text: 'Reverses the earlier decision' }, value: 'reverse' },
    { text: { type: 'plain_text' as const, text: 'Amends the earlier decision' }, value: 'amend' },
  ];
  const initialRelation = relationOptions.find((option) => option.value === proposal.supersessionType) ?? relationOptions[0]!;
  return {
    type: 'modal',
    callback_id: EDIT_MODAL_CALLBACK,
    private_metadata: JSON.stringify(metadata),
    title: { type: 'plain_text', text: 'Edit decision' },
    submit: { type: 'plain_text', text: 'Save' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: EDIT_STATEMENT_BLOCK,
        label: { type: 'plain_text', text: 'Decision' },
        element: {
          type: 'plain_text_input',
          action_id: EDIT_STATEMENT_ACTION,
          initial_value: proposal.statement,
          max_length: 240,
        },
      },
      {
        type: 'input',
        block_id: EDIT_RATIONALE_BLOCK,
        label: { type: 'plain_text', text: 'Rationale' },
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: EDIT_RATIONALE_ACTION,
          initial_value: proposal.rationale,
          multiline: true,
          max_length: 2000,
        },
      },
      {
        type: 'input',
        block_id: EDIT_ALTERNATIVES_BLOCK,
        label: { type: 'plain_text', text: 'Rejected alternatives' },
        hint: { type: 'plain_text', text: 'One per line: option - reason' },
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: EDIT_ALTERNATIVES_ACTION,
          initial_value: formatAlternativesForEdit(proposal),
          multiline: true,
          max_length: 2000,
        },
      },
      {
        type: 'input',
        block_id: EDIT_TYPE_BLOCK,
        label: { type: 'plain_text', text: 'Type' },
        hint: { type: 'plain_text', text: 'technical, process, policy, governance, product, or other' },
        element: {
          type: 'plain_text_input',
          action_id: EDIT_TYPE_ACTION,
          initial_value: proposal.type ?? 'other',
          max_length: 20,
        },
      },
      {
        type: 'input',
        block_id: EDIT_DECIDERS_BLOCK,
        label: { type: 'plain_text', text: 'Decider Slack IDs' },
        hint: { type: 'plain_text', text: 'Comma-separated IDs, for example U123, U456' },
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: EDIT_DECIDERS_ACTION,
          initial_value: proposal.decidedBy.join(', '),
          max_length: 500,
        },
      },
      {
        type: 'input',
        block_id: EDIT_SCOPE_BLOCK,
        label: { type: 'plain_text', text: 'Scope' },
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: EDIT_SCOPE_ACTION,
          initial_value: proposal.scope ?? '',
          max_length: 100,
        },
      },
      {
        type: 'input',
        block_id: EDIT_SUPERSEDES_BLOCK,
        label: { type: 'plain_text', text: 'Does this change an earlier decision?' },
        element: {
          type: 'static_select',
          action_id: EDIT_SUPERSEDES_ACTION,
          options: decisionOptions,
          initial_option: initialDecision,
        },
      },
      {
        type: 'input',
        block_id: EDIT_RELATION_BLOCK,
        label: { type: 'plain_text', text: 'Change relationship' },
        element: {
          type: 'static_select',
          action_id: EDIT_RELATION_ACTION,
          options: relationOptions,
          initial_option: initialRelation,
        },
      },
    ],
  };
}

/**
 * The recall answer, with receipts: the current decision, the rationale, the
 * rejected alternatives, who decided, a supersession warning when relevant, and
 * links to the exact source messages.
 */
export function buildRecallAnswer(topic: string, answer: DecisionAnswer): KnownBlock[] {
  if (!answer.decided || answer.current === undefined) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `I don't have a recorded decision about *${escapeMrkdwn(topic)}* yet.\n_Run \`/precedent log\` in the source channel, or use the message shortcut to capture it._`,
        },
      },
    ];
  }

  const current = answer.current;
  const blocks: KnownBlock[] = [
    { type: 'header', text: { type: 'plain_text', text: 'Current precedent' } },
    { type: 'section', text: { type: 'mrkdwn', text: `*Current decision:* ${escapeMrkdwn(current.content.statement)}` } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Why*\n${current.content.rationale ? escapeMrkdwn(current.content.rationale) : '_n/a_'}` },
        {
          type: 'mrkdwn',
          text: `*Decided by*\n${formatUsers(current.content.decidedBy)}\n_${formatDate(current.content.decidedAt)}_`,
        },
      ],
    },
  ];

  if (current.content.alternatives.length > 0) {
    const rejected = current.content.alternatives
      .map((alt) => `• *${escapeMrkdwn(alt.option)}* — ${escapeMrkdwn(alt.reason)}`)
      .join('\n');
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Rejected*\n${rejected}` } });
  }

  if (answer.wasSuperseded) {
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `:warning: This overturned an earlier call — ${answer.history.length} versions on record.` },
      ],
    });
    const timeline = answer.history
      .map((record, index) => {
        const next = answer.history[index + 1];
        const status =
          next === undefined
            ? 'current'
            : next.content.supersessionType === 'reverse'
              ? 'reversed'
              : next.content.supersessionType === 'amend'
                ? 'amended'
                : 'replaced';
        return `${formatDate(record.content.decidedAt)} · *${escapeMrkdwn(record.content.statement)}*\n_${status} · by ${formatUsers(record.content.decidedBy)} · ${record.id}_`;
      })
      .join('\n         ↓\n');
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Decision timeline*\n${timeline}` } });
  }

  const receipts = current.content.citations
    .map((citation, index) => sourceLink(citation.permalink, `source ${index + 1}`))
    .filter((link) => link.length > 0)
    .join(' · ');
  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: receipts.length > 0 ? `Receipts: ${receipts} · \`${current.id}\`` : `\`${current.id}\`` },
    ],
  });

  return blocks;
}

/**
 * On a recall miss, offer the likely source threads found via the Real-Time Search
 * API so the user can capture a decision that predates the ledger.
 */
export function buildBackfillPrompt(topic: string, candidates: SourceMessage[]): KnownBlock[] {
  if (candidates.length === 0) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `I don't have a recorded decision about *${escapeMrkdwn(topic)}* yet, and I couldn't find a likely source thread.\n_Try a more specific topic, or open the source message and choose *Log this decision*._`,
        },
      },
    ];
  }

  const list = candidates
    .slice(0, 5)
    .map((candidate, index) => {
      const link = sourceLink(candidate.permalink, 'source');
      return `${index + 1}. ${link.length > 0 ? link : 'source'} — ${escapeMrkdwn(truncate(candidate.text, 140))}`;
    })
    .join('\n');

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `I don't have a *logged* decision about *${escapeMrkdwn(topic)}* yet — but these threads look relevant. Open one and use the *Log this decision* shortcut to capture it:`,
      },
    },
    { type: 'section', text: { type: 'mrkdwn', text: list } },
  ];
}

/**
 * The relitigation guard: when a settled question resurfaces, surface the current
 * decision in-thread so the team doesn't re-debate it. This is the feature that
 * stops the waste at the source.
 */
export function buildRelitigationNudge(answer: DecisionAnswer): KnownBlock[] {
  if (!answer.decided || answer.current === undefined) {
    return [];
  }
  const current = answer.current;
  const receipt = sourceLink(current.content.citations[0]?.permalink, 'source');
  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:memo: Heads up — this looks settled. The team decided: *${escapeMrkdwn(current.content.statement)}*${receipt ? ` (${receipt})` : ''}`,
      },
    },
  ];
  if (answer.wasSuperseded) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `This is the current call — ${answer.history.length} versions on record.` }],
    });
  }
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: 'Ask `/precedent why …` for the full rationale and alternatives.' }],
  });
  return blocks;
}

/** A newcomer's onboarding brief: the current decisions a new contributor should know. */
export function buildOnboardingBrief(decisions: DecisionRecord[]): KnownBlock[] {
  if (decisions.length === 0) {
    return [
      { type: 'header', text: { type: 'plain_text', text: 'Build your team’s decision memory' } },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Precedent is ready. Capture one real decision to turn this Home tab into a living, source-grounded ledger.',
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*1 · Make a decision in a channel*\nTry: _“We’re going with Postgres over DynamoDB because relational integrity matters.”_',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*2 · Review the proposal card*\nConfirm it, edit the extracted rationale, or dismiss it. Nothing enters the ledger without a human.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*3 · Recall it anywhere*\nUse `/precedent why <topic>` or ask Slackbot to check Precedent before acting.',
        },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: 'Manual fallback: open any source message → More actions → *Log this decision*.' }],
      },
    ];
  }
  const lines = decisions
    .slice(0, 20)
    .map((decision) => {
      const link = sourceLink(decision.content.citations[0]?.permalink, '↗');
      return `• *${escapeMrkdwn(decision.content.statement)}* — _${decision.content.type} · ${formatDate(decision.content.decidedAt)}_${link ? ` ${link}` : ''}`;
    })
    .join('\n');
  return [
    { type: 'header', text: { type: 'plain_text', text: 'Community decision memory' } },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Context survives maintainer turnover, so newcomers can participate without unknowingly reopening settled work.',
        },
      ],
    },
    { type: 'section', text: { type: 'mrkdwn', text: '*Decisions a new contributor should know*' } },
    { type: 'section', text: { type: 'mrkdwn', text: lines } },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `${decisions.length} current decision(s) · ask \`/precedent why <topic>\` for the rationale` },
      ],
    },
  ];
}

/**
 * A Slack link to a source message — or '' when there is no *real* permalink to link to
 * (empty, non-https, or outside Slack). Callers omit the receipt in that case
 * rather than render a dead link.
 */
function sourceLink(permalink: string | undefined, label: string): string {
  if (typeof permalink !== 'string') return '';
  try {
    const url = new URL(permalink);
    const isSlack = url.hostname === 'slack.com' || url.hostname.endsWith('.slack.com');
    return url.protocol === 'https:' && isSlack ? `<${permalink}|${label}>` : '';
  } catch {
    return '';
  }
}

function formatUsers(userIds: string[]): string {
  const validIds = userIds.filter((id) => /^[UW][A-Z0-9]+$/.test(id));
  return validIds.length > 0 ? validIds.map((id) => `<@${id}>`).join(', ') : '_unknown_';
}

function formatAlternativesForEdit(proposal: DecisionProposal): string {
  return proposal.alternatives.map((alt) => `${alt.option} - ${alt.reason}`).join('\n');
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return escapeMrkdwn(iso);

  const fallback = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(date);
  const epochSeconds = Math.floor(date.getTime() / 1000);
  // Slack renders this in each viewer's own timezone; the fallback keeps the
  // receipt understandable in exports and clients that do not expand tokens.
  return `<!date^${epochSeconds}^{date_short_pretty} at {time}|${fallback}>`;
}

function formatPlainDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(date);
}

function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
