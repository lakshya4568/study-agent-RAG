/**
 * Tool Schema Enricher
 *
 * Turns MCP tool definitions into the function definitions sent to the model, and checks
 * and repairs the arguments the model sends back before a tool runs.
 *
 * Everything is derived from each tool's own JSON Schema, so new MCP servers work without
 * changes here. The input must be the server's JSON Schema (not a Zod object).
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

/** The subset of JSON Schema that MCP tools use. */
interface JsonSchema {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
}

export interface ParameterSchema {
  /** One concrete JSON type: string, number, integer, boolean, array or object. */
  type: string;
  description: string;
  enum?: string[];
  default?: unknown;
  items?: { type: string };
}

export interface EnrichedToolSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ParameterSchema>;
    required: string[];
  };
}

/**
 * Returns the non-null branch of anyOf/oneOf, merged with the parent's description and default.
 * Nullable fields such as ["string", "null"] or { anyOf: [{ type: "string" }, { type: "null" }] }
 * are treated as the plain type.
 */
function effectiveSchema(prop: JsonSchema): JsonSchema {
  const branches = prop.anyOf ?? prop.oneOf;
  const chosen = branches?.find((branch) => branch.type !== "null");
  if (!chosen) return prop;
  return {
    ...chosen,
    description: prop.description ?? chosen.description,
    default: prop.default ?? chosen.default,
  };
}

/** Returns a single JSON type for a property. Unknown shapes fall back to "string". */
export function resolveType(prop: JsonSchema): string {
  const schema = effectiveSchema(prop);
  const declared = Array.isArray(schema.type)
    ? schema.type.find((type) => type !== "null")
    : schema.type;
  if (declared) return declared;
  if (schema.items) return "array";
  if (schema.properties) return "object";
  if (schema.enum && schema.enum.length > 0) {
    const first = schema.enum[0];
    if (typeof first === "number") return "number";
    if (typeof first === "boolean") return "boolean";
  }
  return "string";
}

function describeParameter(name: string, prop: JsonSchema, type: string): string {
  const schema = effectiveSchema(prop);
  const parts = [schema.description?.trim() || `The ${name} value.`];
  if (type === "boolean") {
    parts.push("Send true or false (a boolean, not text).");
  }
  if (type === "array") {
    const itemType = schema.items ? resolveType(schema.items) : "string";
    parts.push(`Send a JSON array of ${itemType} values.`);
  }
  if (schema.enum && schema.enum.length > 0) {
    parts.push(`Allowed values: ${schema.enum.map(String).join(", ")}.`);
  }
  if (schema.default !== undefined) {
    parts.push(`Default: ${JSON.stringify(schema.default)}.`);
  }
  return parts.join(" ");
}

/** Converts one MCP tool into the enriched form used for the model and for argument checks. */
export function enrichToolSchema(tool: Tool): EnrichedToolSchema {
  const schema = (tool.inputSchema ?? {}) as JsonSchema;
  const properties = schema.properties ?? {};
  const required = (Array.isArray(schema.required) ? schema.required : []).filter(
    (name) => name in properties,
  );

  const enrichedProperties: Record<string, ParameterSchema> = {};
  for (const [name, prop] of Object.entries(properties)) {
    const type = resolveType(prop);
    const effective = effectiveSchema(prop);
    enrichedProperties[name] = {
      type,
      description: describeParameter(name, prop, type),
      ...(effective.enum ? { enum: effective.enum.map(String) } : {}),
      ...(effective.default !== undefined ? { default: effective.default } : {}),
      ...(type === "array"
        ? { items: { type: effective.items ? resolveType(effective.items) : "string" } }
        : {}),
    };
  }

  return {
    name: tool.name,
    description: tool.description || `Runs the ${tool.name} tool.`,
    parameters: {
      type: "object",
      properties: enrichedProperties,
      required,
    },
  };
}

/** Converts an enriched schema to the OpenAI function-calling format used by the model API. */
export function toOpenAIToolFormat(
  enriched: EnrichedToolSchema,
): ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: enriched.name,
      description: enriched.description,
      parameters: enriched.parameters,
    },
  };
}

/** Enriches every tool in a list. */
export function enrichAllTools(tools: Tool[]): EnrichedToolSchema[] {
  return tools.map(enrichToolSchema);
}

/** One line per tool, e.g. `add_question(formId: string, questionType: TEXT|CHOICE, options?: string[])`. */
export function describeToolSignature(tool: EnrichedToolSchema): string {
  const required = new Set(tool.parameters.required);
  const args = Object.entries(tool.parameters.properties).map(([name, param]) => {
    const typeText = param.enum
      ? param.enum.join("|")
      : param.type === "array"
        ? `${param.items?.type ?? "value"}[]`
        : param.type;
    return `${name}${required.has(name) ? "" : "?"}: ${typeText}`;
  });
  return `${tool.name}(${args.join(", ")})`;
}

/**
 * Adds a compact tool reference to the system prompt. The full schemas are also sent in the
 * tools field; this list gives exact argument names and the rules that most often go wrong.
 */
