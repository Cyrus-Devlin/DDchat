import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("rules").collect();
    return all
      .filter((r) => r.retiredAt === undefined || r.retiredAt === null)
      .sort((a, b) => a.priority - b.priority);
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, { query: q }) => {
    const all = await ctx.db.query("rules").collect();
    const lower = q.toLowerCase();
    return all.filter(
      (r) =>
        (r.retiredAt === undefined || r.retiredAt === null) &&
        r.ruleText.toLowerCase().includes(lower)
    );
  },
});

export const add = mutation({
  args: {
    ruleText: v.string(),
    structured: v.any(),
    priority: v.optional(v.number()),
    createdVia: v.union(v.literal("coach_chat"), v.literal("manual")),
  },
  handler: async (ctx, { ruleText, structured, priority, createdVia }) => {
    return await ctx.db.insert("rules", {
      ruleText,
      structured,
      priority: priority ?? 100,
      createdAt: Date.now(),
      createdVia,
    });
  },
});

export const retire = mutation({
  args: { id: v.id("rules") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { retiredAt: Date.now() });
  },
});
