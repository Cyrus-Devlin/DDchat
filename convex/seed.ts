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
