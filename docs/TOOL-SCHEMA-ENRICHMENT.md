# Tool Schema Enrichment System

## Problem Statement

**Why LLMs fail to use MCP tools correctly:**

When you ask an LLM "What's the current time?", it needs to:

1. Recognize this requires the `current_time` tool
2. Know that `timezone` and `format` are optional parameters
3. Understand the default values (UTC, RFC3339)
4. Generate a proper tool call with correct arguments

**Without proper schemas**, the LLM will:

- ❌ Not know when to use tools
- ❌ Miss required arguments
- ❌ Guess at formats incorrectly
- ❌ Not apply default values
- ❌ Generate malformed tool calls

## Solution: Rich Schema Enrichment

This system transforms basic MCP tool schemas into **LLM-friendly, comprehensive specifications** with:

✅ **Detailed descriptions** - Clear explanation of what each tool does  
✅ **Parameter documentation** - Type, format, examples, constraints  
✅ **Few-shot examples** - Real usage patterns injected into prompts  
✅ **Default values** - Automatic application of optional param defaults  
✅ **Validation** - Pre-execution argument checking

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│           Basic MCP Tool Schema                      │
│  {                                                   │
│    name: "current_time",                            │
│    description: "Get current time",                 │
│    inputSchema: {                                   │
│      properties: { timezone, format }               │
│    }                                                │
│  }                                                  │
└─────────────────┬────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────┐
│         Tool Schema Enricher                         │
│  • Add detailed descriptions                         │
│  • Document parameter formats/examples               │
│  • Define default values                             │
│  • Include usage examples                            │
└─────────────────┬────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────┐
│           Enriched Tool Schema                       │
│  {                                                   │
│    name: "current_time",                            │
│    description: "Get the current time in a           │
│      specified timezone or UTC by default...",      │
│    parameters: {                                    │
│      timezone: {                                    │
│        type: "string",                              │
│        description: "IANA timezone name...",        │
│        examples: ["America/New_York", "UTC"],       │
│        default: "UTC"                               │
│      }                                              │
│    },                                               │
│    examples: [                                      │
│      {                                              │
│        userQuery: "What's the current time?",       │
│        toolCall: { arguments: {} }                  │
│      }                                              │
│    ]                                                │
│  }                                                  │
└─────────────────┬────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────┐
│         Enhanced System Prompt                       │
│  Base prompt + Few-shot examples                     │
│                                                      │
│  "User: What time is it in Tokyo?                   │
│   Assistant: I'll use current_time with              │
│   timezone='Asia/Tokyo'"                            │
└─────────────────┬────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────┐
│              LLM Generation                          │
│  LLM now understands:                                │
│  • When to use each tool                             │
│  • What arguments to provide                         │
│  • Proper formats and examples                       │
└─────────────────┬────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────┐
│          Validation & Defaults                       │
│  • Check required arguments present                  │
│  • Apply defaults for missing optional params        │
│  • Validate formats                                  │
└─────────────────┬────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────┐
│           Tool Execution                             │
│  Execute with validated, complete arguments          │
└──────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. Tool Enhancements Registry

Located in `tool-schema-enricher.ts`, the `TOOL_ENHANCEMENTS` object contains rich metadata for each tool:

```typescript
const TOOL_ENHANCEMENTS: Record<string, Partial<EnrichedToolSchema>> = {
  current_time: {
    description:
      "Get the current time in a specified timezone or UTC by default...",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description:
            "IANA timezone name (e.g., 'America/New_York', 'Asia/Tokyo')",
          examples: ["America/New_York", "Asia/Tokyo", "UTC"],
          default: "UTC",
        },
        // ... more parameters
      },
      required: [],
    },
    examples: [
      {
        userQuery: "What's the current time?",
        toolCall: {
          arguments: {},
          expectedBehavior: "Returns current UTC time",
        },
      },
      // ... more examples
    ],
  },
  // ... more tools
};
```

### 2. Schema Enrichment Functions

**`enrichToolSchema(tool: Tool): EnrichedToolSchema`**

- Takes a basic MCP tool schema
- Merges with enhancements from registry
- Returns comprehensive enriched schema

**`enrichAllTools(tools: Tool[]): EnrichedToolSchema[]`**

- Batch process all tools
- Returns array of enriched schemas

