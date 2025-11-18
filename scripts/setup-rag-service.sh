#!/bin/bash

# Setup script for Python RAG service
# This script creates a virtual environment and installs dependencies

set -e  # Exit on error

echo "=================================="
echo "Python RAG Service Setup"
echo "=================================="

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed"
    exit 1
fi

echo "Python version: $(python3 --version)"

# Navigate to python directory
cd "$(dirname "$0")/../python"

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
else
    echo "Virtual environment already exists"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source .venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "=================================="
echo "Setup Complete!"
echo "=================================="
echo ""
echo "To activate the environment:"
echo "  cd python"
echo "  source .venv/bin/activate"
echo ""
echo "To start the RAG service manually:"
echo "  python nvidia_rag_service.py"
echo ""
echo "Or just run 'npm start' - it will auto-start the service!"
echo ""
