/**
 * Example: Integrating Regex Tool Parser into Study Agent
 *
 * This demonstrates how to use the new regex-based tool parsing system
 * to handle flexible LLM outputs and natural language tool requests.
 */

import { MCPClientManager } from "../client/MCPClientManager";
import { initializeIntegratedToolService } from "../tools/integrated-tool-service";
import { createNVIDIAOpenAIChat } from "../models/nvidia-openai-chat";
import { logger } from "../client/logger";

/**
 * Example 1: Parse LLM output that contains tool calls
 */
async function example1_ParseLLMOutput() {
  console.log("\n=== Example 1: Parse LLM Output with Tool Calls ===\n");

  // Simulated LLM output that includes a tool call
  const llmOutput = `I'll help you with that. Let me check the current time using current_time(timezone='America/New_York'), 
  and then I'll read the configuration file with read_file(path='/config/settings.json').`;

  // Initialize service (assumes mcpManager is already set up)
  const mcpManager = new MCPClientManager();
  // ... configure servers ...

  const toolService = await initializeIntegratedToolService(mcpManager);

  // Parse and execute
  const result = await toolService.parseAndExecute(llmOutput, {
    requireApproval: true, // Ask user before executing
    autoRetry: true,
    maxRetries: 2,
  });

  console.log(`Found ${result.results.length} tool calls`);
  console.log(`Success: ${result.successCount}`);
  console.log(`Failed: ${result.failureCount}`);
  console.log(`Denied: ${result.deniedCount}`);

  // Process results
  for (const toolResult of result.results) {
    if (toolResult.success) {
      console.log(`✓ ${toolResult.toolName}:`, toolResult.result);
    } else {
      console.log(`✗ ${toolResult.toolName}:`, toolResult.error);
    }
  }
}

/**
 * Example 2: Handle natural language tool requests
 */
async function example2_NaturalLanguage() {
  console.log("\n=== Example 2: Natural Language Tool Requests ===\n");

  const userQuery = "What's the current time in New York?";

  const mcpManager = new MCPClientManager();
  const toolService = await initializeIntegratedToolService(mcpManager);

  // Parse natural language
  const parseResult = toolService.parseOnly(userQuery);

  console.log(`Valid calls: ${parseResult.validCalls.length}`);
  console.log(`Invalid calls: ${parseResult.invalidCalls.length}`);

  if (parseResult.validCalls.length > 0) {
    const call = parseResult.validCalls[0];
    console.log(`Detected tool: ${call.call.toolName}`);
    console.log(`Arguments:`, call.args);
    console.log(`Confidence: ${call.call.confidence}`);
  }
}

/**
 * Example 3: Integration with LangGraph Agent Node
 */
async function example3_LangGraphIntegration() {
  console.log("\n=== Example 3: LangGraph Agent Integration ===\n");

  const mcpManager = new MCPClientManager();
  const toolService = await initializeIntegratedToolService(mcpManager);

  // Agent node function
  async function agentToolNode(state: {
    messages: Array<{ content: string | unknown }>;
  }) {
    const lastMessage = state.messages[state.messages.length - 1];
    const llmOutput =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    logger.info("Agent checking for tool calls in LLM output...");

    // Parse and execute tools
    const toolResults = await toolService.parseAndExecute(llmOutput, {
      requireApproval: false, // Auto-execute for agent workflows
      autoRetry: true,
      maxRetries: 1,
    });

    // Format results for next LLM call
    const toolMessages = toolResults.results.map((result) => ({
      role: "tool",
      tool_call_id: `${result.toolName}_${Date.now()}`,
      content: result.success
        ? JSON.stringify(result.result)
        : `Error: ${result.error}`,
    }));

    return {
      messages: [...state.messages, ...toolMessages],
    };
  }

  // Usage in graph
  console.log("Agent node ready for tool execution");
  console.log("Example node:", agentToolNode);
}

/**
 * Example 4: Pre-validate before asking LLM to use tools
 */
