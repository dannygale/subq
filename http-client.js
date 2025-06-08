#!/usr/bin/env node

/**
 * HTTP Client for SubQ MCP Server
 * This script acts as a bridge between Q CLI (which expects stdio) 
 * and the HTTP/SSE SubQ server
 */

import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import EventSource from 'eventsource';

class SubQHTTPClient {
  constructor() {
    this.sessionId = process.env.SUBQ_SESSION_ID || uuidv4();
    this.serverUrl = process.env.SUBQ_SERVER_URL || 'http://localhost:3001';
    this.eventSource = null;
    this.setupStdioHandling();
  }

  setupStdioHandling() {
    // Handle incoming JSON-RPC messages from Q CLI via stdin
    process.stdin.on('data', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.sendToServer(message);
      } catch (error) {
        console.error('Error parsing stdin message:', error);
      }
    });

    // Set up SSE connection to receive messages from server
    this.connectSSE();
  }

  connectSSE() {
    const sseUrl = `${this.serverUrl}/mcp/sse/${this.sessionId}`;
    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Forward server responses to Q CLI via stdout
        process.stdout.write(JSON.stringify(data) + '\n');
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    this.eventSource.addEventListener('connected', (event) => {
      const data = JSON.parse(event.data);
      console.error(`[SubQClient] Connected to server with session: ${data.sessionId}`);
    });

    this.eventSource.addEventListener('ping', () => {
      // Server keepalive ping - no action needed
    });

    this.eventSource.onerror = (error) => {
      console.error('[SubQClient] SSE connection error:', error);
      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (this.eventSource.readyState === EventSource.CLOSED) {
          this.connectSSE();
        }
      }, 5000);
    };
  }

  async sendToServer(message) {
    try {
      const response = await fetch(`${this.serverUrl}/mcp/message/${this.sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[SubQClient] Error sending message to server:', error);
      
      // Send error response back to Q CLI
      const errorResponse = {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: `Failed to communicate with SubQ server: ${error.message}`,
        },
      };
      
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  }

  cleanup() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.error('\n[SubQClient] Shutting down...');
  if (global.client) {
    global.client.cleanup();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (global.client) {
    global.client.cleanup();
  }
  process.exit(0);
});

// Start the client
global.client = new SubQHTTPClient();
console.error(`[SubQClient] Started with session ID: ${global.client.sessionId}`);
