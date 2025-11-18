#!/bin/bash
# Setup Python virtual environment for AI Study Agent
set -e

echo "🐍 Setting up Python virtual environment..."

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "📦 Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Create virtual environment with Python 3.12
if [ ! -d ".venv" ]; then
    echo "🔨 Creating virtual environment with Python 3.12..."
    uv venv .venv --python 3.12
else
    echo "✅ Virtual environment already exists"
fi

# Install dependencies
echo "📚 Installing Python dependencies..."
uv pip install -r python/requirements.txt --python .venv/bin/python

# Verify installation
echo ""
echo "🧪 Verifying installation..."
.venv/bin/python -c "import chromadb; print(f'✅ ChromaDB {chromadb.__version__} installed')"
.venv/bin/python -c "import langchain_nvidia_ai_endpoints; print('✅ NVIDIA AI Endpoints installed')"

echo ""
echo "✨ Python environment setup complete!"
echo ""
echo "To use the virtual environment:"
echo "  - ChromaDB CLI: .venv/bin/chroma --version"
echo "  - Python:       .venv/bin/python your_script.py"
echo "  - Or activate:  source .venv/bin/activate"
