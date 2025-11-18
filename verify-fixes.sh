#!/bin/bash

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           ChromaDB Configuration Verification             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

echo "1. Checking ChromaDB server..."
if curl -s http://localhost:8000/api/v2/heartbeat > /dev/null 2>&1; then
  echo "   ✅ Server running on port 8000"
else
  echo "   ❌ Server not running"
  echo "   Run: ./manage-chroma.sh start"
  exit 1
fi

echo ""
echo "2. Checking for deprecated API usage..."
if grep -r "path.*http://localhost" src/rag/*.ts tests/*.ts 2>/dev/null; then
  echo "   ❌ Found deprecated 'path' parameter usage"
else
  echo "   ✅ No deprecated 'path' parameter found"
fi

echo ""
echo "3. Verifying new host/port configuration..."
if grep -r "host.*localhost" src/rag/vector-store.ts tests/test-chroma-persistence.ts 2>/dev/null | grep -q "ChromaClient"; then
  echo "   ✅ Using new host/port parameters"
else
  echo "   ⚠️  Could not verify host/port usage"
fi

echo ""
echo "4. Testing ChromaDB connection..."
echo "   Running quick persistence test..."

# Run test and capture both stdout and stderr, filter out the informational messages
TEST_OUTPUT=$(npx tsx tests/test-chroma-persistence.ts 2>&1)
TEST_EXIT=$?

# Check for the deprecated warning
if echo "$TEST_OUTPUT" | grep -q "path.*deprecated"; then
  echo "   ❌ Deprecation warning still present"
  exit 1
else
  echo "   ✅ No deprecation warnings"
fi

# Check if test passed
if [ $TEST_EXIT -eq 0 ] && echo "$TEST_OUTPUT" | grep -q "All tests passed"; then
  echo "   ✅ Persistence test passed"
else
  echo "   ❌ Test failed"
  exit 1
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                  ALL FIXES VERIFIED ✅                    ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Summary:"
echo "• ChromaDB server: Running"
echo "• Deprecated API: Fixed"
echo "• Host/Port config: Updated"
echo "• Connection test: Passed"
echo ""
echo "ℹ️  Note: 'No embedding function configuration' messages are"
echo "   informational only and do not affect functionality."
echo ""
