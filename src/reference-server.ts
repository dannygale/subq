#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { SessionManager } from './session-manager.js';

class ReferenceSubQServer {
  private httpServer: ReturnType<typeof createServer>;
  private port: number;
  private sessionManager: SessionManager;
  private transports = new Map<string, SSEServerTransport>();

  constructor(port: number = 8947) {
    this.port = port;
    this.sessionManager = SessionManager.getInstance();
    this.httpServer = createServer(this.handleRequest.bind(this));
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url!, `http://localhost:${this.port}`);
    const pathname = url.pathname;

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Health check endpoint
    if (pathname === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        sessions: this.transports.size
      }));
      return;
    }

    // Admin sessions endpoint
    if (pathname === '/admin/sessions' && req.method === 'GET') {
      const sessions = Array.from(this.transports.keys()).map(sessionId => ({
        sessionId,
        connected: true
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessions, total: sessions.length }));
      return;
    }

    // SSE endpoint: /mcp/sse/:sessionId
    const sseMatch = pathname.match(/^\/mcp\/sse\/(.+)$/);
    if (sseMatch && req.method === 'GET') {
      const sessionId = sseMatch[1];
      await this.handleSSEConnection(sessionId, req, res);
      return;
    }

    // POST endpoint: /mcp/message/:sessionId
    const postMatch = pathname.match(/^\/mcp\/message\/(.+)$/);
    if (postMatch && req.method === 'POST') {
      const sessionId = postMatch[1];
      await this.handlePostMessage(sessionId, req, res);
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  private async handleSSEConnection(sessionId: string, req: IncomingMessage, res: ServerResponse) {
    try {
      console.error(`[ReferenceSubQ] Establishing SSE connection for session: ${sessionId}`);
      
      // Create SSE transport
      const transport = new SSEServerTransport('/mcp/message/' + sessionId, res);
      this.transports.set(sessionId, transport);

      // Add transport event logging
      transport.onerror = (error) => {
        console.error(`[ReferenceSubQ] SSE Transport error for session ${sessionId}:`, error);
      };

      transport.onclose = () => {
        console.error(`[ReferenceSubQ] SSE connection closed: ${sessionId}`);
        this.transports.delete(sessionId);
      };

      // Create MCP server for this session
      const server = this.createMCPServer(sessionId);
      
      // Connect transport to server (this automatically starts the SSE connection)
      console.error(`[ReferenceSubQ] Connecting MCP server to transport for session: ${sessionId}`);
      await server.connect(transport);

      console.error(`[ReferenceSubQ] New SSE connection established: ${sessionId}`);

    } catch (error) {
      console.error('[ReferenceSubQ] Error establishing SSE connection:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to establish SSE connection' }));
      }
    }
  }

  private async handlePostMessage(sessionId: string, req: IncomingMessage, res: ServerResponse) {
    console.error(`[ReferenceSubQ] Received POST message for session: ${sessionId}`);
    
    const transport = this.transports.get(sessionId);
    if (!transport) {
      console.error(`[ReferenceSubQ] No transport found for session: ${sessionId}`);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }

    try {
      // Let SSEServerTransport handle the raw request/response
      console.error(`[ReferenceSubQ] Forwarding POST message to transport for session: ${sessionId}`);
      await transport.handlePostMessage(req, res);
      console.error(`[ReferenceSubQ] POST message handled successfully for session: ${sessionId}`);
    } catch (error) {
      console.error('[ReferenceSubQ] Error handling POST message:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to handle message' }));
      }
    }
  }

  private createMCPServer(sessionId: string): Server {
    const server = new Server(
      {
        name: 'subq',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Add debug logging for all incoming requests
    server.onerror = (error) => {
      console.error(`[ReferenceSubQ] MCP Server error for session ${sessionId}:`, error);
    };

    // Set up tool handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'spawn',
            description: 'Spawn a new Q process with a specific task or prompt',
            inputSchema: {
              type: 'object',
              properties: {
                task: {
                  type: 'string',
                  description: 'The task or prompt to send to the Q process',
                },
                processId: {
                  type: 'string',
                  description: 'Optional custom process ID (auto-generated if not provided)',
                },
                timeout: {
                  type: 'number',
                  description: 'Optional timeout in seconds (default: 300)',
                  default: 300,
                },
                workingDirectory: {
                  type: 'string',
                  description: 'Optional working directory for the Q process',
                },
              },
              required: ['task'],
            },
          },
          {
            name: 'list',
            description: 'List all running Q processes in your session',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_output',
            description: 'Get the output from a specific Q process in your session',
            inputSchema: {
              type: 'object',
              properties: {
                processId: {
                  type: 'string',
                  description: 'The ID of the Q process',
                },
              },
              required: ['processId'],
            },
          },
          {
            name: 'terminate',
            description: 'Terminate a specific Q process in your session',
            inputSchema: {
              type: 'object',
              properties: {
                processId: {
                  type: 'string',
                  description: 'The ID of the Q process to terminate',
                },
              },
              required: ['processId'],
            },
          },
          {
            name: 'send_to',
            description: 'Send additional input to a running Q process in your session',
            inputSchema: {
              type: 'object',
              properties: {
                processId: {
                  type: 'string',
                  description: 'The ID of the Q process',
                },
                input: {
                  type: 'string',
                  description: 'The input to send to the process',
                },
              },
              required: ['processId', 'input'],
            },
          },
          {
            name: 'cleanup',
            description: 'Clean up all finished Q processes in your session',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      if (!args) {
        throw new Error('Missing arguments');
      }
      
      try {
        // Get or create session
        const session = this.sessionManager.createSession(sessionId);
        const processManager = session.processManager;
        
        switch (name) {
          case 'spawn':
            if (!args.task || typeof args.task !== 'string') {
              throw new Error('task is required and must be a string');
            }
            const result = await processManager.spawnQProcess({
              task: args.task as string,
              processId: args.processId as string | undefined,
              timeout: args.timeout as number | undefined,
              workingDirectory: args.workingDirectory as string | undefined
            });
            return {
              content: [
                {
                  type: 'text',
                  text: `Process spawned successfully with ID: ${result.id}`,
                },
              ],
            };

          case 'list':
            const processes = processManager.listProcesses();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(processes, null, 2),
                },
              ],
            };

          case 'get_output':
            if (!args.processId || typeof args.processId !== 'string') {
              throw new Error('processId is required and must be a string');
            }
            const output = processManager.getProcessOutput(args.processId as string);
            return {
              content: [
                {
                  type: 'text',
                  text: output || 'No output available',
                },
              ],
            };

          case 'terminate':
            if (!args.processId || typeof args.processId !== 'string') {
              throw new Error('processId is required and must be a string');
            }
            processManager.terminateProcess(args.processId as string);
            return {
              content: [
                {
                  type: 'text',
                  text: `Process ${args.processId} terminated`,
                },
              ],
            };

          case 'send_to':
            if (!args.processId || typeof args.processId !== 'string') {
              throw new Error('processId is required and must be a string');
            }
            if (!args.input || typeof args.input !== 'string') {
              throw new Error('input is required and must be a string');
            }
            processManager.sendToProcess(args.processId as string, args.input as string);
            return {
              content: [
                {
                  type: 'text',
                  text: `Input sent to process ${args.processId}`,
                },
              ],
            };

          case 'cleanup':
            const cleaned = processManager.cleanup();
            return {
              content: [
                {
                  type: 'text',
                  text: `Cleaned up ${cleaned} finished processes`,
                },
              ],
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    return server;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.port, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          console.error(`[ReferenceSubQ] Server running on http://localhost:${this.port}`);
          console.error(`[ReferenceSubQ] SSE endpoint: http://localhost:${this.port}/mcp/sse/:sessionId`);
          console.error(`[ReferenceSubQ] Message endpoint: http://localhost:${this.port}/mcp/message/:sessionId`);
          resolve();
        }
      });
    });
  }
}

// Start the server
const port = parseInt(process.argv.find(arg => arg.startsWith('--port='))?.split('=')[1] || '8947');
const server = new ReferenceSubQServer(port);

server.start().catch(error => {
  console.error('[ReferenceSubQ] Failed to start server:', error);
  process.exit(1);
});
