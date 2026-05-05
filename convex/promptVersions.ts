import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getActive = query({
  args: { persona: v.union(v.literal("customer"), v.literal("coach")) },
  handler: async (ctx, { persona }) => {
    return await ctx.db
      .query("promptVersions")
      .withIndex("by_persona_active", (q) =>
        q.eq("persona", persona).eq("currentlyActive", true)
      )
      .first();
  },
});

export const listByPersona = query({
  args: { persona: v.union(v.literal("customer"), v.literal("coach")) },
  handler: async (ctx, { persona }) => {
    return await ctx.db
      .query("promptVersions")
      .withIndex("by_persona", (q) => q.eq("persona", persona))
      .order("desc")
      .collect();
  },
});

export const propose = mutation({
  args: {
    persona: v.union(v.literal("customer"), v.literal("coach")),
    content: v.string(),
    changeReason: v.string(),
    proposedBy: v.union(v.literal("coach_claude"), v.literal("founder")),
  },
  handler: async (ctx, { persona, content, changeReason, proposedBy }) => {
    const versions = await ctx.db
      .query("promptVersions")
      .withIndex("by_persona", (q) => q.eq("persona", persona))
      .collect();
    const nextVersion = versions.length + 1;

    return await ctx.db.insert("promptVersions", {
      version: nextVersion,
      persona,
      content,
      changeReason,
      proposedBy,
      proposedAt: Date.now(),
      currentlyActive: false,
    });
  },
});

export const activate = mutation({
  args: { versionId: v.id("promptVersions") },
  handler: async (ctx, { versionId }) => {
    const version = await ctx.db.get(versionId);
    if (!version) throw new Error("Version not found");

    const current = await ctx.db
      .query("promptVersions")
      .withIndex("by_persona_active", (q) =>
        q.eq("persona", version.persona).eq("currentlyActive", true)
      )
      .first();
    if (current) {
      await ctx.db.patch(current._id, { currentlyActive: false });
    }

    await ctx.db.patch(versionId, {
      currentlyActive: true,
      approvedAt: Date.now(),
    });
  },
});

export const rollback = mutation({
  args: { persona: v.union(v.literal("customer"), v.literal("coach")) },
  handler: async (ctx, { persona }) => {
    const versions = await ctx.db
      .query("promptVersions")
      .withIndex("by_persona", (q) => q.eq("persona", persona))
      .order("desc")
      .collect();

    const activeIdx = versions.findIndex((v) => v.currentlyActive);
    const active = versions[activeIdx];
    const previous = versions[activeIdx + 1];

    if (!previous) throw new Error("No previous version to roll back to");
    if (active) await ctx.db.patch(active._id, { currentlyActive: false });
    await ctx.db.patch(previous._id, {
      currentlyActive: true,
      approvedAt: Date.now(),
    });
  },
});
