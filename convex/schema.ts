import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  customers: defineTable({
    name: v.string(),
    phone: v.string(),
    preferences: v.string(),
    createdAt: v.number(),
  }),

  nurses: defineTable({
    name: v.string(),
    phone: v.string(),
    coverageAreas: v.array(v.string()),
    workingHours: v.object({
      start: v.string(),
      end: v.string(),
      days: v.array(v.string()),
    }),
    simulatedReliability: v.number(),
  }),

  conversations: defineTable({
    customerId: v.id("customers"),
    autoReplyEnabled: v.boolean(),
    lastMessageAt: v.number(),
  }).index("by_customerId", ["customerId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    sender: v.union(
      v.literal("customer"),
      v.literal("ai"),
      v.literal("founder"),
      v.literal("nurse")
    ),
    // Stores the string form of a customerId, nurseId, or staffMemberId
    senderRefId: v.optional(v.string()),
    text: v.string(),
    channel: v.union(
      v.literal("prototype"),
      v.literal("whatsapp"),
      v.literal("sms"),
      v.literal("app")
    ),
    createdAt: v.number(),
    claudeReasoning: v.optional(v.any()),
  }).index("by_conversation", ["conversationId", "createdAt"]),

  bookings: defineTable({
    customerId: v.id("customers"),
    nurseId: v.optional(v.id("nurses")),
    location: v.string(),
    requestedTime: v.number(),
    confirmedTime: v.optional(v.number()),
    state: v.union(
      v.literal("requested"),
      v.literal("polling_nurses"),
      v.literal("confirmed"),
      v.literal("cancelled")
    ),
    createdAt: v.number(),
  }).index("by_customerId", ["customerId"]),

  nurseQueries: defineTable({
    bookingId: v.id("bookings"),
    nurseId: v.id("nurses"),
    sentAt: v.number(),
    response: v.optional(v.union(v.literal("yes"), v.literal("no"))),
    respondedAt: v.optional(v.number()),
    responseDelayMs: v.number(),
  })
    .index("by_bookingId", ["bookingId"])
    .index("by_nurseId", ["nurseId"]),

  staffMembers: defineTable({
    name: v.string(),
    phone: v.string(),
    role: v.union(v.literal("founder"), v.literal("admin")),
    commandPermissions: v.array(v.string()),
  }),

  knowledge: defineTable({
    title: v.string(),
    content: v.string(),
    sourceType: v.union(
      v.literal("upload"),
      v.literal("chat"),
      v.literal("rule")
    ),
    sourceFileName: v.optional(v.string()),
    supersedes: v.optional(v.id("knowledge")),
    createdAt: v.number(),
    retiredAt: v.optional(v.number()),
  }),

  rules: defineTable({
    ruleText: v.string(),
    structured: v.any(),
    priority: v.number(),
    createdAt: v.number(),
    retiredAt: v.optional(v.number()),
    createdVia: v.union(v.literal("coach_chat"), v.literal("manual")),
  }),

  promptVersions: defineTable({
    version: v.number(),
    persona: v.union(v.literal("customer"), v.literal("coach")),
    content: v.string(),
    changeReason: v.string(),
    proposedBy: v.union(v.literal("coach_claude"), v.literal("founder")),
    proposedAt: v.number(),
    approvedAt: v.optional(v.number()),
    currentlyActive: v.boolean(),
  })
    .index("by_persona", ["persona"])
    .index("by_persona_active", ["persona", "currentlyActive"]),

  feedback: defineTable({
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
    createdAt: v.number(),
  }),

  coachConversations: defineTable({
    createdAt: v.number(),
  }),

  coachMessages: defineTable({
    coachConversationId: v.id("coachConversations"),
    sender: v.union(v.literal("founder"), v.literal("coach")),
    text: v.string(),
    attachedFileId: v.optional(v.string()),
    flaggedMessageId: v.optional(v.id("messages")),
    claudeReasoning: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_conversation", ["coachConversationId", "createdAt"]),
});
