import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("knowledge").collect();
    return all.filter((k) => k.retiredAt === undefined || k.retiredAt === null);
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, { query: q }) => {
    const all = await ctx.db.query("knowledge").collect();
    const lower = q.toLowerCase();
    return all.filter(
      (k) =>
        (k.retiredAt === undefined || k.retiredAt === null) &&
        (k.title.toLowerCase().includes(lower) ||
          k.content.toLowerCase().includes(lower))
    );
  },
});

export const add = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    sourceType: v.union(
      v.literal("upload"),
      v.literal("chat"),
      v.literal("rule")
    ),
    sourceFileName: v.optional(v.string()),
    supersedesId: v.optional(v.id("knowledge")),
  },
  handler: async (ctx, { title, content, sourceType, sourceFileName, supersedesId }) => {
    if (supersedesId) {
      await ctx.db.patch(supersedesId, { retiredAt: Date.now() });
    }
    return await ctx.db.insert("knowledge", {
      title,
      content,
      sourceType,
      sourceFileName,
      supersedes: supersedesId,
      createdAt: Date.now(),
    });
  },
});

export const retire = mutation({
  args: { id: v.id("knowledge") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { retiredAt: Date.now() });
  },
});
