# SubQ MCP Server Configuration Guide

This guide explains how to configure and use the SubQ MCP Server with Amazon Q CLI.

## Prerequisites

1. **Amazon Q CLI**: Must be installed and configured
   ```bash
   # Check if Q CLI is installed
   q --version
   ```

2. **Node.js**: Version 18 or higher
   ```bash
   # Check Node.js version
   node --version
   ```

## Installation Steps

1. **Clone or download the project**
   ```bash
   cd /path/to/your/projects
   git clone <repository-url> mcpq
   cd mcpq
   ```

2. **Run the setup script**
   ```bash
   ./setup.sh
   ```

   Or manually:
   ```bash
   npm install
   npm run build
   ```

## Configuration

### Option 1: Using Q CLI Configuration File

1. **Find your Q CLI configuration directory**
   ```bash
   # Usually located at:
   # macOS: ~/.config/amazon-q/
   # Linux: ~/.config/amazon-q/
   # Windows: %APPDATA%\amazon-q\
   ```

2. **Create or edit the MCP configuration**
   
   Create a file named `mcp-servers.json` in your Q CLI config directory:
   ```json
   {
     "mcpServers": {
       "subq": {
         "command": "node",
         "args": ["dist/index.js"],
         "cwd": "/full/path/to/mcpq"
       }
     }
   }
   ```

### Option 2: Environment Variable

Set the MCP_SERVERS environment variable:
```bash
export MCP_SERVERS='{"subq":{"command":"node","args":["dist/index.js"],"cwd":"/full/path/to/mcpq"}}'
```

### Option 3: Command Line Flag

Start Q CLI with the MCP server configuration:
```bash
q chat --mcp-config ./mcp-config.json
```

## Verification

1. **Start Q CLI**
   ```bash
   q chat
   ```

2. **Test the MCP server**
   In the Q chat, try:
   ```
   list_q_processes
   ```

   You should see a response indicating no processes are running (initially).

3. **Spawn a test process**
   ```
   spawn_q_process with task "Hello! What is the current date?"
   ```

## Troubleshooting

### Common Issues

1. **"q command not found"**
   - Ensure Q CLI is installed and in your PATH
   - Try: `which q` or `q --version`

2. **"node command not found"**
   - Install Node.js from https://nodejs.org/
   - Ensure Node.js is in your PATH

3. **"Module not found" errors**
   - Run `npm install` in the project directory
   - Ensure the build was successful: `npm run build`

4. **MCP server not connecting**
   - Check the path in your configuration is absolute
   - Verify the `dist/index.js` file exists
   - Check Q CLI logs for error messages

### Debug Mode

To debug the MCP server:

1. **Add logging to the server**
   ```bash
   # Edit the configuration to add debug output
   {
     "mcpServers": {
       "subq": {
         "command": "node",
         "args": ["dist/index.js"],
         "cwd": "/full/path/to/mcpq",
         "env": {
           "DEBUG": "1"
         }
       }
     }
   }
   ```

2. **Check server logs**
   The MCP server logs to stderr, which should be visible in Q CLI debug output.

### Testing the Server Standalone

You can test the MCP server independently:

1. **Run the test script**
   ```bash
   cd /path/to/mcpq
   node dist/test.js
   ```

2. **Manual testing**
   ```bash
   # Start the server
   node dist/index.js
   
   # In another terminal, send MCP messages
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
   ```

## Advanced Configuration

### Custom Working Directory

Configure processes to run in specific directories:
```json
{
  "mcpServers": {
    "subq": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/full/path/to/mcpq",
      "env": {
        "DEFAULT_WORKING_DIR": "/path/to/your/projects"
      }
    }
  }
}
```

### Resource Limits

Set limits on spawned processes:
```json
{
  "mcpServers": {
    "subq": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/full/path/to/mcpq",
      "env": {
        "MAX_PROCESSES": "5",
        "DEFAULT_TIMEOUT": "600"
      }
    }
  }
}
```

## Security Considerations

1. **Process Isolation**: Each spawned Q process runs with the same permissions as the MCP server
2. **Working Directory**: Specify working directories to limit file access
3. **Timeouts**: Set appropriate timeouts to prevent runaway processes
4. **Resource Limits**: Monitor system resources when running multiple processes

## Performance Tips

1. **Cleanup Regularly**: Use `cleanup_finished_processes` to free memory
2. **Monitor Resources**: Keep an eye on CPU and memory usage
3. **Limit Concurrent Processes**: Don't spawn too many processes simultaneously
4. **Use Appropriate Timeouts**: Set realistic timeouts for your tasks

## Next Steps

Once configured, see:
- `README.md` for detailed usage instructions
- `examples.md` for practical examples
- `src/test.ts` for programmatic usage examples