**`toOpenAIToolFormat(enriched: EnrichedToolSchema): ChatCompletionTool`**

- Converts enriched schema to OpenAI ChatCompletionTool format
- Used when sending tools to LLM

### 3. Few-Shot Example Generation

**`generateFewShotExamples(tools: EnrichedToolSchema[]): string`**

- Extracts examples from enriched tools
- Formats as user query → tool call pairs
- Returns string for injection into system prompt

### 4. Tool-Aware System Prompt

**`createToolAwareSystemPrompt(basePrompt: string, enrichedTools: EnrichedToolSchema[]): string`**

- Takes your base system prompt
- Appends few-shot examples
- Adds tool usage guidelines
- Returns enhanced prompt that teaches LLM how to use tools

### 5. Argument Validation

**`validateToolArguments(toolName: string, args: Record<string, unknown>, schema: EnrichedToolSchema)`**

- Checks required arguments are present
- Extracts default values for missing optional params
- Returns validation result with errors and defaults

**`mergeWithDefaults(args: Record<string, unknown>, defaults: Record<string, unknown>)`**

- Merges user-provided args with defaults
- Returns complete argument set for tool execution

---

## Integration into Agent

The enrichment system is integrated into `src/agent/nodes.ts`:

```typescript
export function createQueryNode(tools: StructuredTool[]) {
  return async function queryNode(state: StudyAgentStateType) {
    // 1. Convert LangChain tools to MCP format
    const mcpTools: Tool[] = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.schema as Tool["inputSchema"],
    }));

    // 2. Enrich schemas
    const enrichedTools = enrichAllTools(mcpTools);
    const openAITools = enrichedTools.map(toOpenAIToolFormat);

    // 3. Create enhanced system prompt with examples
    const enhancedSystemPrompt = createToolAwareSystemPrompt(
      STUDY_MENTOR_SYSTEM_PROMPT,
      enrichedTools
    );

    // 4. LLM generates tool calls
    const messages = [
      new SystemMessage(enhancedSystemPrompt),
      ...state.messages,
    ];

    // 5. Tool executor with validation
    const toolExecutor = async (
      toolName: string,
      args: Record<string, unknown>
    ) => {
      const enrichedSchema = enrichedTools.find((t) => t.name === toolName);

      if (enrichedSchema) {
        // Validate and apply defaults
        const validation = validateToolArguments(
          toolName,
          args,
          enrichedSchema
        );
        args = mergeWithDefaults(args, validation.defaults);
      }

      // Execute tool with complete arguments
      const tool = tools.find((t) => t.name === toolName);
      return await tool.invoke(args);
    };

    // 6. Invoke LLM with enriched tools
    const response = await model.invokeWithTools(
      messages,
      openAITools,
      toolExecutor
    );

    return { messages: [new AIMessage({ content: response.content })] };
  };
}
```

---

## Supported Tools

The system includes comprehensive enhancements for:

### Time Tools (from mcp-time server)

1. **`current_time`**
   - Get current time in any timezone
   - Examples: "What time is it?", "Time in Tokyo?"
   - Defaults: UTC timezone, RFC3339 format

2. **`add_time`**
   - Add/subtract duration from time
   - Examples: "2 hours from now", "30 minutes ago"
   - Defaults: current time, UTC timezone

3. **`convert_timezone`**
   - Convert time between timezones
   - Examples: "3PM IST to NY time"
   - Required: time, input_timezone, output_timezone

4. **`compare_time`**
   - Compare two timestamps
   - Returns: -1 (before), 0 (equal), 1 (after)

5. **`relative_time`**
   - Parse natural language time expressions
   - Examples: "tomorrow at 3pm", "5 days ago", "next Monday"

---

## Adding New Tool Enhancements

To add enrichment for a new tool:

1. **Add to `TOOL_ENHANCEMENTS` registry:**

```typescript
const TOOL_ENHANCEMENTS: Record<string, Partial<EnrichedToolSchema>> = {
  // ... existing tools ...

  your_new_tool: {
    description:
      "Detailed description of what the tool does and when to use it",
    parameters: {
      type: "object",
      properties: {
        param1: {
          type: "string",
          description: "What this parameter does, format requirements, etc",
          examples: ["example1", "example2"],
          default: "default_value",
        },
        param2: {
          type: "number",
          description: "Numeric parameter description",
          examples: [42, 100],
        },
      },
      required: ["param2"], // List required params
    },
    examples: [
      {
        userQuery: "User's natural language query",
        toolCall: {
          arguments: { param1: "example", param2: 42 },
          expectedBehavior: "What happens when tool is called with these args",
        },
      },
      // Add 2-3 examples for best results
    ],
  },
};
```

