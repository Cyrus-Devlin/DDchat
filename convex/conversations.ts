import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const customer = await ctx.db.query("customers").first();
    if (!customer) throw new Error("No customers seeded — run /api/seed first");

    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_customerId", (q) => q.eq("customerId", customer._id))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("conversations", {
      customerId: customer._id,
      autoReplyEnabled: true,
      lastMessageAt: Date.now(),
    });
  },
});

export const get = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    return await ctx.db.get(conversationId);
  },
});

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
