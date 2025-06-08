# SubQ MCP Server

An MCP (Model Context Protocol) server that allows you to spawn and manage multiple Amazon Q processes with specific tasks. This enables parallel task execution and process management through Q's MCP integration.

## Features

- **Spawn Q Processes**: Create new Q processes with specific tasks or prompts
- **Process Management**: List, monitor, and terminate running Q processes
- **Output Retrieval**: Get output from specific Q processes
- **Interactive Communication**: Send additional input to running processes
- **Automatic Cleanup**: Clean up finished processes and handle timeouts
- **Process Isolation**: Each Q process runs in its own environment

## Installation

### Quick Install (Recommended)

```bash
./install.sh
```

This will:
- Install dependencies and build the project
- Start the HTTP/SSE server for multi-session support
- Configure the MCP server in `~/.aws/amazonq/mcp.json`
- Replace any existing SubQ configuration

### Custom Port Installation

```bash
./install.sh --port=8948
```

### Manual Installation

If you prefer to install manually:

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Add to your Q CLI MCP configuration in `~/.aws/amazonq/mcp.json`:
```json
{
  "mcpServers": {
    "subq": {
      "command": "node",
      "args": ["http-client.js"],
      "cwd": "/path/to/mcpq",
      "env": {
        "SUBQ_SERVER_URL": "http://localhost:8947"
      }
    }
  }
}
```

4. Start the HTTP server:
```bash
node dist/index.js --port=8947
```

## Architecture

### HTTP/SSE Mode (Multi-Session)
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Q Session 1   │    │   Q Session 2   │    │   Q Session N   │
│   (Client A)    │    │   (Client B)    │    │   (Client C)    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │    HTTP/SSE MCP Server    │
                    │   (Session Management)    │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   Session-Isolated        │
                    │   Process Managers        │
                    └───────────────────────────┘
```

**Features:**
- **Session Isolation**: Each Q CLI session gets its own process pool
- **Multiple Connections**: Support for simultaneous Q sessions
- **Remote Ready**: HTTP-based for future remote deployments
- **Admin Interface**: Web endpoints for monitoring and management

## Session Management

### Session Features

**Automatic Session Creation:**
- Each Q CLI connection gets a unique session ID
- Sessions are automatically created on first connection
- Process pools are isolated per session

**Session Lifecycle:**
- **Creation**: Automatic on first tool use
- **Activity Tracking**: Sessions track last activity timestamp
- **Timeout**: Inactive sessions cleaned up after 30 minutes
- **Cleanup**: All session processes terminated on cleanup

**Session Isolation:**
- Each session has its own `QProcessManager`
- Processes spawned in one session are invisible to others
- `subq___list` only shows processes from your session
- `subq___get_output` only accesses your session's processes

### Monitoring and Administration

**Health Check:**
```bash
curl http://localhost:8947/health
```

**View Active Sessions:**
```bash
curl http://localhost:8947/admin/sessions
```

**Server Management:**
```bash
# Stop server
kill $(cat server.pid)

# View server logs
tail -f server.log

# Restart server
./start-server.sh
```

### Available Tools

#### `spawn`
Spawn a new Q process with a specific task.

**Parameters:**
- `task` (required): The task or prompt to send to the Q process
- `processId` (optional): Custom process ID (auto-generated if not provided)
- `timeout` (optional): Timeout in seconds (default: 300)
- `workingDirectory` (optional): Working directory for the Q process

**Example:**
```
subq___spawn with task "Analyze the AWS costs in my account and provide optimization recommendations"
```

#### `list`
List all running Q processes and their status.

**Example:**
```
subq___list
```

#### `get_output`
Get the output from a specific Q process.

**Parameters:**
- `processId` (required): The ID of the Q process

**Example:**
```
subq___get_output with processId "abc-123-def"
```

#### `terminate`
Terminate a specific Q process.

**Parameters:**
- `processId` (required): The ID of the Q process to terminate

**Example:**
```
subq___terminate with processId "abc-123-def"
```

#### `send_to`
Send additional input to a running Q process.

**Parameters:**
- `processId` (required): The ID of the Q process
- `input` (required): The input to send to the process

**Example:**
```
subq___send_to with processId "abc-123-def" and input "Can you also check for unused resources?"
```

#### `cleanup`
Clean up all finished Q processes.

**Example:**
```
subq___cleanup
```

## Use Cases

### Parallel Task Execution
```
# Spawn multiple Q processes for different tasks
subq___spawn with task "Analyze EC2 instances for cost optimization"
subq___spawn with task "Review S3 bucket policies for security issues"
subq___spawn with task "Generate CloudFormation template for a web application"

# Check their progress
subq___list

# Get results when ready
subq___get_output with processId "process-1"
subq___get_output with processId "process-2"
```

### Long-Running Analysis
```
# Start a comprehensive analysis
subq___spawn with task "Perform a complete security audit of my AWS infrastructure" and timeout 1800

# Check progress periodically
subq___get_output with processId "audit-process"

# Send follow-up questions
subq___send_to with processId "audit-process" and input "Focus on IAM policies and access patterns"
```

### Batch Processing
```
# Process multiple files or resources
subq___spawn with task "Analyze CloudTrail logs from the last 24 hours"
subq___spawn with task "Review all Lambda functions for performance issues"
subq___spawn with task "Check RDS instances for optimization opportunities"

# Clean up when done
subq___cleanup
```

## Development

### Build
```bash
npm run build
```

### Development Mode
```bash
npm run dev
```

### Clean
```bash
npm run clean
```

## Process States

- **starting**: Process is being initialized
- **running**: Process is active and can receive input
- **finished**: Process completed successfully
- **error**: Process encountered an error
- **terminated**: Process was manually terminated

## Error Handling

The server handles various error conditions:
- Process spawn failures
- Timeout handling
- Process communication errors
- Resource cleanup on shutdown

## Security Considerations

- Each Q process runs with the same permissions as the MCP server
- Working directory can be specified to isolate file operations
- Processes are automatically cleaned up on server shutdown
- Timeout mechanisms prevent runaway processes

## Limitations

- Requires Q CLI to be installed and accessible in PATH
- Process output is buffered in memory
- Maximum number of concurrent processes depends on system resources
