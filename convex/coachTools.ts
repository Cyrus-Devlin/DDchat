"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const searchKnowledge = action({
  args: { query: v.string() },
  handler: async (ctx, { query }): Promise<unknown> => {
    return await ctx.runQuery(api.knowledge.search, { query });
  },
});

export const searchRules = action({
  args: { query: v.string() },
  handler: async (ctx, { query }): Promise<unknown> => {
    return await ctx.runQuery(api.rules.search, { query });
  },
});

export const addKnowledgeEntry = action({
  args: {
    title: v.string(),
    content: v.string(),
    sourceType: v.union(
      v.literal("upload"),
      v.literal("chat"),
      v.literal("rule")
    ),
    sourceFileName: v.optional(v.string()),
    supersedesId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    return await ctx.runMutation(api.knowledge.add, {
      title: args.title,
      content: args.content,
      sourceType: args.sourceType,
      sourceFileName: args.sourceFileName,
      supersedesId: args.supersedesId as any,
    });
  },
});

export const addRule = action({
  args: {
    ruleText: v.string(),
    structured: v.any(),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    return await ctx.runMutation(api.rules.add, {
      ruleText: args.ruleText,
      structured: args.structured,
      priority: args.priority,
      createdVia: "coach_chat",
    });
  },
});

export const retireKnowledge = action({
  args: { id: v.string() },
  handler: async (ctx, { id }): Promise<{ retired: boolean }> => {
    await ctx.runMutation(api.knowledge.retire, { id: id as any });
    return { retired: true };
  },
});

export const retireRule = action({
  args: { id: v.string() },
  handler: async (ctx, { id }): Promise<{ retired: boolean }> => {
    await ctx.runMutation(api.rules.retire, { id: id as any });
    return { retired: true };
  },
});

export const proposePromptUpdate = action({
  args: {
    persona: v.union(v.literal("customer"), v.literal("coach")),
    newContent: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<{ versionId: string; status: string }> => {
    const id = await ctx.runMutation(api.promptVersions.propose, {
      persona: args.persona,
      content: args.newContent,
      changeReason: args.reason,
      proposedBy: "coach_claude",
    });
    return { versionId: id as unknown as string, status: "proposed" };
  },
});

export const activatePromptVersion = action({
  args: { versionId: v.string() },
  handler: async (ctx, { versionId }): Promise<{ activated: boolean }> => {
    await ctx.runMutation(api.promptVersions.activate, {
      versionId: versionId as any,
    });
    return { activated: true };
  },
});

export const rollbackPrompt = action({
  args: { persona: v.union(v.literal("customer"), v.literal("coach")) },
  handler: async (ctx, { persona }): Promise<{ rolledBack: boolean }> => {
    await ctx.runMutation(api.promptVersions.rollback, { persona });
    return { rolledBack: true };
  },
});

export const getRecentCustomerConversation = action({
  args: { messageId: v.string() },
  handler: async (ctx, { messageId }): Promise<unknown> => {
    const message = await ctx.runQuery(api.messages.getById, {
      messageId: messageId as any,
    });
    if (!message) return null;

    const surrounding = await ctx.runQuery(api.messages.list, {
      conversationId: message.conversationId,
    });

    const idx = surrounding.findIndex((m: { _id: string }) => m._id === messageId);
    const context = surrounding.slice(Math.max(0, idx - 3), idx + 2);

    return { flaggedMessage: message, context };
  },
});

export const simulateCustomerReply = action({
  args: { scenario: v.string() },
  handler: async (ctx, { scenario }): Promise<unknown> => {
    const [activePromptRow, activeRules, activeKnowledge] = await Promise.all([
      ctx.runQuery(api.promptVersions.getActive, { persona: "customer" }),
      ctx.runQuery(api.rules.listActive, {}),
      ctx.runQuery(api.knowledge.listActive, {}),
    ]);

    const basePrompt: string =
      (activePromptRow as { content?: string } | null)?.content ??
      "You are Dripdash's booking assistant.";
    const rules = activeRules as Array<{ ruleText: string }>;
    const knowledge = activeKnowledge as Array<{ title: string; content: string }>;

    const rulesSection =
      rules.length > 0
        ? `\n\n## Business Rules\n${rules.map((r, i) => `${i + 1}. ${r.ruleText}`).join("\n")}`
        : "";
    const knowledgeSection =
      knowledge.length > 0
        ? `\n\n## Knowledge Base\n${knowledge.map((k) => `### ${k.title}\n${k.content}`).join("\n\n")}`
        : "";
    const systemPrompt = basePrompt + rulesSection + knowledgeSection;

    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: scenario }],
    });

    const textBlock = res.content.find((b) => b.type === "text");
    const reply: string = textBlock && "text" in textBlock ? (textBlock.text as string) : "";
    const version = (activePromptRow as { version?: number } | null)?.version ?? 0;
    return { scenario, reply, promptVersion: version };
  },
});

export const recordFeedback = action({
  args: {
    messageId: v.optional(v.string()),
    text: v.string(),
    sentiment: v.union(
      v.literal("positive"),
      v.literal("negative"),
      v.literal("neutral")
    ),
    resolution: v.union(
      v.literal("addressed_by_rule"),
      v.literal("addressed_by_prompt_change"),
      v.literal("addressed_by_knowledge"),
      v.literal("noted"),
      v.literal("pending")
    ),
  },
  handler: async (ctx, args): Promise<unknown> => {
    return await ctx.runMutation(api.feedback.record, {
      messageId: args.messageId as any,
      text: args.text,
      sentiment: args.sentiment,
      resolution: args.resolution,
    });
  },
});
