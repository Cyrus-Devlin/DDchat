import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const CLAUDE_TOOLS: Tool[] = [
  {
    name: "getAvailableNurses",
    description:
      "Returns nurses who cover the given area and are likely available at the requested datetime. Call this before messaging nurses.",
    input_schema: {
      type: "object" as const,
      properties: {
        area: {
          type: "string",
          description: "Postcode district or area name, e.g. 'W2', 'NW1', 'Notting Hill'",
        },
        datetime: {
          type: "string",
          description: "ISO 8601 datetime string for the requested appointment",
        },
      },
      required: ["area", "datetime"],
    },
  },
  {
    name: "createBooking",
    description:
      "Creates a booking record. Must be called before messageNurses. Returns a bookingId.",
    input_schema: {
      type: "object" as const,
      properties: {
        customerId: { type: "string", description: "Convex ID of the customer" },
        location: { type: "string", description: "Full address for the appointment" },
        requestedTime: { type: "string", description: "ISO 8601 datetime" },
      },
      required: ["customerId", "location", "requestedTime"],
    },
  },
  {
    name: "messageNurses",
    description:
      "Sends an availability query to the specified nurses for a booking. Returns query IDs. Nurses reply asynchronously.",
    input_schema: {
      type: "object" as const,
      properties: {
        nurseIds: { type: "array", items: { type: "string" } },
        bookingId: { type: "string" },
        location: { type: "string" },
        time: { type: "string", description: "ISO 8601 datetime" },
      },
      required: ["nurseIds", "bookingId", "location", "time"],
    },
  },
  {
    name: "checkNurseResponses",
    description: "Returns current yes/no/pending responses from nurses for a booking.",
    input_schema: {
      type: "object" as const,
      properties: {
        bookingId: { type: "string" },
      },
      required: ["bookingId"],
    },
  },
  {
    name: "confirmBooking",
    description: "Locks a booking with a specific nurse and notifies the customer.",
    input_schema: {
      type: "object" as const,
      properties: {
        bookingId: { type: "string" },
        nurseId: { type: "string" },
      },
      required: ["bookingId", "nurseId"],
    },
  },
  {
    name: "proposeAlternativeTimes",
    description:
      "Sends a message proposing alternative appointment times when no nurses are available.",
    input_schema: {
      type: "object" as const,
      properties: {
        bookingId: { type: "string" },
        times: { type: "array", items: { type: "string" } },
      },
      required: ["bookingId", "times"],
    },
  },
  {
    name: "escalateToHuman",
    description:
      "Flags the conversation for human review and stops AI auto-reply. Use for medical questions or anything outside booking scope.",
    input_schema: {
      type: "object" as const,
      properties: {
        reason: { type: "string" },
      },
      required: ["reason"],
    },
  },
];
