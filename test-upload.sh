#!/bin/bash

# Document Upload Test Helper Script
# Runs the comprehensive upload flow test with a provided document

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         Document Upload Test - RAG Pipeline              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

if [ -z "$1" ]; then
  echo "❌ Error: No document path provided"
  echo ""
  echo "Usage:"
  echo "  ./test-upload.sh <path-to-document>"
  echo ""
  echo "Examples:"
  echo "  ./test-upload.sh ~/Desktop/study-notes.pdf"
  echo "  ./test-upload.sh ./README.md"
  echo "  ./test-upload.sh \"/path/with spaces/document.pdf\""
  echo ""
  exit 1
fi

# Check if file exists
if [ ! -f "$1" ]; then
  echo "❌ Error: File not found: $1"
  echo ""
  exit 1
fi

# Check if ChromaDB server is running
echo "🔍 Checking ChromaDB server..."
if curl -s http://localhost:8000/api/v2/heartbeat > /dev/null 2>&1; then
  echo "✅ ChromaDB server is running"
else
  echo "⚠️  ChromaDB server not detected, starting it..."
  ./manage-chroma.sh start
  sleep 2
fi

echo ""
echo "🚀 Running upload flow test..."
echo ""

# Run the test
npx tsx tests/test-upload-flow.ts "$1"

exit $?
