#!/bin/bash

# Package the Q Spawner MCP Server for distribution

echo "📦 Packaging Q Spawner MCP Server..."

# Clean and build
echo "🧹 Cleaning previous build..."
npm run clean

echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Create package directory
PACKAGE_DIR="q-spawner-mcp-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$PACKAGE_DIR"

# Copy necessary files
echo "📋 Copying files..."
cp -r dist/ "$PACKAGE_DIR/"
cp package.json "$PACKAGE_DIR/"
cp README.md "$PACKAGE_DIR/"
cp CONFIGURATION.md "$PACKAGE_DIR/"
cp examples.md "$PACKAGE_DIR/"
cp mcp-config.json "$PACKAGE_DIR/"
cp setup.sh "$PACKAGE_DIR/"

# Create a simplified package.json for distribution
cat > "$PACKAGE_DIR/package.json" << EOF
{
  "name": "mcp-q-spawner",
  "version": "1.0.0",
  "description": "MCP server for spawning and managing Q processes with specific tasks",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "uuid": "^10.0.0"
  },
  "keywords": ["mcp", "amazon-q", "process-management", "task-automation"],
  "author": "Your Name",
  "license": "MIT"
}
EOF

# Create installation script for the package
cat > "$PACKAGE_DIR/install.sh" << 'EOF'
#!/bin/bash

echo "🚀 Installing Q Spawner MCP Server..."

# Check prerequisites
if ! command -v q &> /dev/null; then
    echo "❌ Q CLI is not installed or not in PATH"
    echo "Please install Q CLI first"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "Please install Node.js first"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Update configuration with current directory
CURRENT_DIR=$(pwd)
sed -i.bak "s|/path/to/mcpq|$CURRENT_DIR|g" mcp-config.json
rm mcp-config.json.bak 2>/dev/null || true

echo "✅ Installation complete!"
echo ""
echo "Configuration file created: mcp-config.json"
echo "Add this to your Q CLI MCP configuration."
echo ""
echo "For detailed setup instructions, see CONFIGURATION.md"
EOF

chmod +x "$PACKAGE_DIR/install.sh"
chmod +x "$PACKAGE_DIR/setup.sh"

# Create archive
echo "🗜️  Creating archive..."
tar -czf "$PACKAGE_DIR.tar.gz" "$PACKAGE_DIR"

echo "✅ Package created: $PACKAGE_DIR.tar.gz"
echo ""
echo "To distribute:"
echo "1. Share the $PACKAGE_DIR.tar.gz file"
echo "2. Recipients should extract and run ./install.sh"
echo "3. Follow CONFIGURATION.md for Q CLI setup"

# Clean up temporary directory
rm -rf "$PACKAGE_DIR"
