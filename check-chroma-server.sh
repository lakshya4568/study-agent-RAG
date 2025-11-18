#!/bin/bash

# ChromaDB Server Test Helper
# Checks if ChromaDB server is running before executing tests

echo ""
echo "🔍 Checking ChromaDB Server Status..."
echo "====================================="

# Check if server is running
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v2/heartbeat 2>/dev/null)

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ ChromaDB server is running at http://localhost:8000"
  echo ""
  exit 0
else
  echo "❌ ChromaDB server is not running"
  echo ""
  echo "💡 Please start ChromaDB server first:"
  echo "   Option 1: Launch the Electron app (starts automatically)"
  echo "   Option 2: Manual start:"
  echo "      chroma run --path .chromadb/chroma_storage --port 8000"
  echo ""
  echo "   Storage directory: .chromadb/chroma_storage/"
  echo ""
  exit 1
fi
