import express, { Request, Response } from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage, JSONRPCRequest, JSONRPCResponse } from '@modelcontextprotocol/sdk/types.js';

export interface SSEConnection {
  sessionId: string;
  response: Response;
  lastPing: Date;
}

export class HTTPSSETransport implements Transport {
  private connections: Map<string, SSEConnection> = new Map();
  private messageHandlers: ((message: JSONRPCMessage) => void)[] = [];
  private closeHandlers: (() => void)[] = [];

  constructor(private sessionId: string) {}

  /**
   * Add a new SSE connection for this session
   */
  addConnection(response: Response): void {
    // Set up SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const connection: SSEConnection = {
      sessionId: this.sessionId,
      response,
      lastPing: new Date()
    };

    this.connections.set(this.sessionId, connection);

    // Send initial connection confirmation
    this.sendSSEMessage(response, 'connected', { sessionId: this.sessionId });

    // Set up ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (response.destroyed) {
        clearInterval(pingInterval);
        this.connections.delete(this.sessionId);
        return;
      }
      
      this.sendSSEMessage(response, 'ping', { timestamp: new Date().toISOString() });
      connection.lastPing = new Date();
    }, 30000); // Ping every 30 seconds

    // Handle client disconnect
    response.on('close', () => {
      clearInterval(pingInterval);
      this.connections.delete(this.sessionId);
      this.closeHandlers.forEach(handler => handler());
      console.error(`[HTTPSSETransport] Client disconnected: ${this.sessionId}`);
    });

    console.error(`[HTTPSSETransport] New SSE connection established: ${this.sessionId}`);
  }

  /**
   * Send a message via SSE
   */
  private sendSSEMessage(response: Response, event: string, data: any): void {
    if (response.destroyed) return;
    
    try {
      response.write(`event: ${event}\n`);
      response.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error(`[HTTPSSETransport] Error sending SSE message:`, error);
    }
  }

  /**
   * Send JSON-RPC message to client
   */
  async send(message: JSONRPCMessage): Promise<void> {
    const connection = this.connections.get(this.sessionId);
    if (!connection) {
      throw new Error(`No active connection for session: ${this.sessionId}`);
    }

    this.sendSSEMessage(connection.response, 'message', message);
  }

  /**
   * Handle incoming JSON-RPC message from HTTP POST
   */
  handleMessage(message: JSONRPCMessage): void {
    this.messageHandlers.forEach(handler => handler(message));
  }

  /**
   * Start the transport (no-op for HTTP, connection is managed externally)
   */
  async start(): Promise<void> {
    // HTTP transport is started when Express server starts
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    const connection = this.connections.get(this.sessionId);
    if (connection && !connection.response.destroyed) {
      this.sendSSEMessage(connection.response, 'close', { reason: 'Server closing' });
      connection.response.end();
    }
    this.connections.delete(this.sessionId);
  }

  /**
   * Add message handler
   */
  onMessage(handler: (message: JSONRPCMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Add close handler
   */
  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  /**
   * Remove message handler
   */
  offMessage(handler: (message: JSONRPCMessage) => void): void {
    const index = this.messageHandlers.indexOf(handler);
    if (index > -1) {
      this.messageHandlers.splice(index, 1);
    }
  }

  /**
   * Remove close handler
   */
  offClose(handler: () => void): void {
    const index = this.closeHandlers.indexOf(handler);
    if (index > -1) {
      this.closeHandlers.splice(index, 1);
    }
  }
}

export class HTTPMCPServer {
  private app: express.Application;
  private server: any;
  private transports: Map<string, HTTPSSETransport> = new Map();

  constructor(private mcpServer: Server, private port: number = 8947) {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Connect transport to MCP server with session context
   */
  private async connectTransportWithSession(transport: HTTPSSETransport, sessionId: string): Promise<void> {
    // Create a wrapper that injects session ID into requests
    const originalHandleMessage = transport.handleMessage.bind(transport);
    transport.handleMessage = (message: JSONRPCMessage) => {
      // Inject session ID into tool call arguments
      if (message && typeof message === 'object' && 'method' in message && message.method === 'tools/call') {
        const params = (message as any).params;
        if (params && params.arguments) {
          params.arguments.sessionId = sessionId;
        }
      }
      originalHandleMessage(message);
    };

    await this.mcpServer.connect(transport);
  }

  private setupMiddleware(): void {
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Session-ID']
    }));
    
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.text());
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        connections: this.transports.size
      });
    });

    // SSE endpoint for receiving messages from server
    this.app.get('/mcp/sse/:sessionId', async (req, res) => {
      const sessionId = req.params.sessionId;
      
      if (!sessionId) {
        res.status(400).json({ error: 'Session ID required' });
        return;
      }

      let transport = this.transports.get(sessionId);
      if (!transport) {
        transport = new HTTPSSETransport(sessionId);
        this.transports.set(sessionId, transport);
        
        // Connect transport to MCP server with session context
        await this.connectTransportWithSession(transport, sessionId);
      }

      transport.addConnection(res);
    });

    // POST endpoint for sending messages to server
    this.app.post('/mcp/message/:sessionId', async (req, res) => {
      const sessionId = req.params.sessionId;
      
      if (!sessionId) {
        res.status(400).json({ error: 'Session ID required' });
        return;
      }

      try {
        const message: JSONRPCMessage = req.body;
        
        let transport = this.transports.get(sessionId);
        if (!transport) {
          transport = new HTTPSSETransport(sessionId);
          this.transports.set(sessionId, transport);
          
          // Connect transport to MCP server with session context
          await this.connectTransportWithSession(transport, sessionId);
        }

        // Handle the incoming message
        transport.handleMessage(message);
        
        res.json({ status: 'received' });
      } catch (error) {
        console.error('[HTTPMCPServer] Error handling message:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Admin endpoint to view active sessions
    this.app.get('/admin/sessions', (req, res) => {
      const sessions = Array.from(this.transports.keys()).map(sessionId => ({
        sessionId,
        connected: this.transports.get(sessionId) !== undefined
      }));
      
      res.json({ sessions, total: sessions.length });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          console.error(`[HTTPMCPServer] Server running on http://localhost:${this.port}`);
          console.error(`[HTTPMCPServer] SSE endpoint: http://localhost:${this.port}/mcp/sse/:sessionId`);
          console.error(`[HTTPMCPServer] Message endpoint: http://localhost:${this.port}/mcp/message/:sessionId`);
          resolve();
        }
      });
    });
  }

  async stop(): Promise<void> {
    // Close all transports
    for (const transport of this.transports.values()) {
      await transport.close();
    }
    this.transports.clear();

    // Close HTTP server
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.error('[HTTPMCPServer] Server stopped');
          resolve();
        });
      });
    }
  }
}
