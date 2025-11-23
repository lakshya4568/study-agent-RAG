# Regex-Based Tool Call Parser

## Overview

The Regex-Based Tool Call Parser is a production-grade enhancement to the Study Agent's MCP tool execution system. It enables flexible parsing of LLM outputs and natural language requests, converting them into validated, executable tool calls.

### Problem It Solves

**Before:** LLMs could only call tools through strict JSON function calling APIs, leading to:

- Errors when LLM output wasn't perfectly formatted
- Inability to handle natural language tool requests
- Brittle parsing that failed on minor variations
- No recovery from malformed tool calls

**After:** The regex parser provides:

- ✅ Multi-format support (function syntax, JSON, natural language)
- ✅ Graceful degradation with confidence scores
- ✅ Schema validation and argument sanitization
- ✅ Natural language understanding ("What time is it?" → `current_time()`)
- ✅ Batch execution with approval flow
- ✅ Automatic retry with exponential backoff

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 LLM Output                          │
│  "Let me convert_timezone(time='...', from='...)" │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│            ToolCallParser                           │
│  ┌──────────────────────────────────────┐          │
│  │  Strategy 1: Function Syntax         │          │
│  │  toolName(arg='val', arg2='val2')   │          │
│  └──────────────────────────────────────┘          │
│  ┌──────────────────────────────────────┐          │
│  │  Strategy 2: JSON Format             │          │
│  │  {"tool": "name", "args": {...}}    │          │
│  └──────────────────────────────────────┘          │
│  ┌──────────────────────────────────────┐          │
│  │  Strategy 3: Natural Language        │          │
│  │  "what time is it in NY?"           │          │
│  └──────────────────────────────────────┘          │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│            ToolRegistry                             │
│  - Tool metadata and schemas                        │
│  - Aliases (natural language → tool name)          │
│  - Zod schema validation                           │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│         IntegratedToolCallService                   │
│  Parse → Validate → Approve → Execute → Retry      │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│          MCPClientManager                           │
│  Execute tool on appropriate MCP server             │
└─────────────────────────────────────────────────────┘
```

---

## Components

### 1. ToolCallParser

**Core parsing engine with strategy pattern:**

```typescript
export class ToolCallParser {
  parse(text: string): ToolCallParseResult;
  parseAndValidate(text: string): { validCalls; invalidCalls; parseErrors };
  validate(toolCall: ParsedToolCall): ToolValidationResult;
}
```

**Parsing Strategies:**

1. **Function Syntax** (High confidence)

   ```typescript
   // Input: "convert_timezone(time='2025-11-19', from_timezone='UTC', to_timezone='America/New_York')"
   // Output: { toolName: 'convert_timezone', args: {...}, confidence: 'high' }
   ```

2. **JSON Format** (High confidence)

   ```typescript
   // Input: '{"tool": "read_file", "args": {"path": "/config.json"}}'
   // Output: { toolName: 'read_file', args: {...}, confidence: 'high' }
   ```

3. **Natural Language** (Medium confidence)
   ```typescript
   // Input: "What time is it in Tokyo?"
   // Output: { toolName: 'current_time', args: {timezone: 'Asia/Tokyo'}, confidence: 'medium' }
   ```

### 2. ToolRegistry

**Central registry for tool metadata:**

```typescript
export class ToolRegistry {
  registerTool(tool: Tool, schema?: z.ZodType<any>);
  registerAlias(alias: string, toolName: string);
  getTool(name: string): Tool | undefined;
  getSchema(toolName: string): z.ZodType<any> | undefined;
}
```

**Features:**

- Stores MCP tool definitions
- Maintains Zod schemas for validation
- Maps natural language aliases to tool names
- Thread-safe lookup and registration

### 3. IntegratedToolCallService

**Orchestrates the complete flow:**

```typescript
export class IntegratedToolCallService {
  async initialize();
  async parseAndExecute(
    llmOutput: string,
    options: ToolExecutionOptions
  ): Promise<BatchToolExecutionResult>;
  parseOnly(text: string): { validCalls; invalidCalls; parseErrors };
  validateToolCall(
    toolName: string,
    args: Record<string, unknown>
  ): ToolValidationResult;
}
```

**Execution Flow:**

1. Parse LLM output → Extract tool calls
2. Validate against schemas → Sanitize arguments
3. Request user approval (optional)
4. Execute via MCP → Handle errors
5. Retry on failure (exponential backoff)
6. Return structured results

---

## Usage

### Basic Usage

```typescript
import { MCPClientManager } from "../client/MCPClientManager";
import { initializeIntegratedToolService } from "../tools/integrated-tool-service";

// 1. Initialize
const mcpManager = new MCPClientManager();
// ... configure MCP servers ...

const toolService = await initializeIntegratedToolService(mcpManager);

// 2. Parse and execute LLM output
const llmOutput = `Let me check the time with current_time(timezone='America/New_York')`;

const result = await toolService.parseAndExecute(llmOutput, {
  requireApproval: true, // Ask user before executing
  autoRetry: true, // Retry on failure
  maxRetries: 2, // Max retry attempts
});

