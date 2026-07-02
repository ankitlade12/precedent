import type { SearchClient, SourceMessage } from '@precedent/proposer';
import type { WebClient } from '@slack/web-api';

interface RtsResultMessage {
  permalink?: string;
  channel_id?: string;
  channel?: string;
  ts?: string;
  text?: string;
}

/**
 * The Real-Time Search backfill adapter: implements the proposer's `SearchClient`
 * port against Slack's `assistant.search.context` method. Used to find likely
 * source threads for decisions older than the ledger, so recall can offer to
 * create a record on a miss (day one is useful, not an empty database).
 *
 * Called via `apiCall` so it works regardless of the installed web-api SDK's
 * method coverage. NOTE: the response shape below is defensive — verify the exact
 * field names against the live API once a Slack AI–enabled sandbox is available.
 */
export function createRtsSearchClient(client: WebClient): SearchClient {
  return {
    async searchContext(query: string): Promise<SourceMessage[]> {
      const response = (await client.apiCall('assistant.search.context', {
        query,
        // Phrase the query as a natural-language question to trigger semantic search
        // (falls back to keyword search on non–AI-enabled workspaces).
      })) as { results?: { messages?: RtsResultMessage[] }; messages?: RtsResultMessage[] };

      const messages = response.results?.messages ?? response.messages ?? [];
      return messages.map((message) => ({
        permalink: message.permalink ?? '',
        channelId: message.channel_id ?? message.channel ?? '',
        ts: message.ts ?? '',
        text: message.text ?? '',
      }));
    },
  };
}
