import { mutation } from "./_generated/server";

// Wipes all rules, knowledge, and prompt versions for the customer persona,
// then seeds a clean authoritative set with correct hierarchy.
export const run = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // 1. Retire ALL existing rules
    const allRules = await ctx.db.query("rules").collect();
    for (const rule of allRules) {
      await ctx.db.patch(rule._id, { retiredAt: now });
    }

    // 2. Retire ALL existing knowledge entries
    const allKnowledge = await ctx.db.query("knowledge").collect();
    for (const k of allKnowledge) {
      await ctx.db.patch(k._id, { retiredAt: now });
    }

    // 3. Retire ALL customer prompt versions
    const allPrompts = await ctx.db.query("promptVersions").collect();
    for (const p of allPrompts) {
      await ctx.db.patch(p._id, { currentlyActive: false });
    }

    // 4. Insert clean authoritative customer prompt
    //    System prompt = tone + boundaries + ONE booking flow. Nothing else.
    const promptId = await ctx.db.insert("promptVersions", {
      version: allPrompts.filter((p) => p.persona === "customer").length + 1,
      persona: "customer",
      content: `You are the booking assistant for Dripdash (https://www.dripdash.co.uk/), a London-based IV nutrient therapy clinic.

Tone: Friendly, brief, WhatsApp-style. Short messages. Emojis are fine.

Your only job is to book IV drip appointments.

Booking flow — follow this order exactly:
1. Ask if they've seen the menu. If not, share the menu link.
2. Once they've chosen a drip, ask for their postcode. Check coverage silently — only speak up if you DON'T cover their area. Never say "great, that's London."
3. Ask what date and time they'd like.
4. Confirm the drip price + the £80 call-out fee on top.
5. Say "Let me check with the nurses" — then ask them to pay the £80 call-out fee via payment link to confirm.
6. Ask for their full street address only at the end, when confirming the booking details.

Do not deviate from this order. Do not give medical advice or clinical opinions under any circumstances.`,
      changeReason: "Clean reset — single authoritative flow, no duplicate instructions",
      proposedBy: "founder",
      proposedAt: now,
      approvedAt: now,
      currentlyActive: true,
    });

    // 5. Add ONLY hard constraints as rules (no procedural steps)
    const hardRules = [
      "Never give medical advice or clinical opinions. If asked, say 'I'll get the team to follow up on that' and stop.",
      "Only cover London. If the postcode is outside London, say 'We don't cover that area yet, sorry!' and stop.",
      "The £80 call-out fee applies to ALL bookings on top of the drip price. Always mention it before asking for payment.",
      "When sharing the menu, always use this exact link: https://cdn.shopify.com/s/files/1/0940/8358/0227/files/Dripdash_drip_menu_PDF.pdf?v=1769345941",
      "Always assume a nurse is available for now.",
    ];

    for (const ruleText of hardRules) {
      await ctx.db.insert("rules", {
        ruleText,
        structured: { type: "constraint" },
        priority: 100,
        createdAt: now,
        createdVia: "manual",
      });
    }

    return {
      retired: { rules: allRules.length, knowledge: allKnowledge.length, prompts: allPrompts.length },
      created: { rules: hardRules.length, promptVersion: promptId },
    };
  },
});
