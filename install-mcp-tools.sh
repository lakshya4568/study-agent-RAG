#!/bin/bash
# MCP Tools Installation Script for NVIDIA RAG Service
# Run with: bash install-mcp-tools.sh

set -e  # Exit on error

echo "=============================================="
echo "  MCP Tools Setup for NVIDIA RAG Service"
echo "=============================================="
echo ""

# Check if we're in the right directory
if [ ! -f "python/nvidia_rag_service.py" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "   (The directory containing python/nvidia_rag_service.py)"
    exit 1
fi

# Check Python version
echo "📋 Checking Python version..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✓ Found Python $PYTHON_VERSION"
echo ""

# Activate virtual environment
echo "🔧 Setting up Python virtual environment..."
if [ ! -d ".venv" ]; then
    echo "   Creating new virtual environment..."
    python3 -m venv .venv
fi

echo "   Activating virtual environment..."
source .venv/bin/activate
echo "✓ Virtual environment activated"
echo ""

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip setuptools wheel
echo ""

# Install base requirements
echo "📦 Installing base Python packages..."
cd python
pip install -r requirements.txt
echo "✓ Base packages installed"
echo ""

# Install MCP adapters
echo "🔧 Installing MCP tools support..."
pip install langchain-mcp-adapters langgraph
echo "✓ MCP adapters installed"
echo ""

# Check if Node.js is installed (for optional MCP servers)
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✓ Node.js $NODE_VERSION detected"
    echo ""
    
    # Offer to install official MCP filesystem server
    echo "Would you like to install the official MCP Filesystem Server? (y/n)"
    read -p "This allows the AI to read files in your project: " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 Installing @modelcontextprotocol/server-filesystem..."
        npm install -g @modelcontextprotocol/server-filesystem
        echo "✓ MCP Filesystem Server installed"
        echo ""
    fi
else
    echo "⚠️  Node.js not found. Optional MCP servers won't be available."
    echo "   Install Node.js from https://nodejs.org/ to use MCP servers."
    echo ""
fi

# Check for NVIDIA API key
echo "🔑 Checking NVIDIA API key..."
if [ -f "../.env" ]; then
    if grep -q "NVIDIA_API_KEY=" ../.env; then
        echo "✓ NVIDIA_API_KEY found in .env file"
    else
        echo "⚠️  NVIDIA_API_KEY not found in .env file"
        echo "   Please add: NVIDIA_API_KEY=your_key_here"
    fi
else
    echo "⚠️  No .env file found in project root"
    echo "   Creating .env template..."
    cat > ../.env << 'EOF'
# NVIDIA API Key (required)
# Get from: https://build.nvidia.com/
NVIDIA_API_KEY=your_nvidia_api_key_here

# ChromaDB Configuration
CHROMA_PERSIST_DIR=./chroma_db

# RAG Service Port
RAG_PORT=8000

# Optional: MCP Server URLs
# MCP_GITHUB_URL=http://localhost:8001/mcp
EOF
    echo "✓ Created .env template. Please edit and add your NVIDIA_API_KEY"
fi
echo ""

# Display success message
echo "=============================================="
echo "  ✅ Installation Complete!"
echo "=============================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Configure MCP Servers (optional):"
echo "   Edit python/nvidia_rag_service.py and update MCP_SERVERS dict"
echo ""
echo "2. Add your NVIDIA API key:"
echo "   Edit .env file and set NVIDIA_API_KEY=your_key"
echo ""
echo "3. Start the RAG service:"
echo "   cd python"
echo "   python nvidia_rag_service.py"
echo ""
echo "4. Test the service:"
echo "   curl http://localhost:8000/health | jq"
echo "   curl http://localhost:8000/mcp/tools | jq"
echo ""
echo "5. Read the full guide:"
echo "   See MCP_TOOLS_SETUP.md for detailed documentation"
echo ""
echo "=============================================="
