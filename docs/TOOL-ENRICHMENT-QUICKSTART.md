# Quick Start: Tool Schema Enrichment

## The Problem You Had

```
User: "What's the current time?"
Agent: 🔴 Tool execution denied/failed - missing arguments
```

**Why?** The LLM didn't know:

- The `current_time` tool exists
- `timezone` and `format` are optional
- Default values (UTC, RFC3339)

## The Solution

✅ **Enriched schemas** teach the LLM how to use tools correctly

## How It Works (3 Steps)

### 1. Tool schemas get enriched at startup

```typescript
// Before: Basic schema
{
  name: "current_time",
  description: "Get current time",
  inputSchema: { properties: { timezone, format } }
}

// After: Enriched schema
{
  name: "current_time",
  description: "Get the current time in a specified timezone or UTC by default.
                Use when user asks 'what time is it?'",
  parameters: {
    timezone: {
      type: "string",
      description: "IANA timezone (e.g., 'America/New_York')",
      examples: ["America/New_York", "Asia/Tokyo"],
      default: "UTC"
    },
    format: {
      type: "string",
      description: "Time format (default: RFC3339)",
      default: "RFC3339"
    }
  },
  examples: [
    {
      userQuery: "What's the current time?",
      toolCall: { arguments: {} }
    }
  ]
}
```

### 2. Few-shot examples added to system prompt

```typescript
// System prompt now includes:
"
## Tool Usage Examples

User: What's the current time?
Assistant: I'll use the current_time tool with: {}
(Returns current UTC time)

User: What time is it in New York?
Assistant: I'll use the current_time tool with: {"timezone": "America/New_York"}
(Returns current time in New York timezone)
"
```

### 3. Arguments validated & defaults applied

```typescript
// LLM generates: current_time with no args
// System validates and merges:
{ } + { timezone: "UTC", format: "RFC3339" }
// Tool executes with: { timezone: "UTC", format: "RFC3339" }
✅ Success!
```

## What You Get

✅ LLM knows **when** to use each tool  
✅ LLM knows **what** arguments to provide  
✅ LLM sees **examples** of proper usage  
✅ **Defaults** applied automatically  
✅ **Validation** before execution

## Testing

```bash
# See it in action
npx ts-node tests/test-schema-enrichment.ts
```

## Adding Your Own Tool

```typescript
// In src/tools/tool-schema-enricher.ts
const TOOL_ENHANCEMENTS = {
  your_tool_name: {
    description: "Clear description + when to use it",
    parameters: {
      type: "object",
      properties: {
        your_param: {
          type: "string",
          description: "What it does, format, examples",
          examples: ["example1", "example2"],
          default: "default_value",
        },
      },
      required: ["required_param"],
    },
    examples: [
      {
        userQuery: "User's question",
        toolCall: { arguments: { your_param: "value" } },
      },
    ],
  },
};
```

## Result

```
User: "What's the current time?"
Agent: ✅ *uses current_time tool correctly*
       "It's currently 10:57:28 AM UTC"
```

## Next Steps

1. ✅ Already integrated into your agent
2. 📖 Read full docs: `docs/TOOL-SCHEMA-ENRICHMENT.md`
3. 🧪 Run tests to see examples
4. ➕ Add enhancements for custom tools

---

**The Bottom Line:** Your agent now has the same tool-calling intelligence as production AI assistants like ChatGPT, Claude, and Google Assistant! 🎉
