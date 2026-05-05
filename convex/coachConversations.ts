import { mutation } from "./_generated/server";

export const getOrCreate = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("coachConversations").first();
    if (existing) return existing._id;
    return await ctx.db.insert("coachConversations", { createdAt: Date.now() });
  },
});
