#!/usr/bin/env node

/**
 * HTTP Client for SubQ MCP Server using official MCP SDK SSEClientTransport
 * This script acts as a bridge between Q CLI (which expects stdio) 
 * and the HTTP/SSE SubQ server using the official MCP SDK client
 */

import { v4 as uuidv4 } from 'uuid';
import EventSource from 'eventsource';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

// Polyfill EventSource for Node.js
global.EventSource = EventSource;

class SubQHTTPClient {
  constructor() {
    this.sessionId = process.env.SUBQ_SESSION_ID || uuidv4();
    this.serverUrl = process.env.SUBQ_SERVER_URL || 'http://localhost:8947';
    this.transport = null;
    this.inputBuffer = '';
    this.setupStdioHandling();
  }

  async setupStdioHandling() {
    try {
      // Create SSE transport using the official SDK
      const sseUrl = new URL(`/mcp/sse/${this.sessionId}`, this.serverUrl);
      this.transport = new SSEClientTransport(sseUrl);

      // Set up message handling
      this.transport.onmessage = (message) => {
        // Forward server responses to Q CLI via stdout
        process.stdout.write(JSON.stringify(message) + '\n');
        // Explicitly flush stdout to ensure Q CLI receives the message immediately
        if (process.stdout.flush) {
          process.stdout.flush();
        }
      };

      this.transport.onerror = (error) => {
        console.error('[SubQClient] Transport error:', error);
      };

      this.transport.onclose = () => {
        console.error('[SubQClient] Transport closed');
      };

      // Start the transport (establishes SSE connection)
      await this.transport.start();
      console.error(`[SubQClient] Connected to server with session: ${this.sessionId}`);

      // Handle incoming JSON-RPC messages from Q CLI via stdin
      process.stdin.on('data', async (data) => {
        try {
          // Add new data to buffer
          this.inputBuffer += data.toString();
          
          // Process complete lines (JSON messages)
          const lines = this.inputBuffer.split('\n');
          
          // Keep the last incomplete line in the buffer
          this.inputBuffer = lines.pop() || '';
          
          // Process each complete line
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine) {
              try {
                const message = JSON.parse(trimmedLine);
                await this.sendToServer(message);
              } catch (parseError) {
                console.error('[SubQClient] Error parsing JSON line:', parseError);
                console.error('[SubQClient] Problematic line:', trimmedLine);
              }
            }
          }
        } catch (error) {
          console.error('[SubQClient] Error processing stdin data:', error);
        }
      });

    } catch (error) {
      console.error('[SubQClient] Failed to initialize transport:', error);
      process.exit(1);
    }
  }

  async sendToServer(message) {
    try {
      if (!this.transport) {
        throw new Error('Transport not initialized');
      }

      await this.transport.send(message);
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
      // Explicitly flush stdout
      if (process.stdout.flush) {
        process.stdout.flush();
      }
    }
  }

  async cleanup() {
    if (this.transport) {
      await this.transport.close();
    }
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.error('\n[SubQClient] Shutting down...');
  if (global.client) {
    await global.client.cleanup();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (global.client) {
    await global.client.cleanup();
  }
  process.exit(0);
});

// Start the client
global.client = new SubQHTTPClient();
console.error(`[SubQClient] Started with session ID: ${global.client.sessionId}`);
