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

# Parse command line arguments
PORT=8947

while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --port=*)
            PORT="${1#*=}"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --port PORT     Set HTTP server port (default: 8947)"
            echo "  -h, --help      Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

print_status "Installing SubQ MCP Server..."
print_status "Script directory: $SCRIPT_DIR"
print_status "Port: $PORT"

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

# Make HTTP client executable
chmod +x "$SCRIPT_DIR/http-client.js"

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
                args: ['$SCRIPT_DIR/http-client.js'],
                cwd: '$SCRIPT_DIR',
                env: {
                    SUBQ_SERVER_URL: 'http://localhost:$PORT'
                }
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
      "args": ["$SCRIPT_DIR/http-client.js"],
      "cwd": "$SCRIPT_DIR",
      "env": {
        "SUBQ_SERVER_URL": "http://localhost:$PORT"
      }
    }
  }
}
EOF
fi

# Start HTTP server
print_status "Starting SubQ HTTP server..."

# Create a simple startup script
cat > "$SCRIPT_DIR/start-server.sh" << EOF
#!/bin/bash
cd "$SCRIPT_DIR"
node dist/index.js --port=$PORT
EOF
chmod +x "$SCRIPT_DIR/start-server.sh"

# Start the server in the background
nohup "$SCRIPT_DIR/start-server.sh" > "$SCRIPT_DIR/server.log" 2>&1 &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Check if server is running
if kill -0 $SERVER_PID 2>/dev/null; then
    print_success "SubQ HTTP server started (PID: $SERVER_PID)"
    echo $SERVER_PID > "$SCRIPT_DIR/server.pid"
    print_status "Server logs: $SCRIPT_DIR/server.log"
    print_status "To stop server: kill \$(cat $SCRIPT_DIR/server.pid)"
else
    print_error "Failed to start SubQ HTTP server"
    print_status "Check logs: $SCRIPT_DIR/server.log"
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

# Install role profiles for Amazon Q
print_status "Installing role-based profiles for Amazon Q..."

PROFILES_DIR="$HOME/.aws/amazonq/profiles"
if [ ! -d "$PROFILES_DIR" ]; then
    print_status "Creating profiles directory: $PROFILES_DIR"
    mkdir -p "$PROFILES_DIR"
fi

# Define profiles to install
PROFILE_NAMES=("orchestrator" "tester" "developer" "debug" "architect")
PROFILES_INSTALLED=0

# Create each profile directory and configuration
for profile in "${PROFILE_NAMES[@]}"; do
    PROFILE_DIR="$PROFILES_DIR/$profile"
    PROFILE_FILE="$SCRIPT_DIR/src/profiles/$profile.md"
    
    if [ -f "$PROFILE_FILE" ]; then
        # Create profile directory
        mkdir -p "$PROFILE_DIR"
        
        # Copy the profile markdown file
        cp "$PROFILE_FILE" "$PROFILE_DIR/system-prompt.md"
        
        # Create context.json configuration
        cat > "$PROFILE_DIR/context.json" << EOF
{
  "paths": [
    "system-prompt.md"
  ],
  "hooks": {}
}
EOF
        
        print_status "Installed profile: $profile"
        PROFILES_INSTALLED=$((PROFILES_INSTALLED + 1))
    else
        print_warning "Profile file not found: $PROFILE_FILE"
    fi
done

if [ $PROFILES_INSTALLED -gt 0 ]; then
    print_success "Installed $PROFILES_INSTALLED role-based profiles!"
    print_status "Profiles location: $PROFILES_DIR"
    print_status ""
    print_status "Available profiles:"
    print_status "  • orchestrator - Breaks down complex tasks into parallel sub-tasks"
    print_status "  • tester - Specializes in comprehensive test strategy and implementation"
    print_status "  • developer - Full-stack development with broad technical expertise"
    print_status "  • debug - Deep debugging and systematic issue resolution"
    print_status "  • architect - Software architecture and comprehensive design processes"
    print_status ""
    print_status "Usage: Use 'q chat --profile <profile-name>' to activate a specialized role"
    print_status "Example: q chat --profile orchestrator"
else
    print_warning "No profiles were installed"
fi

print_success "SubQ MCP Server installation completed!"
print_status ""
print_status "Features:"
print_status "  • Multiple simultaneous Q sessions supported"
print_status "  • Session isolation - each Q session has its own process pool"
print_status "  • Remote server capability for future extensions"
print_status "  • Server running on: http://localhost:$PORT"
print_status ""
print_status "Management Commands:"
print_status "  • View server status: curl http://localhost:$PORT/health"
print_status "  • View active sessions: curl http://localhost:$PORT/admin/sessions"
print_status "  • Stop server: kill \$(cat $SCRIPT_DIR/server.pid)"
print_status ""
print_status "Available tools (use with subq___ prefix):"
print_status "  • subq___spawn - Spawn a new Q process with a task"
print_status "  • subq___list - List all running Q processes"
print_status "  • subq___get_output - Get output from a specific process"
print_status "  • subq___terminate - Terminate a specific process"
print_status "  • subq___send_to - Send input to a running process"
print_status "  • subq___cleanup - Clean up finished processes"
print_status ""
print_status "Role-based profiles installed in: ~/.aws/amazonq/profiles/"
print_status "Use 'q chat --profile <profile-name>' to activate specialized roles"
print_status ""
print_status "You can now use SubQ with Amazon Q CLI!"
print_status "Example: q chat --profile orchestrator"
print_status "Then ask: 'spawn a new process to analyze my AWS costs'"
