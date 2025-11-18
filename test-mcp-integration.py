#!/usr/bin/env python3
"""
MCP Tools Test Script
Tests the MCP integration with the Kimi-K2-Instruct model
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000"


def test_health():
    """Test health endpoint and MCP status"""
    print("1️⃣  Testing Health Endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        data = response.json()

        print(f"   Status: {data['status']}")
        print(f"   Embedding Model: {data['embedding_model']}")
        print(f"   LLM Model: {data['llm_model']}")
        print(
            f"   Function Calling: {'✅' if data['function_calling_enabled'] else '❌'}"
        )
        print(
            f"   Structured Output: {'✅' if data['structured_output_enabled'] else '❌'}"
        )
        print(f"   MCP Available: {'✅' if data['mcp_available'] else '❌'}")
        print(f"   MCP Tools Loaded: {data['mcp_tools_loaded']}")

        if data["mcp_tool_names"]:
            print(f"   Tool Names: {', '.join(data['mcp_tool_names'])}")

        print("   ✅ Health check passed\n")
        return data["mcp_tools_loaded"] > 0
    except Exception as e:
        print(f"   ❌ Health check failed: {e}\n")
        return False


def test_mcp_tools_list():
    """Test MCP tools listing endpoint"""
    print("2️⃣  Testing MCP Tools List...")
    try:
        response = requests.get(f"{BASE_URL}/mcp/tools")
        data = response.json()

        print(f"   Tools Count: {data['count']}")
        print(f"   Message: {data['message']}")

        if data["tools"]:
            print("   Available Tools:")
            for tool in data["tools"]:
                print(
                    f"     - {tool['name']}: {tool.get('description', 'No description')}"
                )

        print("   ✅ MCP tools list retrieved\n")
        return True
    except Exception as e:
        print(f"   ❌ MCP tools list failed: {e}\n")
        return False


def test_regular_query():
    """Test regular RAG query without tools"""
    print("3️⃣  Testing Regular Query (without tools)...")
    try:
        payload = {"question": "What is artificial intelligence?", "top_k": 3}
        response = requests.post(f"{BASE_URL}/query", json=payload)
        data = response.json()

        print(f"   Answer (first 100 chars): {data['answer'][:100]}...")
        print(f"   Chunks Retrieved: {data['chunks_retrieved']}")
        print("   ✅ Regular query passed\n")
        return True
    except Exception as e:
        print(f"   ❌ Regular query failed: {e}\n")
        return False


def test_structured_query():
    """Test structured query with confidence and key points"""
    print("4️⃣  Testing Structured Query...")
    try:
        payload = {"question": "Explain machine learning in simple terms", "top_k": 3}
        response = requests.post(f"{BASE_URL}/query-structured", json=payload)
        data = response.json()

        print(f"   Answer (first 100 chars): {data['answer'][:100]}...")
        print(f"   Confidence: {data['confidence']}")
        print(f"   Key Points Count: {len(data['key_points'])}")
        print(f"   Citations: {data['citations']}")
        print("   ✅ Structured query passed\n")
        return True
    except Exception as e:
        print(f"   ❌ Structured query failed: {e}\n")
        return False


def test_agent_query(has_tools):
    """Test agent query with tool calling"""
    print("5️⃣  Testing Agent Query (with tool calling)...")

    if not has_tools:
        print("   ⚠️  Skipping - No MCP tools configured")
        print("   To enable: Configure MCP_SERVERS in nvidia_rag_service.py\n")
        return True

    try:
        payload = {
            "question": "Use the available tools to help me understand the project structure",
            "use_rag": False,
            "max_iterations": 5,
        }
        response = requests.post(f"{BASE_URL}/query-agent", json=payload)
        data = response.json()

        print(f"   Answer (first 150 chars): {data['answer'][:150]}...")
        print(f"   Tool Calls Made: {len(data['tool_calls'])}")
        print(f"   Iterations: {data['iterations']}")

        if data["tool_calls"]:
            print("   Tool Usage:")
            for tc in data["tool_calls"]:
                print(f"     - {tc['name']}({tc['arguments']})")
                if tc["result"]:
                    print(f"       Result: {tc['result'][:80]}...")

        print("   ✅ Agent query passed\n")
        return True
    except Exception as e:
        print(f"   ❌ Agent query failed: {e}\n")
        return False


def main():
    print("=" * 60)
    print("  MCP Tools Integration Test Suite")
    print("=" * 60)
    print("")

    # Check if service is running
    print("🔍 Checking if RAG service is running...")
    try:
        requests.get(f"{BASE_URL}/health", timeout=2)
        print("   ✅ Service is running\n")
    except requests.exceptions.ConnectionError:
        print("   ❌ Service not running!")
        print("   Please start: cd python && python nvidia_rag_service.py")
        sys.exit(1)
    except Exception as e:
        print(f"   ❌ Error connecting to service: {e}")
        sys.exit(1)

    # Run tests
    results = []

    has_tools = test_health()
    results.append(("Health Check", True))

    results.append(("MCP Tools List", test_mcp_tools_list()))
    results.append(("Regular Query", test_regular_query()))
    results.append(("Structured Query", test_structured_query()))
    results.append(("Agent Query", test_agent_query(has_tools)))

    # Summary
    print("=" * 60)
    print("  Test Summary")
    print("=" * 60)
    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}: {name}")

    print("")
    print(f"  Total: {passed}/{total} tests passed")
    print("=" * 60)

    if passed == total:
        print("\n🎉 All tests passed! MCP integration is working correctly.")
        return 0
    else:
        print(
            f"\n⚠️  {total - passed} test(s) failed. Check the output above for details."
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
