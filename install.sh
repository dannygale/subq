#!/bin/bash

# SubQ MCP Server Installation Script
# This script installs the SubQ MCP server and configures it for Amazon Q CLI

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get the absolute path of the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_CONFIG_DIR="$HOME/.aws/amazonq"
MCP_CONFIG_FILE="$MCP_CONFIG_DIR/mcp.json"

print_status "Installing SubQ MCP Server..."
print_status "Script directory: $SCRIPT_DIR"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies and build the project
print_status "Installing dependencies..."
cd "$SCRIPT_DIR"
npm install

print_status "Building the project..."
npm run build

# Create the MCP config directory if it doesn't exist
if [ ! -d "$MCP_CONFIG_DIR" ]; then
    print_status "Creating MCP config directory: $MCP_CONFIG_DIR"
    mkdir -p "$MCP_CONFIG_DIR"
fi

# Create or update the MCP configuration
print_status "Configuring MCP server..."

# Check if mcp.json exists
if [ -f "$MCP_CONFIG_FILE" ]; then
    print_status "Found existing MCP configuration file"
    
    # Create a backup
    cp "$MCP_CONFIG_FILE" "$MCP_CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    print_status "Created backup of existing configuration"
    
    # Use Node.js to update the JSON configuration
    node -e "
        const fs = require('fs');
        const path = require('path');
        
        try {
            const configPath = '$MCP_CONFIG_FILE';
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            // Ensure mcpServers object exists
            if (!config.mcpServers) {
                config.mcpServers = {};
            }
            
            // Add or update the subq server configuration
            config.mcpServers.subq = {
                command: 'node',
                args: ['dist/index.js'],
                cwd: '$SCRIPT_DIR'
            };
            
            // Write the updated configuration
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log('Updated existing MCP configuration');
        } catch (error) {
            console.error('Error updating MCP configuration:', error.message);
            process.exit(1);
        }
    "
else
    print_status "Creating new MCP configuration file"
    
    # Create new configuration file
    cat > "$MCP_CONFIG_FILE" << EOF
{
  "mcpServers": {
    "subq": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "$SCRIPT_DIR"
    }
  }
}
EOF
fi

# Verify the configuration
if [ -f "$MCP_CONFIG_FILE" ]; then
    print_success "MCP configuration updated successfully!"
    print_status "Configuration file: $MCP_CONFIG_FILE"
    
    # Show the current configuration
    print_status "Current SubQ configuration:"
    node -e "
        const fs = require('fs');
        try {
            const config = JSON.parse(fs.readFileSync('$MCP_CONFIG_FILE', 'utf8'));
            if (config.mcpServers && config.mcpServers.subq) {
                console.log(JSON.stringify(config.mcpServers.subq, null, 2));
            } else {
                console.log('SubQ configuration not found');
            }
        } catch (error) {
            console.error('Error reading configuration:', error.message);
        }
    "
else
    print_error "Failed to create MCP configuration file"
    exit 1
fi

print_success "SubQ MCP Server installation completed!"
print_status ""
print_status "Available tools (use with subq___ prefix):"
print_status "  • subq___spawn - Spawn a new Q process with a task"
print_status "  • subq___list - List all running Q processes"
print_status "  • subq___get_output - Get output from a specific process"
print_status "  • subq___terminate - Terminate a specific process"
print_status "  • subq___send_to - Send input to a running process"
print_status "  • subq___cleanup - Clean up finished processes"
print_status ""
print_status "You can now use SubQ with Amazon Q CLI!"
print_status "Example: Ask Q to 'spawn a new process to analyze my AWS costs'"
