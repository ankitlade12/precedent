import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

export interface McpHttpHandle {
  port: number;
  close: () => Promise<void>;
}

export interface McpHttpOptions {
  port: number;
  path?: string;
  /** Optional bearer token required on every request. */
  bearerToken?: string;
  /** Accept requests signed by Slackbot's MCP client using this signing secret. */
  slackSigningSecret?: string;
}

export interface McpRequestContext {
  authSource: 'slack_signature' | 'bearer';
}

const MAX_REQUEST_BYTES = 1024 * 1024;
const MAX_SESSIONS = 100;

/**
 * Serve an MCP server over Streamable HTTP so any agent in the workspace can reach
 * `/mcp`. Uses the canonical session-based pattern: the client's `initialize`
 * mints a session and its own transport (and a fresh {@link McpServer} from the
 * factory); later requests reuse it by `mcp-session-id`. This lets the whole
 * product run as one process on one port, alongside the Slack app.
 *
 * @param serverFactory builds a fresh MCP server per session (all sharing the same ledger).
 */
export async function startMcpHttp(
  serverFactory: (context: McpRequestContext) => McpServer,
  options: McpHttpOptions,
): Promise<McpHttpHandle> {
  const path = options.path ?? '/mcp';
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer((req: IncomingMessage, res: ServerResponse): void => {
    route(req, res).catch((error: unknown) => {
      if (res.headersSent) {
        res.end();
      } else {
        respondError(res, error instanceof Error ? error.message : 'Bad request');
      }
    });
  });

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestPath = req.url === undefined ? undefined : new URL(req.url, 'http://localhost').pathname;
    if (requestPath !== path) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const rawBody = req.method === 'POST' ? await readBody(req) : '';
    const bearerAuthorized =
      options.bearerToken !== undefined && headerValue(req, 'authorization') === `Bearer ${options.bearerToken}`;
    const slackAuthorized =
      options.slackSigningSecret !== undefined && verifySlackSignature(options.slackSigningSecret, req.headers, rawBody);
    if (!bearerAuthorized && !slackAuthorized) {
      res.statusCode = 401;
      res.end('Unauthorized. Use the configured bearer token or a valid Slack-signed request.');
      return;
    }

    const sessionId = headerValue(req, 'mcp-session-id');

    if (req.method === 'POST') {
      const body = rawBody.length > 0 ? JSON.parse(rawBody) : undefined;
      // Slackbot's signed no-auth connector follows Slack's stateless MCP pattern:
      // create a fresh server/transport for each POST. Bearer clients retain the
      // session-based transport below for streaming and multi-request sessions.
      if (slackAuthorized && !bearerAuthorized) {
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await serverFactory({ authSource: 'slack_signature' }).connect(transport);
        await transport.handleRequest(req, res, body);
        return;
      }
      let transport = sessionId === undefined ? undefined : transports.get(sessionId);
      if (transport === undefined && isInitializeRequest(body)) {
        if (transports.size >= MAX_SESSIONS) {
          res.statusCode = 503;
          res.end('Too many active sessions');
          return;
        }
        transport = openSession();
      }
      if (transport === undefined) {
        respondError(res, 'No valid session. Send an initialize request first, then retry with its mcp-session-id.');
        return;
      }
      await transport.handleRequest(req, res, body);
      return;
    }

    // GET (server-to-client stream) and DELETE (end session) reuse the session transport.
    const transport = sessionId === undefined ? undefined : transports.get(sessionId);
    if (transport === undefined) {
      respondError(res, 'Unknown or missing session. Initialize a new MCP session and retry.');
      return;
    }
    if (req.method !== 'GET' && req.method !== 'DELETE') {
      res.statusCode = 405;
      res.setHeader('allow', 'GET, POST, DELETE');
      res.end('Method not allowed');
      return;
    }
    await transport.handleRequest(req, res);
  }

  function openSession(): StreamableHTTPServerTransport {
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports.set(id, transport);
      },
    });
    transport.onclose = () => {
      if (transport.sessionId !== undefined) {
        transports.delete(transport.sessionId);
      }
    };
    void serverFactory({ authSource: 'bearer' }).connect(transport);
    return transport;
  }

  await new Promise<void>((resolve) => {
    httpServer.listen(options.port, resolve);
  });
  const actualPort = (httpServer.address() as AddressInfo).port;

  return {
    port: actualPort,
    close: () =>
      new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function respondError(res: ServerResponse, message: string): void {
  res.statusCode = 400;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }));
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_REQUEST_BYTES) {
      throw new Error('Request body exceeds 1 MiB limit.');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Verify Slack's v0 request signature and reject timestamps older than five minutes. */
export function verifySlackSignature(
  signingSecret: string,
  headers: IncomingMessage['headers'],
  rawBody: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const timestamp = singleHeader(headers['x-slack-request-timestamp']);
  const signature = singleHeader(headers['x-slack-signature']);
  if (timestamp === undefined || signature === undefined || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > 5 * 60) return false;
  const expected = `v0=${createHmac('sha256', signingSecret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(signature);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