export function createToolAwareSystemPrompt(
  basePrompt: string,
  enrichedTools: EnrichedToolSchema[],
): string {
  if (enrichedTools.length === 0) {
    return basePrompt;
  }

  const signatures = enrichedTools
    .map((tool) => `- ${describeToolSignature(tool)}`)
    .join("\n");

  return `${basePrompt}

## Tool Reference
Call a tool only with the argument names listed here, spelled exactly. A "?" marks an optional argument.
${signatures}

**Argument rules:**
- Send booleans as true or false, not as text.
- Send arrays as JSON arrays, e.g. ["Option A", "Option B"].
- Leave out optional arguments you do not need. Do not send null.
- If a tool reports a missing or invalid argument, correct that argument and call the tool again.`;
}

/** Checks that required arguments are present and collects defaults for missing optional ones. */
export function validateToolArguments(
  toolName: string,
  args: Record<string, unknown>,
  schema: EnrichedToolSchema,
): { valid: boolean; errors: string[]; defaults: Record<string, unknown> } {
  const errors: string[] = [];
  const defaults: Record<string, unknown> = {};

  for (const reqArg of schema.parameters.required) {
    if (args[reqArg] === undefined) {
      errors.push(`missing required argument "${reqArg}"`);
    }
  }

  for (const [paramName, param] of Object.entries(schema.parameters.properties)) {
    if (!(paramName in args) && param.default !== undefined) {
      defaults[paramName] = param.default;
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.map((error) => `${toolName}: ${error}`),
    defaults,
  };
}

/** Merges user-provided arguments over defaults. */
export function mergeWithDefaults(
  args: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  return { ...defaults, ...args };
}

export interface RepairResult {
  args: Record<string, unknown>;
  /** Human-readable list of what was changed, for logs. */
  changes: string[];
}

/** Lowercase letters and digits only, so "question_title" and "questionTitle" compare equal. */
const simplify = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The last word of a name, e.g. "questionTitle" -> "title". */
const lastWord = (name: string): string =>
  simplify(name.replace(/([a-z])([A-Z])/g, "$1 $2").split(/[\s_-]+/).pop() ?? name);

function coerceValue(value: unknown, param: ParameterSchema): unknown {
  switch (param.type) {
    case "boolean": {
      if (typeof value === "string") {
        const text = value.trim().toLowerCase();
        if (["true", "yes", "y", "1"].includes(text)) return true;
        if (["false", "no", "n", "0"].includes(text)) return false;
      }
      return value;
    }
    case "integer":
    case "number": {
      if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
        return Number(value);
      }
      return value;
    }
    case "array": {
      if (typeof value !== "string") {
        return Array.isArray(value) ? value : [value];
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        // Not JSON: treat it as one item per line
        parsed = value.split(/\r?\n/);
      }
      const list = Array.isArray(parsed) ? parsed : [parsed];
      return list
        .map((item) => (typeof item === "string" ? item.trim() : item))
        .filter((item) => item !== "");
    }
    case "string": {
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
      if (typeof value === "string" && param.enum) {
        const match = param.enum.find(
          (option) => option.toLowerCase() === value.trim().toLowerCase(),
        );
        return match ?? value;
      }
      return value;
    }
    default:
      return value;
  }
}

/**
 * Fixes the common mistakes models make before a tool call is checked:
 * - null for an optional argument (treated as not given)
 * - an argument name that differs only in case or punctuation ("question_title")
 * - an unknown name that names the same concept as a missing required argument ("title" for "questionTitle")
 * - values in the wrong JSON type: "True" for a boolean, "10" for a number, JSON text for an array
 * Unknown arguments that cannot be matched are dropped and reported.
 */
export function repairToolArguments(
  args: Record<string, unknown>,
  schema: EnrichedToolSchema,
): RepairResult {
  const properties = schema.parameters.properties;
  const propertyNames = Object.keys(properties);
  const changes: string[] = [];
  const repaired: Record<string, unknown> = {};
  const unmatched: Array<[string, unknown]> = [];

  for (const [key, value] of Object.entries(args ?? {})) {
    if (value === null || value === undefined) continue;
    if (key in properties) {
      repaired[key] = value;
      continue;
    }
    const sameConcept = propertyNames.find((name) => simplify(name) === simplify(key));
    if (sameConcept) {
      repaired[sameConcept] = value;
      changes.push(`${key} → ${sameConcept}`);
      continue;
    }
    unmatched.push([key, value]);
  }

  for (const [key, value] of unmatched) {
    const stillMissing = schema.parameters.required.filter((name) => !(name in repaired));
    const target = stillMissing.find(
      (name) =>
        lastWord(name) === lastWord(key) &&
        properties[name].type === "string" &&
        typeof value === "string",
    );
    if (target) {
      repaired[target] = value;
      changes.push(`${key} → ${target}`);
    } else {
      changes.push(`dropped unknown argument "${key}"`);
    }
  }

  for (const name of Object.keys(repaired)) {
    const before = repaired[name];
    const after = coerceValue(before, properties[name]);
    if (JSON.stringify(after) !== JSON.stringify(before)) {
      repaired[name] = after;
      changes.push(`${name}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
    }
  }

  return { args: repaired, changes };
}
