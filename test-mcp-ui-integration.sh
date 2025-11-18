#!/bin/bash

# MCP Tool Integration - Quick Test Script
# Run this after starting your app to verify everything works

echo "🧪 Testing MCP Tool Integration..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if app is running
echo "📱 Test 1: Checking if app is running..."
if pgrep -f "electron" > /dev/null; then
    echo -e "${GREEN}✓${NC} App is running"
else
    echo -e "${RED}✗${NC} App is not running. Please start with: npm start"
    exit 1
fi

echo ""

# Test 2: Check if RAG backend is running
echo "🐍 Test 2: Checking RAG backend..."
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} RAG backend is running"
    echo ""
    echo "Backend status:"
    curl -s http://localhost:8000/health | python3 -m json.tool
else
    echo -e "${RED}✗${NC} RAG backend is not running"
    echo "   Start it with: cd python && python nvidia_rag_service.py"
fi

echo ""

# Test 3: Check MCP tools endpoint
echo "🔧 Test 3: Checking MCP tools endpoint..."
if curl -s http://localhost:8000/mcp/tools > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} MCP tools endpoint is available"
    TOOL_COUNT=$(curl -s http://localhost:8000/mcp/tools | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data.get('tools', [])))" 2>/dev/null)
    if [ ! -z "$TOOL_COUNT" ]; then
        echo "   Tools available: $TOOL_COUNT"
    fi
else
    echo -e "${YELLOW}⚠${NC}  MCP tools endpoint not responding (might need MCP servers)"
fi

echo ""

# Test 4: Instructions for manual testing
echo "📋 Manual Testing Steps:"
echo ""
echo "1. Open the app (should already be open)"
echo "2. Navigate to 'Servers' view in the sidebar"
echo "3. Click 'Add Server' and try this configuration:"
echo ""
echo "   Name: Test Filesystem"
echo "   Command: npx"
echo "   Package: @modelcontextprotocol/server-filesystem"
echo "   Args: -y $(pwd)"
echo ""
echo "4. Server should connect with status 'connected'"
echo "5. Navigate to 'Chat' view"
echo "6. Type: \"What files are in the current directory?\""
echo "7. Approval card should appear - click 'Approve & Execute'"
echo "8. File list should appear in chat"
echo ""

# Test 5: Check for common issues
echo "🔍 Checking for common issues..."
echo ""

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 18 ]; then
    echo -e "${GREEN}✓${NC} Node.js version is compatible (v$(node -v))"
else
    echo -e "${YELLOW}⚠${NC}  Node.js version might be too old (v$(node -v)). Recommend v18+"
fi

# Check if npx is available
if command -v npx &> /dev/null; then
    echo -e "${GREEN}✓${NC} npx is available"
else
    echo -e "${RED}✗${NC} npx is not available. Install with: npm install -g npx"
fi

# Check Python version
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✓${NC} Python3 is available ($PYTHON_VERSION)"
else
    echo -e "${YELLOW}⚠${NC}  Python3 is not available. RAG backend requires Python 3.8+"
fi

echo ""
echo "✨ Setup validation complete!"
echo ""
echo "📚 Documentation:"
echo "   - MCP_IMPLEMENTATION_SUMMARY.md   - What was built"
echo "   - MCP_TOOL_QUICK_START.md         - How to use"
echo "   - MCP_TOOL_INTEGRATION_GUIDE.md   - Technical details"
echo ""
echo "🚀 Next steps:"
echo "   1. Add an MCP server in the 'Servers' view"
echo "   2. Go to 'Chat' view and ask a question"
echo "   3. Approve tool execution when prompted"
echo ""
