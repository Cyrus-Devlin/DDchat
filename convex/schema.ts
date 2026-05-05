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
});
