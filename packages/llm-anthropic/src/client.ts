import Anthropic from '@anthropic-ai/sdk';
import type { DecisionProposal, LlmClient, ThreadContext } from '@precedent/proposer';
import { z } from 'zod';

type Citation = DecisionProposal['citations'][number];

const ExtractionSchema = z.object({
  decisionMade: z.boolean(),
  statement: z.string(),
  rationale: z.string(),
  alternatives: z.array(z.object({ option: z.string(), reason: z.string() })),
  deciderIds: z.array(z.string()),
  sourceTs: z.array(z.string()),
  confidence: z.number(),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

/** JSON Schema handed to the model via structured outputs (mirror of ExtractionSchema). */
const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    decisionMade: { type: 'boolean' },
    statement: { type: 'string' },
    rationale: { type: 'string' },
    alternatives: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { option: { type: 'string' }, reason: { type: 'string' } },
        required: ['option', 'reason'],
      },
    },
    deciderIds: { type: 'array', items: { type: 'string' } },
    sourceTs: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' },
  },
  required: ['decisionMade', 'statement', 'rationale', 'alternatives', 'deciderIds', 'sourceTs', 'confidence'],
};

const SYSTEM_PROMPT = `You extract *decisions* from Slack threads for a decision ledger.
A decision is a concrete commitment the team made — "we're going with X", "we decided Y", "we're dropping Z" — not open discussion, a question, or a loose suggestion.
From the thread, determine whether a decision was made and, if so, extract:
- the decision as one clear line,
- the rationale (why), grounded in what was actually said,
- the alternatives that were considered and rejected, each with the reason it lost,
- the Slack user IDs of the people who made the call,
- the ts values of the messages that most directly evidence the decision,
- a confidence in [0,1].
Favor precision: if there is no clear commitment, set decisionMade to false. Never invent a rationale or an alternative that the messages do not support.`;

export interface AnthropicLlmClientOptions {
  apiKey?: string;
  model?: string;
}

/**
 * The production decision detector's backend: extracts a structured decision
 * proposal from a thread using Claude (structured outputs via a JSON schema on
 * `messages.create`). What it returns is still a *proposal* a human confirms —
 * the deterministic ledger never trusts it directly.
 */
export class AnthropicLlmClient implements LlmClient {
  readonly #client: Anthropic;
  readonly #model: string;

  constructor(options: AnthropicLlmClientOptions = {}) {
    this.#client = new Anthropic(options.apiKey !== undefined ? { apiKey: options.apiKey } : {});
    this.#model = options.model ?? 'claude-opus-4-8';
  }

  async proposeDecision(context: ThreadContext): Promise<DecisionProposal | null> {
    if (context.messages.length === 0) {
      return null;
    }
    const transcript = context.messages
      .map((message) => `[${message.ts}] <${message.userId}>: ${message.text}`)
      .join('\n');

    const response = await this.#client.messages.create({
      model: this.#model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: JSON_SCHEMA } },
      messages: [{ role: 'user', content: `Thread:\n${transcript}` }],
    });

    const text = response.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
    try {
      const parsed = ExtractionSchema.safeParse(JSON.parse(text));
      return parsed.success ? toProposal(parsed.data, context) : null;
    } catch {
      return null;
    }
  }
}

/** Map a validated model extraction onto a grounded DecisionProposal (pure and testable). */
export function toProposal(extraction: Extraction, context: ThreadContext): DecisionProposal | null {
  if (!extraction.decisionMade || extraction.confidence < 0.4 || extraction.statement.trim() === '') {
    return null;
  }

  const byTs = new Map(context.messages.map((message) => [message.ts, message]));
  const cited: Citation[] = extraction.sourceTs
    .map((ts) => byTs.get(ts))
    .filter((message): message is (typeof context.messages)[number] => message !== undefined)
    .map((message) => ({ permalink: message.permalink, channelId: message.channelId, ts: message.ts, authorId: message.userId }));

  // Always ground on a real message: if the model's cited ts don't resolve, use the last message.
  const last = context.messages[context.messages.length - 1];
  const citations: Citation[] =
    cited.length > 0
      ? cited
      : last !== undefined
        ? [{ permalink: last.permalink, channelId: last.channelId, ts: last.ts, authorId: last.userId }]
        : [];

  return {
    statement: extraction.statement.trim(),
    rationale: extraction.rationale.trim(),
    alternatives: extraction.alternatives,
    decidedBy: extraction.deciderIds.length > 0 ? extraction.deciderIds : last !== undefined ? [last.userId] : [],
    citations,
    channelId: context.channelId,
    ...(context.threadTs !== undefined ? { threadTs: context.threadTs } : {}),
    confidence: extraction.confidence,
  };
}
