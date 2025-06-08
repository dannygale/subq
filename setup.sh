#!/bin/bash

# Q Spawner MCP Server Setup Script

echo "🚀 Setting up Q Spawner MCP Server..."

# Check if Q CLI is installed
if ! command -v q &> /dev/null; then
    echo "❌ Q CLI is not installed or not in PATH"
    echo "Please install Q CLI first: https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-getting-started-installing.html"
    exit 1
fi

echo "✅ Q CLI found"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "Please install Node.js first: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found"

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the project
echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"

# Get the current directory
CURRENT_DIR=$(pwd)

# Create MCP configuration
echo "⚙️  Creating MCP configuration..."
cat > mcp-config.json << EOF
{
  "mcpServers": {
    "q-spawner": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "$CURRENT_DIR"
    }
  }
}
EOF

echo "✅ MCP configuration created at mcp-config.json"

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To use the SubQ MCP Server:"
echo "1. Add the MCP server configuration to your Q CLI"
echo "2. Use the following tools in your Q chat:"
echo "   - spawn_q_process"
echo "   - list_q_processes"
echo "   - get_output"
echo "   - terminate_q_process"
echo "   - send_to_q_process"
echo "   - cleanup_finished_processes"
echo ""
echo "Example usage:"
echo "spawn_q_process with task \"Analyze my AWS costs and suggest optimizations\""
echo ""
echo "For more information, see README.md"
