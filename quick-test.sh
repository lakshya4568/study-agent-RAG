#!/bin/bash
# Quick test runner to verify basic functionality

echo "🧪 Quick Test Verification"
echo "=========================="
echo ""

# Test NVIDIA API (most critical)
echo "Testing NVIDIA API..."
if npm run test:nvidia 2>&1 | grep -q "All NVIDIA API tests passed"; then
    echo "✅ NVIDIA API test: PASSED"
else
    echo "❌ NVIDIA API test: FAILED or TIMEOUT"
fi

echo ""
echo "=========================="
echo "To run all tests, use: ./run-tests.sh"
echo "To run individual tests, use: npm run test:<name>"
