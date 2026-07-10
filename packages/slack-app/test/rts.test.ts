import type { WebClient } from '@slack/web-api';
import { describe, expect, it, vi } from 'vitest';

import { createRtsSearchClient } from '../src/rts';

describe('createRtsSearchClient', () => {
  it('maps nested assistant.search.context results defensively', async () => {
    const apiCall = vi.fn().mockResolvedValue({
      results: {
        messages: [
          {
            permalink: 'https://acme.slack.com/archives/C1/p1',
            channel_id: 'C1',
            ts: '1.1',
            text: 'We decided to use SQLite.',
          },
        ],
      },
    });
    const client = { apiCall } as unknown as WebClient;

    await expect(createRtsSearchClient(client).searchContext('database')).resolves.toEqual([
      {
        permalink: 'https://acme.slack.com/archives/C1/p1',
        channelId: 'C1',
        ts: '1.1',
        text: 'We decided to use SQLite.',
      },
    ]);
    expect(apiCall).toHaveBeenCalledWith('assistant.search.context', { query: 'database' });
  });

  it('accepts a flat results array and drops unusable messages', async () => {
    const client = {
      apiCall: vi.fn().mockResolvedValue({
        results: [
          { channel: 'C2', ts: '2.2', text: 'Use pnpm.' },
          { channel: 'C2', ts: '', text: 'Missing timestamp.' },
        ],
      }),
    } as unknown as WebClient;
    await expect(createRtsSearchClient(client).searchContext('package manager')).resolves.toHaveLength(1);
  });
});
