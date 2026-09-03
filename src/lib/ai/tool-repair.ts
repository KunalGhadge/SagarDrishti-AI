import "server-only";

/**
 * Defensive Tool Calling & Argument Repair Utilities
 * 
 * Specifically addresses Groq and open-weight model quirks:
 * 1. Malformed JSON argument strings (trailing commas, single quotes, unquoted keys, truncated braces)
 * 2. Missing or empty tool call IDs
 * 3. Schema sanitization for Groq compatibility
 * 4. Resilient argument recovery so the application never crashes
 */

/**
 * Robust JSON repair for LLM-generated tool arguments.
 */
export function repairJsonString(raw: string): string {
  if (!raw || typeof raw !== "string") return "{}";
  let str = raw.trim();

  // If already valid JSON, return immediately
  try {
    JSON.parse(str);
    return str;
  } catch {
    // Proceed with repairs
  }

  // 1. Strip markdown code fences if model enclosed arguments in ```json ... ```
  if (str.startsWith("```")) {
    str = str.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  // 2. Extract substring between first { and last }
  const firstOpenBrace = str.indexOf("{");
  const lastCloseBrace = str.lastIndexOf("}");
  if (firstOpenBrace !== -1 && lastCloseBrace !== -1 && lastCloseBrace > firstOpenBrace) {
    str = str.substring(firstOpenBrace, lastCloseBrace + 1);
  } else if (firstOpenBrace !== -1 && lastCloseBrace === -1) {
    // Missing closing brace (truncated output)
    str = str.substring(firstOpenBrace) + "}";
  }

  // 3. Remove trailing commas before } or ]
  str = str.replace(/,\s*([\}\]])/g, "$1");

  // 4. Replace single-quoted property names or values with double-quoted ones
  str = str.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

  // 5. Quote unquoted keys (e.g. { latitude: 18.9 } -> { "latitude": 18.9 })
  str = str.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

  // 6. Clean up any remaining dangling commas
  str = str.replace(/,\s*$/, "");

  // Balance unmatched open braces/brackets if still truncated
  let openBraces = 0;
  let openBrackets = 0;
  for (const char of str) {
    if (char === "{") openBraces++;
    if (char === "}") openBraces--;
    if (char === "[") openBrackets++;
    if (char === "]") openBrackets--;
  }

  while (openBraces > 0) {
    str += "}";
    openBraces--;
  }
  while (openBrackets > 0) {
    str += "]";
    openBrackets--;
  }

  try {
    JSON.parse(str);
    return str;
  } catch {
    // If still unparseable, return empty object
    return "{}";
  }
}

/**
 * Safely parses tool arguments from any model response.
 * Never throws an unhandled error; returns parsed object or empty fallback.
 */
export function safeParseToolArguments(args: any): Record<string, any> {
  if (!args) return {};
  if (typeof args === "object" && args !== null) {
    return args;
  }
  if (typeof args === "string") {
    try {
      return JSON.parse(args);
    } catch {
      const repaired = repairJsonString(args);
      try {
        return JSON.parse(repaired);
      } catch {
        return {};
      }
    }
  }
  return {};
}

/**
 * Sanitizes a tool schema for Groq API compatibility.
 * Groq rejects OpenAPI schemas with certain complex constraints.
 */
export function sanitizeSchemaForGroq(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;

  const clone = JSON.parse(JSON.stringify(schema));

  function cleanNode(node: any) {
    if (!node || typeof node !== "object") return;

    // Delete unsupported meta keys
    delete node["$schema"];
    delete node["$id"];
    delete node["patternProperties"];

    // If type is object and properties is missing or empty, ensure valid schema
    if (node.type === "object" && !node.properties) {
      node.properties = {};
    }

    // Clean child properties
    if (node.properties && typeof node.properties === "object") {
      for (const key of Object.keys(node.properties)) {
        cleanNode(node.properties[key]);
      }
    }

    if (node.items && typeof node.items === "object") {
      cleanNode(node.items);
    }

    if (Array.isArray(node.allOf)) {
      node.allOf.forEach(cleanNode);
    }
    if (Array.isArray(node.anyOf)) {
      node.anyOf.forEach(cleanNode);
    }
    if (Array.isArray(node.oneOf)) {
      node.oneOf.forEach(cleanNode);
    }
  }

  cleanNode(clone);
  return clone;
}

/**
 * Sanitizes an array of tools for Groq execution.
 */
export function sanitizeToolsForGroq<T extends Record<string, any>>(tools: T): T {
  const sanitized: Record<string, any> = {};
  for (const [name, tool] of Object.entries(tools)) {
    if (!tool) continue;
    // Clone tool definition
    const toolObj = { ...tool };
    if (toolObj.parameters) {
      toolObj.parameters = sanitizeSchemaForGroq(toolObj.parameters);
    }
    sanitized[name] = toolObj;
  }
  return sanitized as T;
}
