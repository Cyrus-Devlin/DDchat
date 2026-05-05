import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const getOrCreate = mutation({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_customerId", (q) => q.eq("customerId", customerId))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("conversations", {
      customerId,
      autoReplyEnabled: true,
      lastMessageAt: Date.now(),
    });
  },
});
