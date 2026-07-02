import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

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
}

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
  serverFactory: () => McpServer,
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
    if (req.url === undefined || !req.url.startsWith(path)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    if (options.bearerToken !== undefined && req.headers.authorization !== `Bearer ${options.bearerToken}`) {
      res.statusCode = 401;
      res.end('Unauthorized');
      return;
    }

    const sessionId = headerValue(req, 'mcp-session-id');

    if (req.method === 'POST') {
      const body = await readJson(req);
      let transport = sessionId === undefined ? undefined : transports.get(sessionId);
      if (transport === undefined && isInitializeRequest(body)) {
        transport = openSession();
      }
      if (transport === undefined) {
        respondError(res, 'No valid session; send an initialize request first.');
        return;
      }
      await transport.handleRequest(req, res, body);
      return;
    }

    // GET (server-to-client stream) and DELETE (end session) reuse the session transport.
    const transport = sessionId === undefined ? undefined : transports.get(sessionId);
    if (transport === undefined) {
      respondError(res, 'Unknown or missing session.');
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
    void serverFactory().connect(transport);
    return transport;
  }

  await new Promise<void>((resolve) => {
    httpServer.listen(options.port, resolve);
  });

  return {
    port: options.port,
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

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw.length > 0 ? JSON.parse(raw) : undefined;
}
