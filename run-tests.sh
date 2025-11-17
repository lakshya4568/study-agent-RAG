#!/bin/bash
# Cross-platform test runner for macOS/Linux

echo "🧪 Running All Tests on macOS/Linux"
echo "===================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0
SKIPPED=0

run_test() {
    local test_name=$1
    local test_cmd=$2
    local timeout=${3:-60}
    
    echo -e "${YELLOW}Running: $test_name${NC}"
    
    # Use gtimeout on macOS (requires: brew install coreutils)
    # Fall back to running without timeout if not available
    if command -v gtimeout &> /dev/null; then
        if gtimeout ${timeout}s $test_cmd 2>&1; then
            echo -e "${GREEN}✅ PASSED: $test_name${NC}\n"
            ((PASSED++))
        else
            EXIT_CODE=$?
            if [ $EXIT_CODE -eq 124 ]; then
                echo -e "${RED}⏱️  TIMEOUT: $test_name (${timeout}s)${NC}\n"
            else
                echo -e "${RED}❌ FAILED: $test_name${NC}\n"
            fi
            ((FAILED++))
        fi
    else
        if $test_cmd 2>&1; then
            echo -e "${GREEN}✅ PASSED: $test_name${NC}\n"
            ((PASSED++))
        else
            echo -e "${RED}❌ FAILED: $test_name${NC}\n"
            ((FAILED++))
        fi
    fi
}

# Run tests
echo "1. Testing NVIDIA API..."
run_test "NVIDIA API" "npm run test:nvidia" 120

echo "2. Testing Python Bridge..."
run_test "Python Bridge" "npm run test:python-bridge" 120

echo "3. Testing ChromaDB RAG..."
run_test "ChromaDB RAG" "npm run test:chromadb" 120

echo "4. Testing RAG Pipeline..."
run_test "RAG Pipeline" "npm run test:rag" 180

echo "5. Testing Agent E2E..."
run_test "Agent E2E" "npm run test:agent" 180

echo "6. Testing Agent RAG E2E..."
run_test "Agent RAG E2E" "npm run test:agent-rag" 180

echo "7. Testing Full Integration..."
run_test "Full Integration" "npm run test:integration" 240

echo "8. Testing Document Upload..."
echo -e "${YELLOW}Note: Requires PDF file at ~/Desktop/SHARDA STUDY TRACKER FINAL.pdf${NC}"
if [ -f "$HOME/Desktop/SHARDA STUDY TRACKER FINAL.pdf" ]; then
    run_test "Document Upload" "npm run test:upload" 180
else
    echo -e "${YELLOW}⏭️  SKIPPED: Test PDF not found${NC}\n"
    ((SKIPPED++))
fi

# Summary
echo "===================================="
echo "📊 Test Summary"
echo "===================================="
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo -e "${YELLOW}⏭️  Skipped: $SKIPPED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Check output above.${NC}"
    exit 1
fi
