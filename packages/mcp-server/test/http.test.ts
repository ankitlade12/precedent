import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verifySlackSignature } from '../src/http';

function signedHeaders(secret: string, timestamp: number, body: string): Record<string, string> {
  return {
    'x-slack-request-timestamp': String(timestamp),
    'x-slack-signature': `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`,
  };
}

describe('verifySlackSignature', () => {
  const secret = 'signing-secret';
  const now = 1_800_000_000;
  const body = '{"jsonrpc":"2.0","method":"tools/list"}';

  it('accepts an authentic Slackbot MCP request', () => {
    expect(verifySlackSignature(secret, signedHeaders(secret, now, body), body, now)).toBe(true);
  });

  it('rejects tampering and replayed requests', () => {
    expect(verifySlackSignature(secret, signedHeaders(secret, now, body), `${body} `, now)).toBe(false);
    expect(verifySlackSignature(secret, signedHeaders(secret, now - 301, body), body, now)).toBe(false);
  });
});