async function example4_Validation() {
  console.log("\n=== Example 4: Tool Validation ===\n");

  const mcpManager = new MCPClientManager();
  const toolService = await initializeIntegratedToolService(mcpManager);

  // Test different tool call formats
  const testCases = [
    "convert_timezone(time='2025-11-19T15:40:19+05:30', from_timezone='Asia/Kolkata', to_timezone='America/New_York')",
    "read_file(path='/missing-arg')", // Missing required fields
    "unknown_tool(arg='value')", // Unknown tool
  ];

  for (const testCase of testCases) {
    console.log(`\nTesting: ${testCase}`);
    const result = toolService.parseOnly(testCase);

    if (result.validCalls.length > 0) {
      console.log("✓ Valid tool call detected");
      console.log(`  Tool: ${result.validCalls[0].call.toolName}`);
      console.log(`  Args:`, result.validCalls[0].args);
    } else if (result.invalidCalls.length > 0) {
      console.log("✗ Invalid tool call");
      console.log(`  Errors:`, result.invalidCalls[0].errors);
    } else {
      console.log("⚠ No tool calls detected");
    }
  }
}

/**
 * Example 5: Enhanced Agent with Regex Tool Parsing
 */
async function example5_EnhancedAgent() {
  console.log("\n=== Example 5: Enhanced Agent Flow ===\n");

  const mcpManager = new MCPClientManager();
  const toolService = await initializeIntegratedToolService(mcpManager);
  const llm = createNVIDIAOpenAIChat();

  // User query
  const userQuery = "What time is it in Tokyo right now?";

  // Step 1: LLM decides what to do
  const llmResponse = await llm.invoke([
    {
      role: "system",
      content: `You are a helpful assistant. You have access to tools like current_time(timezone='...').
When the user asks about time, use the appropriate tool.`,
    },
    { role: "user", content: userQuery },
  ]);

  console.log("LLM Response:", llmResponse);

  // Step 2: Parse LLM output for tool calls
  const toolResults = await toolService.parseAndExecute(llmResponse, {
    requireApproval: false,
  });

  console.log(`\nTool Execution Results:`);
  console.log(`  Success: ${toolResults.successCount}`);
  console.log(`  Failed: ${toolResults.failureCount}`);

  // Step 3: If tools were called, send results back to LLM
  if (toolResults.results.length > 0) {
    const toolOutputs = toolResults.results
      .map(
        (r) =>
          `${r.toolName} result: ${r.success ? JSON.stringify(r.result) : r.error}`
      )
      .join("\n");

    const finalResponse = await llm.invoke([
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: userQuery },
      { role: "assistant", content: llmResponse },
      { role: "tool", tool_call_id: "tool_result", content: toolOutputs },
    ]);

    console.log("\nFinal LLM Response:", finalResponse);
  }
}

/**
 * Example 6: Handling Multiple Tool Calls in Single Response
 */
async function example6_MultipleTools() {
  console.log("\n=== Example 6: Multiple Tool Calls ===\n");

  const mcpManager = new MCPClientManager();
  const toolService = await initializeIntegratedToolService(mcpManager);

  // LLM output with multiple tool calls
  const llmOutput = `Let me help you with that. First, I'll check the current time with current_time(timezone='UTC'),
  then I'll read your settings with read_file(path='/settings.json'),
  and finally convert the time to your timezone with convert_timezone(time='2025-11-19T15:40:19+00:00', from_timezone='UTC', to_timezone='America/New_York').`;

  const result = await toolService.parseAndExecute(llmOutput, {
    requireApproval: false,
    autoRetry: true,
  });

  console.log(`Executed ${result.results.length} tools:`);
  result.results.forEach((r, i) => {
    console.log(
      `\n${i + 1}. ${r.toolName}: ${r.success ? "✓" : "✗"} ${r.error || ""}`
    );
  });
}

// Export for use in tests
export {
  example1_ParseLLMOutput,
  example2_NaturalLanguage,
  example3_LangGraphIntegration,
  example4_Validation,
  example5_EnhancedAgent,
  example6_MultipleTools,
};

// Run examples
async function runExamples() {
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║   Regex Tool Parser Integration Examples             ║");
  console.log("╚═══════════════════════════════════════════════════════╝");

  try {
    // Note: These examples require a running MCP server
    // Uncomment to run with actual server:

    // await example1_ParseLLMOutput();
    // await example2_NaturalLanguage();
    // await example3_LangGraphIntegration();
    // await example4_Validation();
    // await example5_EnhancedAgent();
    // await example6_MultipleTools();

    console.log("\n✓ All examples defined. Uncomment to run with MCP server.");
  } catch (error) {
    console.error("\n✗ Example failed:", error);
  }
}

if (require.main === module) {
  runExamples();
}
