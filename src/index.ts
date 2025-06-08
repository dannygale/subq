#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { QProcessManager } from './process-manager.js';

class SubQMCPServer {
  private server: Server;
  private processManager: QProcessManager;

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

    this.processManager = new QProcessManager();
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
            description: 'List all running Q processes and their status',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_output',
            description: 'Get the output from a specific Q process',
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
            description: 'Terminate a specific Q process',
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
            description: 'Send additional input to a running Q process',
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
            description: 'Clean up all finished Q processes',
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
        switch (name) {
          case 'spawn':
            return await this.handleSpawnQProcess(args);
          
          case 'list':
            return await this.handleListQProcesses();
          
          case 'get_output':
            return await this.handleGetQProcessOutput(args);
          
          case 'terminate':
            return await this.handleTerminateQProcess(args);
          
          case 'send_to':
            return await this.handleSendToQProcess(args);
          
          case 'cleanup':
            return await this.handleCleanupFinishedProcesses();
          
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

  private async handleSpawnQProcess(args: any) {
    const { task, processId, timeout = 300, workingDirectory } = args;
    
    const result = await this.processManager.spawnQProcess({
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

  private async handleListQProcesses() {
    const processes = this.processManager.listProcesses();
    
    const processInfo = processes.map(p => 
      `ID: ${p.id}\nStatus: ${p.status}\nTask: ${p.task}\nStarted: ${p.startTime.toISOString()}\nPID: ${p.pid || 'N/A'}`
    ).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: processes.length > 0 
            ? `Running Q Processes (${processes.length}):\n\n${processInfo}`
            : 'No Q processes currently running.',
        },
      ],
    };
  }

  private async handleGetQProcessOutput(args: any) {
    const { processId } = args;
    const output = await this.processManager.getProcessOutput(processId);

    return {
      content: [
        {
          type: 'text',
          text: `Output for process ${processId}:\n\n${output}`,
        },
      ],
    };
  }

  private async handleTerminateQProcess(args: any) {
    const { processId } = args;
    const success = await this.processManager.terminateProcess(processId);

    return {
      content: [
        {
          type: 'text',
          text: success 
            ? `Process ${processId} terminated successfully.`
            : `Failed to terminate process ${processId} or process not found.`,
        },
      ],
    };
  }

  private async handleSendToQProcess(args: any) {
    const { processId, input } = args;
    const success = await this.processManager.sendToProcess(processId, input);

    return {
      content: [
        {
          type: 'text',
          text: success 
            ? `Input sent to process ${processId} successfully.`
            : `Failed to send input to process ${processId}.`,
        },
      ],
    };
  }

  private async handleCleanupFinishedProcesses() {
    const cleaned = this.processManager.cleanupFinishedProcesses();

    return {
      content: [
        {
          type: 'text',
          text: `Cleaned up ${cleaned} finished processes.`,
        },
      ],
    };
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.processManager.cleanup();
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('SubQ MCP server running on stdio');
  }
}

const server = new SubQMCPServer();
server.run().catch(console.error);
