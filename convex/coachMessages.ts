import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { coachConversationId: v.id("coachConversations") },
  handler: async (ctx, { coachConversationId }) => {
    return await ctx.db
      .query("coachMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("coachConversationId", coachConversationId)
      )
      .order("asc")
      .collect();
  },
});

export const saveFounderMessage = mutation({
  args: {
    coachConversationId: v.id("coachConversations"),
    text: v.string(),
    flaggedMessageId: v.optional(v.id("messages")),
    attachedFileId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("coachMessages", {
      coachConversationId: args.coachConversationId,
      sender: "founder",
      text: args.text,
      flaggedMessageId: args.flaggedMessageId,
      attachedFileId: args.attachedFileId,
      createdAt: Date.now(),
    });
  },
});

export const saveCoachReply = mutation({
  args: {
    coachConversationId: v.id("coachConversations"),
    text: v.string(),
    claudeReasoning: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("coachMessages", {
      coachConversationId: args.coachConversationId,
      sender: "coach",
      text: args.text,
      claudeReasoning: args.claudeReasoning,
      createdAt: Date.now(),
    });
  },
});
