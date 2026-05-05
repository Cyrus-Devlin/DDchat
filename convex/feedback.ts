import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
    messageId: v.optional(v.id("messages")),
    conversationId: v.optional(v.id("conversations")),
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
  handler: async (ctx, args) => {
    return await ctx.db.insert("feedback", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