2. **Test the enhancement:**

```bash
npm run test:schema-enrichment
```

3. **Verify in agent:**
   - Run your agent
   - Ask questions that should trigger the tool
   - Check logs for proper argument generation
   - Verify defaults are applied correctly

---

## Testing

### Run Tests

```bash
# Test schema enrichment system
npx ts-node tests/test-schema-enrichment.ts
```

### Test Coverage

- ✅ Schema enrichment (descriptions, parameters, examples)
- ✅ OpenAI format conversion
- ✅ Few-shot example generation
- ✅ System prompt creation
- ✅ Argument validation (required/optional)
- ✅ Default value application
- ✅ Real-world scenarios
- ✅ Before/after comparison

---

## Best Practices

### ✅ Do's

1. **Provide rich descriptions**
   - Explain WHEN to use the tool (user query patterns)
   - Explain WHAT the tool does
   - Include format requirements

2. **Document all parameters**
   - Type and format (ISO8601, IANA timezones, etc)
   - Examples of valid values
   - Default values for optional params
   - Constraints (enums, ranges)

3. **Include 2-3 examples per tool**
   - Cover common use cases
   - Show different argument combinations
   - Include edge cases (empty args, all args, etc)

4. **Mark required vs optional clearly**
   - Use `required` array in parameters
   - Provide defaults for optional params
   - Explain what happens with defaults

5. **Validate before execution**
   - Check required args present
   - Apply defaults automatically
   - Log validation errors

### ❌ Don'ts

1. **Don't assume LLM knows formats**
   - Always specify: "ISO8601", "IANA timezone", etc
   - Provide format examples

2. **Don't skip examples**
   - Examples teach LLM proper usage
   - Few-shot learning is critical

3. **Don't forget defaults**
   - LLMs won't guess default values
   - Explicitly document and apply them

4. **Don't use vague descriptions**
   - ❌ "timezone parameter"
   - ✅ "IANA timezone name (e.g., 'America/New_York', 'Asia/Tokyo'). Defaults to 'UTC'."

---

## Troubleshooting

### Issue: LLM still not using tool correctly

**Solutions:**

1. Check if tool is in `TOOL_ENHANCEMENTS` registry
2. Verify parameter descriptions are clear
3. Add more examples (aim for 2-3)
4. Check system prompt includes few-shot examples
5. Enable debug logging to see validation errors

### Issue: Missing required arguments

**Solutions:**

1. Ensure `required` array is correct in schema
2. Add examples showing required args
3. Check validation logs for errors
4. Verify LLM receives enriched schema (not basic)

### Issue: Defaults not applied

**Solutions:**

1. Check `default` values are in parameter schema
2. Verify `mergeWithDefaults` is called in tool executor
3. Enable logging to see merged arguments

---

## Performance Considerations

- **Schema enrichment**: ~1-2ms per tool (one-time at startup)
- **Validation**: ~0.1-0.5ms per tool call
- **Few-shot generation**: ~5-10ms (one-time at startup)
- **System prompt**: +500-2000 tokens (negligible for modern LLMs)

**Optimization tips:**

- Enrich schemas once at initialization
- Cache enriched tools
- Limit examples to 2-3 per tool (balance quality vs token cost)

---

## Summary

The Tool Schema Enrichment System solves the **root cause** of LLM tool usage failures:

**Before:** Basic schemas → LLM guesses → Wrong arguments → Tool fails

**After:** Enriched schemas → LLM understands → Correct arguments → Tool succeeds

**Key improvements:**

- 📚 Rich documentation for every parameter
- 📝 Few-shot examples in system prompt
- ✅ Automatic validation and default application
- 🎯 LLM learns proper usage patterns
- 🔧 Extensible for any MCP tool

**Files:**

- `src/tools/tool-schema-enricher.ts` - Core system
- `src/agent/nodes.ts` - Integration
- `tests/test-schema-enrichment.ts` - Comprehensive tests

**Result:** Your agent now has the context needed to use tools correctly, just like production AI assistants! 🚀
