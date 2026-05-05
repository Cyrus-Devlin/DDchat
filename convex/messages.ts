import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("asc")
      .collect();
  },
});

export const getById = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    return await ctx.db.get(messageId);
  },
});

// Stage 1: hardcoded AI reply. Stage 2 replaces this with Claude streaming.
export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    customerId: v.id("customers"),
    text: v.string(),
    skipAiReply: v.optional(v.boolean()),
  },
  handler: async (ctx, { conversationId, customerId, text, skipAiReply }) => {
    const now = Date.now();

    await ctx.db.insert("messages", {
      conversationId,
      sender: "customer",
      senderRefId: customerId,
      text,
      channel: "prototype",
      createdAt: now,
    });

    await ctx.db.patch(conversationId, { lastMessageAt: now });

    if (!skipAiReply) {
      await ctx.db.insert("messages", {
        conversationId,
        sender: "ai",
        text: "Hi! I'm the Dripdash booking assistant. I can help you schedule an IV therapy session. What area are you in, and when are you looking to book?",
        channel: "prototype",
        createdAt: now + 1,
      });
    }
  },
});

export const clearConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
  },
});

export const saveAiReply = mutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.string(),
    claudeReasoning: v.optional(v.any()),
  },
  handler: async (ctx, { conversationId, text, claudeReasoning }) => {
    await ctx.db.insert("messages", {
      conversationId,
      sender: "ai",
      text,
      channel: "prototype",
      createdAt: Date.now(),
      ...(claudeReasoning ? { claudeReasoning } : {}),
    });
    await ctx.db.patch(conversationId, { lastMessageAt: Date.now() });
  },
});
