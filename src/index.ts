#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SessionManager } from './session-manager.js';
import { HTTPMCPServer } from './http-transport.js';

class SubQMCPServer {
  private server: Server;
  private sessionManager: SessionManager;
  private httpServer!: HTTPMCPServer; // Will be initialized in run()

  constructor() {
    this.server = new Server(
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

    this.sessionManager = SessionManager.getInstance();
    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
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
        ] satisfies Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Session ID is injected by the HTTP transport layer
        const sessionId: string = (args && typeof args === 'object' && typeof args.sessionId === 'string') 
          ? args.sessionId 
          : 'default-session';
        
        // Get or create session
        const session = this.sessionManager.createSession(sessionId);
        
        switch (name) {
          case 'spawn':
            return await this.handleSpawnQProcess(args, session.processManager);
          
          case 'list':
            return await this.handleListQProcesses(session.processManager);
          
          case 'get_output':
            return await this.handleGetQProcessOutput(args, session.processManager);
          
          case 'terminate':
            return await this.handleTerminateQProcess(args, session.processManager);
          
          case 'send_to':
            return await this.handleSendToQProcess(args, session.processManager);
          
          case 'cleanup':
            return await this.handleCleanupFinishedProcesses(session.processManager);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  private async handleSpawnQProcess(args: any, processManager: any) {
    const { task, processId, timeout = 300, workingDirectory } = args;
    
    const result = await processManager.spawnQProcess({
      task,
      processId,
      timeout,
      workingDirectory,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Q process spawned successfully!\nProcess ID: ${result.id}\nStatus: ${result.status}\nTask: ${task}`,
        },
      ],
    };
  }

  private async handleListQProcesses(processManager: any) {
    const processes = processManager.listProcesses();
    
    const processInfo = processes.map((p: any) => 
      `ID: ${p.id}\nStatus: ${p.status}\nTask: ${p.task}\nStarted: ${p.startTime.toISOString()}\nPID: ${p.pid || 'N/A'}`
    ).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: processes.length > 0 
            ? `Running Q Processes (${processes.length}):\n\n${processInfo}`
            : 'No Q processes currently running in your session.',
        },
      ],
    };
  }

  private async handleGetQProcessOutput(args: any, processManager: any) {
    const { processId } = args;
    const output = await processManager.getProcessOutput(processId);

    return {
      content: [
        {
          type: 'text',
          text: `Output for process ${processId}:\n\n${output}`,
        },
      ],
    };
  }

  private async handleTerminateQProcess(args: any, processManager: any) {
    const { processId } = args;
    const success = await processManager.terminateProcess(processId);

    return {
      content: [
        {
          type: 'text',
          text: success 
            ? `Process ${processId} terminated successfully.`
            : `Failed to terminate process ${processId} or process not found in your session.`,
        },
      ],
    };
  }

  private async handleSendToQProcess(args: any, processManager: any) {
    const { processId, input } = args;
    const success = await processManager.sendToProcess(processId, input);

    return {
      content: [
        {
          type: 'text',
          text: success 
            ? `Input sent to process ${processId} successfully.`
            : `Failed to send input to process ${processId} in your session.`,
        },
      ],
    };
  }

  private async handleCleanupFinishedProcesses(processManager: any) {
    const cleaned = processManager.cleanupFinishedProcesses();

    return {
      content: [
        {
          type: 'text',
          text: `Cleaned up ${cleaned} finished processes from your session.`,
        },
      ],
    };
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      console.error('\n[SubQ] Shutting down...');
      
      // Cleanup session manager
      this.sessionManager.shutdown();
      
      // Stop HTTP server
      await this.httpServer.stop();
      
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const args = process.argv.slice(2);
    const port = parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '8947');

    // Always run in HTTP/SSE mode
    this.httpServer = new HTTPMCPServer(this.server, port);
    await this.httpServer.start();
    console.error('SubQ MCP server running in HTTP/SSE mode');
    console.error(`Connect via: http://localhost:${port}/mcp/sse/:sessionId`);
  }
}

const server = new SubQMCPServer();
server.run().catch(console.error);
