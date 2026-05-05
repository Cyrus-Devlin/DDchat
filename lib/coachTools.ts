import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const COACH_TOOLS: Tool[] = [
  {
    name: "searchKnowledge",
    description: "Search existing knowledge entries before adding new ones to check for duplicates or conflicts.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search terms" },
      },
      required: ["query"],
    },
  },
  {
    name: "searchRules",
    description: "Search existing rules before adding new ones.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search terms" },
      },
      required: ["query"],
    },
  },
  {
    name: "addKnowledgeEntry",
    description: "Add a knowledge entry after founder confirmation. Always search first.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        content: { type: "string", description: "Cleaned, structured text content" },
        sourceType: { type: "string", enum: ["upload", "chat", "rule"] },
        sourceFileName: { type: "string" },
        supersedesId: { type: "string", description: "ID of entry this replaces (if updating)" },
      },
      required: ["title", "content", "sourceType"],
    },
  },
  {
    name: "addRule",
    description: "Add a business rule. Always search first. For obvious direct statements from the founder, confirm once then add.",
    input_schema: {
      type: "object" as const,
      properties: {
        ruleText: { type: "string", description: "Plain English rule as the founder stated it" },
        structured: {
          type: "object",
          description: "Structured JSON form: { type, constraint, value, applies_to }",
        },
        priority: { type: "number", description: "Lower = higher priority. Default 100." },
      },
      required: ["ruleText", "structured"],
    },
  },
  {
    name: "retireKnowledge",
    description: "Retire (soft-delete) a knowledge entry by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "retireRule",
    description: "Retire (soft-delete) a rule by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "proposePromptUpdate",
    description: "Create a proposed prompt update (NOT active until founder approves). Always show a diff before calling this.",
    input_schema: {
      type: "object" as const,
      properties: {
        persona: { type: "string", enum: ["customer", "coach"] },
        newContent: { type: "string" },
        reason: { type: "string" },
      },
      required: ["persona", "newContent", "reason"],
    },
  },
  {
    name: "activatePromptVersion",
    description: "Activate a proposed prompt version. ONLY call after the founder explicitly says yes. Always show a diff first.",
    input_schema: {
      type: "object" as const,
      properties: {
        versionId: { type: "string" },
      },
      required: ["versionId"],
    },
  },
  {
    name: "rollbackPrompt",
    description: "Roll back to the previous prompt version for a persona.",
    input_schema: {
      type: "object" as const,
      properties: {
        persona: { type: "string", enum: ["customer", "coach"] },
      },
      required: ["persona"],
    },
  },
  {
    name: "getRecentCustomerConversation",
    description: "Fetch a flagged message and surrounding context from the customer chat.",
    input_schema: {
      type: "object" as const,
      properties: {
        messageId: { type: "string" },
      },
      required: ["messageId"],
    },
  },
  {
    name: "simulateCustomerReply",
    description: "Run the current customer Claude prompt against a hypothetical scenario to preview the response.",
    input_schema: {
      type: "object" as const,
      properties: {
        scenario: { type: "string", description: "Hypothetical customer message to test" },
      },
      required: ["scenario"],
    },
  },
  {
    name: "recordFeedback",
    description: "Log founder feedback about a customer AI reply for tracking.",
    input_schema: {
      type: "object" as const,
      properties: {
        messageId: { type: "string" },
        text: { type: "string" },
        sentiment: { type: "string", enum: ["positive", "negative", "neutral"] },
        resolution: {
          type: "string",
          enum: ["addressed_by_rule", "addressed_by_prompt_change", "addressed_by_knowledge", "noted", "pending"],
        },
      },
      required: ["text", "sentiment", "resolution"],
    },
  },
];
