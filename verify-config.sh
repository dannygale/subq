#!/bin/bash

# Verification script to check if SubQ MCP configuration is correct
# This script verifies that the MCP configuration uses absolute paths

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

MCP_CONFIG_FILE="$HOME/.aws/amazonq/mcp.json"

print_status "Verifying SubQ MCP configuration..."

# Check if config file exists
if [ ! -f "$MCP_CONFIG_FILE" ]; then
    print_error "MCP configuration file not found: $MCP_CONFIG_FILE"
    print_status "Run ./install.sh to create the configuration"
    exit 1
fi

print_status "Found MCP configuration file: $MCP_CONFIG_FILE"

# Check if SubQ configuration exists and uses absolute path
node -e "
const fs = require('fs');

try {
    const config = JSON.parse(fs.readFileSync('$MCP_CONFIG_FILE', 'utf8'));
    
    if (!config.mcpServers) {
        console.error('❌ No mcpServers configuration found');
        process.exit(1);
    }
    
    if (!config.mcpServers.subq) {
        console.error('❌ No SubQ server configuration found');
        process.exit(1);
    }
    
    const subqConfig = config.mcpServers.subq;
    
    // Check if args uses absolute path
    if (!subqConfig.args || !Array.isArray(subqConfig.args) || subqConfig.args.length === 0) {
        console.error('❌ No args configuration found');
        process.exit(1);
    }
    
    const httpClientPath = subqConfig.args[0];
    
    if (!httpClientPath.startsWith('/')) {
        console.error('❌ http-client.js path is not absolute:', httpClientPath);
        console.error('   This will cause issues when running q chat from other directories');
        console.error('   Expected: absolute path like /path/to/mcpq/http-client.js');
        console.error('   Found: relative path', httpClientPath);
        process.exit(1);
    }
    
    // Check if the file actually exists
    if (!fs.existsSync(httpClientPath)) {
        console.error('❌ http-client.js file not found at:', httpClientPath);
        process.exit(1);
    }
    
    console.log('✅ SubQ configuration looks correct!');
    console.log('   Command:', subqConfig.command);
    console.log('   Args:', JSON.stringify(subqConfig.args));
    console.log('   Working Directory:', subqConfig.cwd);
    console.log('   Server URL:', subqConfig.env?.SUBQ_SERVER_URL || 'Not set');
    
} catch (error) {
    console.error('❌ Error reading configuration:', error.message);
    process.exit(1);
}
"

if [ $? -eq 0 ]; then
    print_success "Configuration verification passed!"
    print_status "You should now be able to use SubQ from any directory with 'q chat'"
else
    print_error "Configuration verification failed!"
    print_status "Run ./install.sh to fix the configuration"
    exit 1
fi
