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

1. Clone or download this repository
2. Run the installation script:
```bash
./install.sh
```

This will:
- Install dependencies and build the project
- Configure the MCP server in `~/.aws/amazonq/mcp.json`
- Replace any existing SubQ configuration

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
      "args": ["dist/index.js"],
      "cwd": "/path/to/mcpq"
    }
  }
}
```

## Usage

### Adding to Q CLI

Add the MCP server to your Q CLI configuration. The server communicates via stdio.

Example configuration for Q CLI:
```json
{
  "mcpServers": {
    "subq": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/mcpq"
    }
  }
}
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