// 3. Process results
console.log(`Success: ${result.successCount}, Failed: ${result.failureCount}`);
for (const toolResult of result.results) {
  if (toolResult.success) {
    console.log(`${toolResult.toolName}:`, toolResult.result);
  } else {
    console.error(`${toolResult.toolName} failed:`, toolResult.error);
  }
}
```

### Integration with Agent Node

```typescript
async function agentToolNode(state: AgentState) {
  const lastMessage = state.messages[state.messages.length - 1];
  const llmOutput =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  // Parse and execute tools
  const toolResults = await toolService.parseAndExecute(llmOutput, {
    requireApproval: false, // Auto-execute for agents
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
```

### Validation Only (No Execution)

```typescript
// Useful for previewing what would be executed
const parseResult = toolService.parseOnly(llmOutput);

if (parseResult.validCalls.length > 0) {
  console.log("Valid tool calls detected:");
  parseResult.validCalls.forEach((vc) => {
    console.log(`  - ${vc.call.toolName}`, vc.args);
  });
}

if (parseResult.invalidCalls.length > 0) {
  console.log("Invalid tool calls:");
  parseResult.invalidCalls.forEach((ic) => {
    console.log(`  - ${ic.call.toolName}: ${ic.errors.join(", ")}`);
  });
}
```

---

## Supported Formats

### 1. Function Syntax

```typescript
// Single quotes
convert_timezone(
  (time = "2025-11-19T15:40:19+05:30"),
  (from_timezone = "Asia/Kolkata")
);

// Double quotes
read_file((path = "/config/settings.json"), (encoding = "utf-8"));

// No quotes (for simple values)
calculate((x = 42), (y = 10), (operation = add));

// No arguments
current_time();
```

### 2. JSON Format

```typescript
// Inline JSON
{"tool": "convert_timezone", "args": {"time": "2025-11-19T15:40:19+05:30", "from_timezone": "Asia/Kolkata"}}

// In prose
Let me help you. {"tool": "read_file", "args": {"path": "/example.txt"}}
```

### 3. Natural Language

```typescript
// Time queries
"What's the current time?";
"What time is it in Tokyo?";
"Convert the time from Asia/Kolkata to America/New_York";

// File operations (requires custom patterns)
"Read the config file at /settings.json";
```

**Note:** Natural language patterns must be explicitly registered. See "Extending Natural Language Support" below.

---

## Configuration

### Tool Registry Setup

```typescript
import { createToolRegistryFromMCP } from "../tools/tool-call-parser";

// Automatic setup from MCP tools
const allTools = mcpManager.getAllTools();
const registry = createToolRegistryFromMCP(
  allTools.map((t) => ({
    name: t.name,
    description: t.description,
    schema: t.schema, // Zod schema if available
  }))
);

// Manual tool registration
registry.registerTool(
  {
    name: "custom_tool",
    description: "Does something custom",
    inputSchema: customJsonSchema,
  },
  customZodSchema
);

// Register natural language aliases
registry.registerAlias("what time is it", "current_time");
registry.registerAlias("convert time", "convert_timezone");
```

### Execution Options

```typescript
interface ToolExecutionOptions {
  requireApproval?: boolean; // Default: true - Ask user before executing
  autoRetry?: boolean; // Default: true - Retry on failure
  maxRetries?: number; // Default: 2 - Max retry attempts
}
```

---

## Extending Natural Language Support

To add custom natural language patterns:

```typescript
// In ToolCallParser.parseNaturalLanguage()
const lowerText = text.toLowerCase();

// Example: File reading
if (lowerText.includes("read") && lowerText.includes("file")) {
  const pathPattern =
    /(?:read|load)\s+(?:the\s+)?(?:file\s+)?(?:at\s+)?([^\s]+)/i;
  const match = pathPattern.exec(text);

  if (match && this.registry.hasToolName("read_file")) {
    calls.push({
      toolName: "read_file",
      args: { path: match[1] },
      confidence: "medium",
      rawMatch: match[0],
      format: "natural",
    });
  }
}

// Example: Math calculations
if (lowerText.match(/calculate|compute|solve/)) {
  // Extract numbers and operation
  // Return parsed calculation tool call
}
```

---

## Error Handling

### Validation Errors

```typescript
const result = toolService.parseOnly(input);

for (const invalid of result.invalidCalls) {
  console.error(`Tool: ${invalid.call.toolName}`);
  console.error(`Errors: ${invalid.errors.join(", ")}`);
  // Example: "from_timezone: Required", "time: Invalid date format"
}
```

### Execution Errors

```typescript
const result = await toolService.parseAndExecute(llmOutput);

for (const toolResult of result.results) {
  if (!toolResult.success) {
    console.error(`${toolResult.toolName} failed:`, toolResult.error);
    console.error(`Retries: ${toolResult.retries}`);
    // Handle: retry exhausted, approval denied, execution error
  }
}
```

### Common Error Scenarios

1. **Unknown Tool**: Tool name not in registry
2. **Missing Required Args**: Schema validation fails
3. **Type Mismatch**: Argument type doesn't match schema
4. **MCP Server Unavailable**: Target server not connected
5. **User Denial**: User rejected approval request
6. **Execution Timeout**: Tool execution exceeded timeout

---

## Testing

### Run Tests

```bash
npm run test:tool-parser
# or
npx ts-node tests/test-tool-parser.ts
```

### Test Coverage

- ✅ Function syntax parsing (various quote styles)
- ✅ JSON format parsing (inline and embedded)
- ✅ Natural language parsing (time queries)
- ✅ Mixed format (multiple tools in single output)
- ✅ Validation (required/optional fields, types)
- ✅ Edge cases (empty args, unknown tools, malformed syntax)
- ✅ Deduplication (repeated tool calls)

---

## Performance Considerations

### Regex Performance

- **O(n)** text scanning with compiled regex patterns
- Minimal overhead vs. JSON.parse for structured formats
- Early termination on first successful parse

### Optimization Tips

1. **Batch Execution**: Parse once, execute all tools in parallel (where safe)
2. **Cache Registry**: Initialize once, reuse across requests
3. **Limit Natural Language**: Use only for high-confidence patterns
4. **Set Timeouts**: Configure MCP execution timeouts to prevent hangs

### Benchmarks (Approximate)

- Function syntax parse: **~0.5ms** per tool call
- JSON format parse: **~0.3ms** per tool call
- Natural language parse: **~1-2ms** per query
- Zod validation: **~0.1-0.5ms** per schema

---

## Best Practices

### ✅ Do's

- **Always validate** before execution using schemas
- **Log all parsing attempts** for debugging and improvement
- **Use confidence scores** to decide approval requirements
- **Register aliases** for common natural language patterns
- **Handle edge cases** gracefully (empty args, missing tools)
- **Test with real LLM outputs** to discover new patterns

### ❌ Don'ts

- **Don't skip validation** - it prevents execution errors
- **Don't hardcode tool names** in natural language patterns
- **Don't ignore confidence scores** - they indicate parse reliability
- **Don't execute without approval** for destructive operations
- **Don't forget error handling** - tools can fail

---

## Migration Guide

### Existing Code Using LangChain MCP Adapters

**Before:**

```typescript
const tools = await loadMcpTools("server-name", mcpClient);
const result = await tools[0].invoke({ arg: "value" });
```

**After (with parsing):**

```typescript
const toolService = await initializeIntegratedToolService(mcpManager);

// LLM can now output free-form text with tool calls
const llmOutput = "Let me use tool_name(arg='value')";
const result = await toolService.parseAndExecute(llmOutput);
```

**Key Benefits:**

- No breaking changes to existing MCP setup
- Adds parsing layer on top of existing adapters
- Maintains backward compatibility

---

## Troubleshooting

### Issue: Tool not detected in LLM output

**Solution:**

1. Check if tool name is registered in ToolRegistry
2. Verify format matches one of: function syntax, JSON, or natural language
3. Enable debug logging to see parse attempts
4. Use `parseOnly()` to test without execution

### Issue: Validation fails with "Required" error

**Solution:**

1. Check tool's input schema - ensure all required fields present
2. Verify argument names match schema exactly (case-sensitive)
3. Use `validateToolCall()` to test specific args

### Issue: Natural language not working

**Solution:**

1. Natural language requires explicit pattern registration
2. Check if pattern exists in `parseNaturalLanguage()`
3. Register alias: `registry.registerAlias("phrase", "tool_name")`
4. Consider adding custom regex pattern for your use case

---

## Future Enhancements

### Planned Features

1. **Machine Learning Parser**: Train on LLM outputs to improve accuracy
2. **Multi-Language Support**: Parse tool calls in non-English languages
3. **Semantic Similarity**: Use embeddings for fuzzy tool matching
4. **Auto-Alias Discovery**: Learn aliases from successful parses
5. **Streaming Support**: Parse tool calls from streaming LLM outputs

### Extensibility Points

- Custom parsing strategies (implement `IParseStrategy`)
- Pluggable validation backends (beyond Zod)
- Custom approval flows (integrate with UI frameworks)
- Telemetry and monitoring hooks

---

## Summary

The Regex-Based Tool Call Parser transforms your MCP agent from rigid function calling to flexible, natural interaction:

✨ **Multi-format support** → Parse any LLM output style  
✨ **Schema validation** → Type-safe execution  
✨ **Natural language** → Understand user intent  
✨ **Approval flow** → User control over tool execution  
✨ **Production-ready** → Error handling, retries, logging

**Files:**

- `src/tools/tool-call-parser.ts` - Core parser
- `src/tools/integrated-tool-service.ts` - Integration layer
- `tests/test-tool-parser.ts` - Comprehensive tests
- `src/tools/tool-parser-examples.ts` - Usage examples

**Get Started:**

```bash
npm run test:tool-parser  # Run tests
# Then integrate into your agent (see examples)
```

---

**Questions?** Check the examples in `tool-parser-examples.ts` or review test cases in `test-tool-parser.ts`.
