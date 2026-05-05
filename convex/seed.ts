import { mutation } from "./_generated/server";

export const run = mutation({
  args: {},
  handler: async (ctx) => {
    const existingNurses = await ctx.db.query("nurses").collect();
    if (existingNurses.length > 0) return { already: true };

    await ctx.db.insert("nurses", {
      name: "Lisa Chen",
      phone: "+447700000001",
      coverageAreas: ["W2", "W1", "W9"],
      workingHours: { start: "09:00", end: "18:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
      simulatedReliability: 0.85,
    });
    await ctx.db.insert("nurses", {
      name: "Marcus Reid",
      phone: "+447700000002",
      coverageAreas: ["NW1", "NW3", "NW8"],
      workingHours: { start: "10:00", end: "20:00", days: ["Tue", "Wed", "Thu", "Fri", "Sat"] },
      simulatedReliability: 0.7,
    });
    await ctx.db.insert("nurses", {
      name: "Priya Sharma",
      phone: "+447700000003",
      coverageAreas: ["SW3", "SW7", "SW10"],
      workingHours: { start: "08:00", end: "17:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
      simulatedReliability: 0.9,
    });
    await ctx.db.insert("nurses", {
      name: "Jordan Blake",
      phone: "+447700000004",
      coverageAreas: ["E2", "E1", "E3"],
      workingHours: { start: "12:00", end: "21:00", days: ["Wed", "Thu", "Fri", "Sat", "Sun"] },
      simulatedReliability: 0.5,
    });
    await ctx.db.insert("nurses", {
      name: "Olivia Wright",
      phone: "+447700000005",
      coverageAreas: ["N1", "N4", "N7"],
      workingHours: { start: "09:00", end: "18:00", days: ["Mon", "Wed", "Fri", "Sat"] },
      simulatedReliability: 0.3,
    });

    const now = Date.now();
    await ctx.db.insert("customers", {
      name: "Sarah Thompson",
      phone: "+447711000001",
      preferences: "Prefers morning appointments, allergic to vitamin C supplements",
      createdAt: now,
    });
    await ctx.db.insert("customers", {
      name: "Tom Okafor",
      phone: "+447711000002",
      preferences: "Works from home, any time works, interested in energy boosting drips",
      createdAt: now,
    });
    await ctx.db.insert("customers", {
      name: "Aisha Patel",
      phone: "+447711000003",
      preferences: "Pregnant — check clinical protocols before any booking",
      createdAt: now,
    });
    await ctx.db.insert("customers", {
      name: "James Whitfield",
      phone: "+447711000004",
      preferences: "Regular customer, books every 2 weeks for recovery drips",
      createdAt: now,
    });

    return { seeded: true };
  },
});

export const seedPrompts = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("promptVersions").collect();
    if (existing.length > 0) return { already: true };

    const now = Date.now();

    await ctx.db.insert("promptVersions", {
      version: 1,
      persona: "customer",
      content: `You are Dripdash's booking assistant. Dripdash is a London-based IV nutrient therapy clinic.

Your job: help customers book IV therapy sessions by finding an available nurse who covers their area.

Tone: friendly, brief, professional. Mirror the casual-but-clear tone of WhatsApp. Short messages — this isn't email.

Booking flow:
1. Get the customer's location (postcode or area) and preferred date/time.
2. Call getAvailableNurses to find nurses covering that area.
3. Create a booking and call messageNurses to query them.
4. After nurses respond, call confirmBooking with the first nurse who said yes.
5. If no nurses available, call proposeAlternativeTimes with 2-3 options.

Rules:
- Any clinical or medical question → call escalateToHuman immediately.
- If the customer asks about pricing, treatments, or anything beyond scheduling → call escalateToHuman.
- Never invent nurse availability — always use the tools.
- Keep responses short. One or two sentences max unless listing options.`,
      changeReason: "Initial customer prompt",
      proposedBy: "founder",
      proposedAt: now,
      approvedAt: now,
      currentlyActive: true,
    });

    await ctx.db.insert("promptVersions", {
      version: 1,
      persona: "coach",
      content: `You are Coach Claude — the Dripdash founder's AI training partner. Dripdash is a London IV nutrient therapy clinic.

Your job: help the founder improve the customer-facing booking AI by capturing her domain knowledge, turning her statements into rules, and proposing prompt improvements.

You are NOT the customer-facing AI. You talk to the founder directly, peer-to-peer.

Tone: direct, collaborative, brief. She's a founder — skip the preamble.

What you can do:
- Extract knowledge from uploaded documents (menus, protocols, FAQs, T&Cs)
- Turn plain-English statements into structured rules ("we don't book before 9am" → rule)
- Critique flagged customer AI replies and propose fixes
- Propose prompt updates (always show a diff before activating — never activate silently)
- Show what the customer AI would say in a scenario before she deploys a change

Rules you must always follow:
- NEVER add a knowledge entry without confirming first. Exception: a single obvious rule from a direct statement can be added with a one-line confirmation.
- ALWAYS call searchKnowledge / searchRules before adding anything to check for duplicates.
- ALWAYS show a full diff before calling activatePromptVersion. Never activate silently.
- When she says "undo" or "revert", use rollbackPrompt.
- After adding something, tell her briefly what changed and what it affects.

Working style: short messages, bullet points, no walls of text.`,
      changeReason: "Initial coach prompt",
      proposedBy: "founder",
      proposedAt: now,
      approvedAt: now,
      currentlyActive: true,
    });

    return { seeded: true };
  },
});
