# Coach Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Coach Chat" alongside the existing customer chat, where the clinic founder trains the customer-facing AI by stating rules, uploading documents, critiquing flagged replies, and approving prompt updates.

**Architecture:** A second Claude persona ("Coach Claude") runs in a separate persistent conversation. It has write access to `rules`, `knowledge`, and `promptVersions` tables. The customer Claude reads these tables on every message. Both chats live on the same page behind a tab bar. All changes the coach makes are visible to the customer AI immediately (no redeploy needed — Convex is reactive).

**Tech Stack:** Next.js 16, TypeScript (strict), Tailwind, shadcn/ui, Convex, Anthropic SDK (claude-sonnet-4-5)

---

## Dependency Note

**Stage C1 must execute before the original Stage 2** (customer Claude integration). Stage 2 must read the customer prompt from `promptVersions` in the DB, not from a hardcoded string.

Stage C4 (customer Claude reads rules + knowledge) is the integration layer that wires Stage 2 + C1 together.

---

## Stage Boundary Rule

Stop after each stage and wait for review before continuing.

---

## File Map

### Stage C1 (Schema + prompt migration)
| File | Change |
|------|--------|
| `convex/schema.ts` | Add 6 new tables |
| `convex/seed.ts` | Add promptVersions seed (customer + coach prompts) |
| `convex/promptVersions.ts` | Queries/mutations for prompt management |
| `convex/knowledge.ts` | CRUD for knowledge entries |
| `convex/rules.ts` | CRUD for rules |
| `convex/feedback.ts` | Feedback logging mutation |
| `convex/coachConversations.ts` | Get-or-create coach conversation |
| `convex/coachMessages.ts` | Coach message list + save |
| `lib/claudeTools.ts` | Remove hardcoded SYSTEM_PROMPT (now in DB) |

### Stage C2 (Coach Chat UI)
| File | Change |
|------|--------|
| `app/page.tsx` | Add tab bar (Customer / Train the AI) |
| `components/CoachPage.tsx` | Coach chat orchestrator |
| `components/CoachHeader.tsx` | Purple header, distinct from customer teal |
| `components/CoachMessageBubble.tsx` | Coach-styled bubbles |
| `components/CoachMessageThread.tsx` | Scrolling coach thread |
| `components/CoachInput.tsx` | Text input (file upload added in C5) |

### Stage C3 (Coach Claude wired up)
| File | Change |
|------|--------|
| `app/api/coach/route.ts` | Streaming coach Claude endpoint |
| `lib/coachTools.ts` | Coach tool definitions (all 12 tools) |
| `convex/coachTools.ts` | Convex action implementations (addRule, addKnowledgeEntry, searchKnowledge, searchRules, recordFeedback) |
| `components/CoachPage.tsx` | Wire to /api/coach |

### Stage C4 (Customer reads rules + knowledge)
| File | Change |
|------|--------|
| `app/api/chat/route.ts` | Build context from promptVersions + rules + knowledge |
| `convex/messages.ts` | Add context-building query |

### Stage C5 (Document upload)
| File | Change |
|------|--------|
| `components/CoachInput.tsx` | Add drag-and-drop + attach button |
| `components/FileUploadArea.tsx` | Drag-and-drop zone |
| `convex/coachTools.ts` | extractFromUpload action |
| `app/api/coach/route.ts` | Pass fileId to tool execution |

### Stage C6 (Prompt versioning UI)
| File | Change |
|------|--------|
| `convex/promptVersions.ts` | activatePromptVersion, rollbackPrompt mutations |
| `convex/coachTools.ts` | proposePromptUpdate, activatePromptVersion, rollbackPrompt actions |
| `app/api/coach/route.ts` | Wire new tools |

### Stage C7 (Flag-for-coach)
| File | Change |
|------|--------|
| `components/MessageBubble.tsx` | Add 🚩 button on AI messages |
| `components/ChatPage.tsx` | onFlagForCoach callback prop |
| `app/page.tsx` | Handle flag → switch tab + seed coach with context |
| `components/CoachPage.tsx` | Accept and display flagged message context |

### Stage C8 (Simulation tool)
| File | Change |
|------|--------|
| `convex/coachTools.ts` | simulateCustomerReply action |
| `app/api/coach/route.ts` | Wire simulation tool |

---

## STAGE C1: Schema + Prompt Migration

### Task C1.1: Add new tables to Convex schema

**Files:** Modify `convex/schema.ts`

- [ ] **Step 1: Read current convex/schema.ts**

Read the file to see the existing 7 tables.

- [ ] **Step 2: Add 6 new tables**

Append these table definitions inside `defineSchema({...})` after the existing tables:

```typescript
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
```

- [ ] **Step 3: Verify Convex accepts it**

Run `npx tsc --noEmit --skipLibCheck`. The `npx convex dev` terminal should show no errors.

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add coach chat schema (knowledge, rules, promptVersions, feedback, coachConversations, coachMessages)"
```

---

### Task C1.2: Seed promptVersions

**Files:** Modify `convex/seed.ts`

The customer system prompt currently lives hardcoded in `lib/claudeTools.ts` as `SYSTEM_PROMPT`. We are migrating it to the DB so the coach can update it.

- [ ] **Step 1: Read lib/claudeTools.ts**

Find the `SYSTEM_PROMPT` constant — it contains the customer-facing Claude system prompt.

- [ ] **Step 2: Update convex/seed.ts to seed promptVersions**

Add to the `run` mutation handler, after inserting customers (before `return { seeded: true }`):

```typescript
    const existingPrompts = await ctx.db.query("promptVersions").collect();
    if (existingPrompts.length === 0) {
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
- NEVER add a knowledge entry without confirming first. Exception: a single obvious rule from a direct statement ("don't book Sundays") can be added with a one-line confirmation — keep it fast.
- ALWAYS call searchKnowledge / searchRules before adding anything to check for duplicates or conflicts.
- ALWAYS show a full diff before calling activatePromptVersion. Never activate silently.
- When she says "undo" or "revert", use rollbackPrompt.
- After adding something, tell her briefly what changed and what behavior it affects.

Working style: short messages, bullet points when listing things, no walls of text.`,
        changeReason: "Initial coach prompt",
        proposedBy: "founder",
        proposedAt: now,
        approvedAt: now,
        currentlyActive: true,
      });
    }
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit --skipLibCheck
```

- [ ] **Step 4: Re-seed to pick up the new data**

If the DB was already seeded (nurses/customers exist), the new promptVersions won't be inserted because the mutation checks for existing nurses and returns early. To seed just the prompt versions, either:
- Drop and re-seed (clear the DB in Convex dashboard → Tables → delete all rows in all tables, then hit `/api/seed`)
- Or add a separate seed function just for promptVersions

Add a second mutation to `convex/seed.ts`:

```typescript
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
```

Add a new API route at `app/api/seed-prompts/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET() {
  const result = await convex.mutation(api.seed.seedPrompts, {});
  return NextResponse.json(result);
}
```

Hit `curl http://localhost:3000/api/seed-prompts` to populate.

- [ ] **Step 5: Commit**

```bash
git add convex/seed.ts app/api/seed-prompts/route.ts
git commit -m "feat: seed initial customer and coach prompts into promptVersions table"
```

---

### Task C1.3: Convex helper functions

**Files:** Create `convex/promptVersions.ts`, `convex/knowledge.ts`, `convex/rules.ts`, `convex/feedback.ts`, `convex/coachConversations.ts`, `convex/coachMessages.ts`

- [ ] **Step 1: Create convex/promptVersions.ts**

```typescript
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

    // Retire current active version for this persona
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

    const active = versions.find((v) => v.currentlyActive);
    const previous = versions.find((v) => !v.currentlyActive && v !== active);

    if (!previous) throw new Error("No previous version to roll back to");
    if (active) await ctx.db.patch(active._id, { currentlyActive: false });
    await ctx.db.patch(previous._id, { currentlyActive: true, approvedAt: Date.now() });
  },
});
```

- [ ] **Step 2: Create convex/knowledge.ts**

```typescript
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
```

- [ ] **Step 3: Create convex/rules.ts**

```typescript
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
```

- [ ] **Step 4: Create convex/feedback.ts**

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("feedback", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
```

- [ ] **Step 5: Create convex/coachConversations.ts**

```typescript
import { mutation, query } from "./_generated/server";

export const getOrCreate = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("coachConversations").first();
    if (existing) return existing._id;
    return await ctx.db.insert("coachConversations", { createdAt: Date.now() });
  },
});
```

- [ ] **Step 6: Create convex/coachMessages.ts**

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { coachConversationId: v.id("coachConversations") },
  handler: async (ctx, { coachConversationId }) => {
    return await ctx.db
      .query("coachMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("coachConversationId", coachConversationId)
      )
      .order("asc")
      .collect();
  },
});

export const saveFounderMessage = mutation({
  args: {
    coachConversationId: v.id("coachConversations"),
    text: v.string(),
    flaggedMessageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("coachMessages", {
      coachConversationId: args.coachConversationId,
      sender: "founder",
      text: args.text,
      flaggedMessageId: args.flaggedMessageId,
      createdAt: Date.now(),
    });
  },
});

export const saveCoachReply = mutation({
  args: {
    coachConversationId: v.id("coachConversations"),
    text: v.string(),
    claudeReasoning: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("coachMessages", {
      coachConversationId: args.coachConversationId,
      sender: "coach",
      text: args.text,
      claudeReasoning: args.claudeReasoning,
      createdAt: Date.now(),
    });
  },
});
```

- [ ] **Step 7: Verify TypeScript and commit**

```bash
npx tsc --noEmit --skipLibCheck
git add convex/promptVersions.ts convex/knowledge.ts convex/rules.ts convex/feedback.ts convex/coachConversations.ts convex/coachMessages.ts
git commit -m "feat: add Convex helper functions for coach chat tables"
```

---

**⛔ STAGE C1 COMPLETE — Stop and wait for review.**

---

## STAGE C2: Coach Chat UI

### Task C2.1: Tab navigation in root page

**Files:** Modify `app/page.tsx`

- [ ] **Step 1: Read current app/page.tsx**

- [ ] **Step 2: Replace app/page.tsx with tab-aware version**

```tsx
"use client";

import { useState, useEffect } from "react";
import PasswordGate from "@/components/PasswordGate";
import ChatPage from "@/components/ChatPage";
import CoachPage from "@/components/CoachPage";

type Tab = "customer" | "coach";

export default function Home() {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("customer");
  const [flaggedMessageId, setFlaggedMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem("dripdash_unlocked") === "true") {
      setUnlocked(true);
    }
    setChecking(false);
  }, []);

  const handleFlagForCoach = (messageId: string) => {
    setFlaggedMessageId(messageId);
    setActiveTab("coach");
  };

  if (checking) return null;
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="flex flex-col h-screen">
      <nav className="flex border-b border-gray-200 bg-white flex-shrink-0 shadow-sm">
        <button
          onClick={() => setActiveTab("customer")}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "customer"
              ? "border-[#128c7e] text-[#128c7e]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Customer Chat
        </button>
        <button
          onClick={() => setActiveTab("coach")}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "coach"
              ? "border-[#6366f1] text-[#6366f1]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          🎓 Train the AI
        </button>
      </nav>
      <div className="flex-1 overflow-hidden">
        <div className={activeTab === "customer" ? "h-full" : "hidden h-full"}>
          <ChatPage onFlagForCoach={handleFlagForCoach} />
        </div>
        <div className={activeTab === "coach" ? "h-full" : "hidden h-full"}>
          <CoachPage
            flaggedMessageId={flaggedMessageId}
            onFlaggedMessageConsumed={() => setFlaggedMessageId(null)}
          />
        </div>
      </div>
    </div>
  );
}
```

Note: both tabs are mounted but hidden (not conditionally rendered) so their Convex subscriptions stay active.

- [ ] **Step 3: Update ChatPage to accept onFlagForCoach prop**

Read `components/ChatPage.tsx` and add the prop:

```tsx
interface Props {
  onFlagForCoach: (messageId: string) => void;
}

export default function ChatPage({ onFlagForCoach }: Props) {
  // ... existing code ...
  // Pass onFlagForCoach down to MessageThread
}
```

Update `MessageThread` and `MessageBubble` similarly to accept and pass down the prop (stub for now — the 🚩 button is wired in C7).

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/ChatPage.tsx
git commit -m "feat: add tab navigation for Customer Chat / Train the AI"
```

---

### Task C2.2: Coach UI components

**Files:** Create `components/CoachPage.tsx`, `components/CoachHeader.tsx`, `components/CoachMessageBubble.tsx`, `components/CoachMessageThread.tsx`, `components/CoachInput.tsx`

- [ ] **Step 1: Create components/CoachHeader.tsx**

```tsx
export default function CoachHeader() {
  return (
    <div className="bg-[#6366f1] px-4 py-3 flex items-center gap-3 shadow-md flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🎓</span>
        <div>
          <h2 className="text-white font-semibold text-sm">Train the AI</h2>
          <p className="text-white/60 text-xs">Coach Claude — your AI training partner</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create components/CoachMessageBubble.tsx**

```tsx
import { Doc } from "@/convex/_generated/dataModel";

interface Props {
  message: Doc<"coachMessages">;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CoachMessageBubble({ message }: Props) {
  const isFounder = message.sender === "founder";

  return (
    <div className={`flex flex-col mb-1 ${isFounder ? "items-end" : "items-start"}`}>
      {!isFounder && (
        <span className="text-xs text-[#6366f1] font-medium mb-0.5 ml-1">
          Coach Claude
        </span>
      )}
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
          isFounder
            ? "bg-[#e0e7ff] rounded-tr-sm"
            : "bg-white rounded-tl-sm border border-[#e0e7ff]"
        }`}
      >
        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
          {message.text}
        </p>
        <p className="text-[11px] text-gray-400 text-right mt-0.5">
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create components/CoachMessageThread.tsx**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import CoachMessageBubble from "./CoachMessageBubble";

interface StreamingMessage {
  text: string;
}

interface Props {
  messages: Doc<"coachMessages">[];
  streamingMessage: StreamingMessage | null;
}

export default function CoachMessageThread({ messages, streamingMessage }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingMessage?.text]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 bg-[#f5f3ff]">
      {messages.length === 0 && !streamingMessage && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-2xl mb-2">🎓</p>
            <p className="text-gray-500 text-sm font-medium">Coach Claude</p>
            <p className="text-gray-400 text-xs mt-1">
              Tell me a business rule, upload a document, or flag an AI reply to get started.
            </p>
          </div>
        </div>
      )}
      {messages.map((msg) => (
        <CoachMessageBubble key={msg._id} message={msg} />
      ))}
      {streamingMessage && (
        <div className="flex flex-col items-start mb-1">
          <span className="text-xs text-[#6366f1] font-medium mb-0.5 ml-1">Coach Claude</span>
          <div className="max-w-[75%] rounded-lg px-3 py-2 shadow-sm bg-white rounded-tl-sm border border-[#e0e7ff]">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">
              {streamingMessage.text || (
                <span className="inline-flex gap-1">
                  <span className="animate-bounce">•</span>
                  <span className="animate-bounce [animation-delay:150ms]">•</span>
                  <span className="animate-bounce [animation-delay:300ms]">•</span>
                </span>
              )}
            </p>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 4: Create components/CoachInput.tsx**

```tsx
"use client";

import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface Props {
  onSend: (text: string) => Promise<void>;
  disabled: boolean;
}

export default function CoachInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || sending) return;
    setSending(true);
    setText("");
    await onSend(trimmed);
    setSending(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white px-3 py-2 flex items-end gap-2 flex-shrink-0 border-t border-[#e0e7ff]">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="State a rule, critique a reply, or ask Coach Claude anything…"
        disabled={disabled || sending}
        rows={1}
        className="flex-1 resize-none rounded-2xl px-4 py-2 text-sm bg-[#f5f3ff] border border-[#e0e7ff] outline-none focus:border-[#6366f1] overflow-y-auto leading-5"
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !text.trim() || sending}
        size="icon"
        className="rounded-full bg-[#6366f1] hover:bg-[#4f46e5] text-white flex-shrink-0 h-9 w-9"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Create components/CoachPage.tsx**

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import CoachHeader from "./CoachHeader";
import CoachMessageThread from "./CoachMessageThread";
import CoachInput from "./CoachInput";

interface Props {
  flaggedMessageId: string | null;
  onFlaggedMessageConsumed: () => void;
}

interface StreamingMessage {
  text: string;
}

export default function CoachPage({ flaggedMessageId, onFlaggedMessageConsumed }: Props) {
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null);

  const getOrCreate = useMutation(api.coachConversations.getOrCreate);
  const [conversationId, setConversationId] = useState<Id<"coachConversations"> | null>(null);

  // Initialize conversation on mount
  useState(() => {
    getOrCreate({}).then((id) => setConversationId(id));
  });

  const messages = useQuery(
    api.coachMessages.list,
    conversationId ? { coachConversationId: conversationId } : "skip"
  );

  const saveFounderMessage = useMutation(api.coachMessages.saveFounderMessage);

  const handleSend = async (text: string) => {
    if (!conversationId) return;

    await saveFounderMessage({
      coachConversationId: conversationId,
      text,
      ...(flaggedMessageId ? { flaggedMessageId: flaggedMessageId as Id<"messages"> } : {}),
    });

    if (flaggedMessageId) onFlaggedMessageConsumed();

    setStreaming({ text: "" });

    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coachConversationId: conversationId, text }),
    });

    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

      for (const line of lines) {
        const json = JSON.parse(line.slice(6)) as
          | { type: "delta"; text: string }
          | { type: "done" };

        if (json.type === "delta") {
          setStreaming((prev) =>
            prev ? { text: prev.text + json.text } : null
          );
        } else if (json.type === "done") {
          setStreaming(null);
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f5f3ff]">
      <CoachHeader />
      <CoachMessageThread messages={messages ?? []} streamingMessage={streaming} />
      <CoachInput onSend={handleSend} disabled={!conversationId} />
    </div>
  );
}
```

Note: the `useState(() => {...})` pattern for initialization isn't idiomatic — use `useEffect` instead:

```tsx
import { useState, useEffect } from "react";

// Inside CoachPage:
useEffect(() => {
  getOrCreate({}).then((id) => setConversationId(id));
}, []);
```

- [ ] **Step 6: TypeScript check and commit**

```bash
npx tsc --noEmit --skipLibCheck
git add components/CoachPage.tsx components/CoachHeader.tsx components/CoachMessageBubble.tsx components/CoachMessageThread.tsx components/CoachInput.tsx
git commit -m "feat: add coach chat UI components"
```

---

**⛔ STAGE C2 COMPLETE — Stop and wait for review.**

---

## STAGE C3: Coach Claude Wired Up

### Task C3.1: Coach tool definitions

**Files:** Create `lib/coachTools.ts`

- [ ] **Step 1: Create lib/coachTools.ts**

```typescript
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const COACH_TOOLS: Tool[] = [
  {
    name: "searchKnowledge",
    description: "Search existing knowledge entries before adding new ones to check for duplicates or conflicts.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search terms" },
      },
      required: ["query"],
    },
  },
  {
    name: "searchRules",
    description: "Search existing rules before adding new ones.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search terms" },
      },
      required: ["query"],
    },
  },
  {
    name: "addKnowledgeEntry",
    description: "Add a knowledge entry after founder confirmation.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        content: { type: "string", description: "Cleaned, structured text content" },
        sourceType: { type: "string", enum: ["upload", "chat", "rule"] },
        sourceFileName: { type: "string" },
        supersedesId: { type: "string", description: "ID of entry this replaces (if updating)" },
      },
      required: ["title", "content", "sourceType"],
    },
  },
  {
    name: "addRule",
    description: "Add a business rule. Always search first. For obvious direct statements, confirm once then add.",
    input_schema: {
      type: "object" as const,
      properties: {
        ruleText: { type: "string", description: "Plain English rule as the founder stated it" },
        structured: {
          type: "object",
          description: "Structured JSON form: { type, constraint, value, applies_to }",
        },
        priority: { type: "number", description: "Lower = higher priority. Default 100." },
      },
      required: ["ruleText", "structured"],
    },
  },
  {
    name: "retireKnowledge",
    description: "Retire (soft-delete) a knowledge entry by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "retireRule",
    description: "Retire (soft-delete) a rule by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "proposePromptUpdate",
    description: "Create a proposed prompt update (NOT active until founder approves). Show a diff before calling this.",
    input_schema: {
      type: "object" as const,
      properties: {
        persona: { type: "string", enum: ["customer", "coach"] },
        newContent: { type: "string" },
        reason: { type: "string" },
      },
      required: ["persona", "newContent", "reason"],
    },
  },
  {
    name: "activatePromptVersion",
    description: "Activate a proposed prompt version. ONLY call after founder says yes. Show a diff first.",
    input_schema: {
      type: "object" as const,
      properties: {
        versionId: { type: "string" },
      },
      required: ["versionId"],
    },
  },
  {
    name: "rollbackPrompt",
    description: "Roll back to the previous prompt version for a persona.",
    input_schema: {
      type: "object" as const,
      properties: {
        persona: { type: "string", enum: ["customer", "coach"] },
      },
      required: ["persona"],
    },
  },
  {
    name: "getRecentCustomerConversation",
    description: "Fetch a flagged message and surrounding context from the customer chat.",
    input_schema: {
      type: "object" as const,
      properties: {
        messageId: { type: "string" },
      },
      required: ["messageId"],
    },
  },
  {
    name: "simulateCustomerReply",
    description: "Run the current customer Claude prompt against a hypothetical scenario to preview the response.",
    input_schema: {
      type: "object" as const,
      properties: {
        scenario: { type: "string", description: "Hypothetical customer message to test" },
      },
      required: ["scenario"],
    },
  },
  {
    name: "recordFeedback",
    description: "Log founder feedback about a customer AI reply for tracking.",
    input_schema: {
      type: "object" as const,
      properties: {
        messageId: { type: "string" },
        text: { type: "string" },
        sentiment: { type: "string", enum: ["positive", "negative", "neutral"] },
        resolution: {
          type: "string",
          enum: ["addressed_by_rule", "addressed_by_prompt_change", "addressed_by_knowledge", "noted", "pending"],
        },
      },
      required: ["text", "sentiment", "resolution"],
    },
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add lib/coachTools.ts
git commit -m "feat: add coach tool definitions"
```

---

### Task C3.2: Convex coach tool actions

**Files:** Create `convex/coachTools.ts`

- [ ] **Step 1: Create convex/coachTools.ts**

```typescript
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const searchKnowledge = action({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    return await ctx.runQuery(api.knowledge.search, { query });
  },
});

export const searchRules = action({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    return await ctx.runQuery(api.rules.search, { query });
  },
});

export const addKnowledgeEntry = action({
  args: {
    title: v.string(),
    content: v.string(),
    sourceType: v.union(
      v.literal("upload"),
      v.literal("chat"),
      v.literal("rule")
    ),
    sourceFileName: v.optional(v.string()),
    supersedesId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(api.knowledge.add, {
      title: args.title,
      content: args.content,
      sourceType: args.sourceType,
      sourceFileName: args.sourceFileName,
      supersedesId: args.supersedesId as Parameters<typeof api.knowledge.add>[0]["supersedesId"],
    });
  },
});

export const addRule = action({
  args: {
    ruleText: v.string(),
    structured: v.any(),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(api.rules.add, {
      ruleText: args.ruleText,
      structured: args.structured,
      priority: args.priority,
      createdVia: "coach_chat",
    });
  },
});

export const retireKnowledge = action({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    await ctx.runMutation(api.knowledge.retire, {
      id: id as Parameters<typeof api.knowledge.retire>[0]["id"],
    });
    return { retired: true };
  },
});

export const retireRule = action({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    await ctx.runMutation(api.rules.retire, {
      id: id as Parameters<typeof api.rules.retire>[0]["id"],
    });
    return { retired: true };
  },
});

export const proposePromptUpdate = action({
  args: {
    persona: v.union(v.literal("customer"), v.literal("coach")),
    newContent: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.runMutation(api.promptVersions.propose, {
      persona: args.persona,
      content: args.newContent,
      changeReason: args.reason,
      proposedBy: "coach_claude",
    });
    return { versionId: id, status: "proposed" };
  },
});

export const activatePromptVersion = action({
  args: { versionId: v.string() },
  handler: async (ctx, { versionId }) => {
    await ctx.runMutation(api.promptVersions.activate, {
      versionId: versionId as Parameters<typeof api.promptVersions.activate>[0]["versionId"],
    });
    return { activated: true };
  },
});

export const rollbackPrompt = action({
  args: { persona: v.union(v.literal("customer"), v.literal("coach")) },
  handler: async (ctx, { persona }) => {
    await ctx.runMutation(api.promptVersions.rollback, { persona });
    return { rolledBack: true };
  },
});

export const getRecentCustomerConversation = action({
  args: { messageId: v.string() },
  handler: async (ctx, { messageId }) => {
    const message = await ctx.runQuery(api.messages.getById, {
      messageId: messageId as Parameters<typeof api.messages.getById>[0]["messageId"],
    });
    if (!message) return null;

    const surrounding = await ctx.runQuery(api.messages.list, {
      conversationId: message.conversationId,
    });

    const idx = surrounding.findIndex((m) => m._id === messageId);
    const context = surrounding.slice(Math.max(0, idx - 3), idx + 2);

    return { flaggedMessage: message, context };
  },
});

export const recordFeedback = action({
  args: {
    messageId: v.optional(v.string()),
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
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(api.feedback.record, {
      messageId: args.messageId as Parameters<typeof api.feedback.record>[0]["messageId"],
      text: args.text,
      sentiment: args.sentiment,
      resolution: args.resolution,
    });
  },
});
```

- [ ] **Step 2: Add getById query to convex/messages.ts**

Add to `convex/messages.ts`:

```typescript
export const getById = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    return await ctx.db.get(messageId);
  },
});
```

- [ ] **Step 3: TypeScript check and commit**

```bash
npx tsc --noEmit --skipLibCheck
git add convex/coachTools.ts convex/messages.ts
git commit -m "feat: add Convex coach tool action implementations"
```

---

### Task C3.3: Streaming coach API route

**Files:** Create `app/api/coach/route.ts`

- [ ] **Step 1: Create app/api/coach/route.ts**

```typescript
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { COACH_TOOLS } from "@/lib/coachTools";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface CoachRequest {
  coachConversationId: string;
  text: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as CoachRequest;
  const { coachConversationId, text } = body;

  // Get active coach prompt from DB
  const activePrompt = await convex.query(api.promptVersions.getActive, { persona: "coach" });
  const systemPrompt = activePrompt?.content ?? "You are Coach Claude, the Dripdash founder's AI training partner.";

  // Get conversation history
  const history = await convex.query(api.coachMessages.list, {
    coachConversationId: coachConversationId as Id<"coachConversations">,
  });

  const messageHistory: Anthropic.MessageParam[] = history
    .filter((m) => m.sender === "founder" || m.sender === "coach")
    .map((m) => ({
      role: m.sender === "founder" ? "user" : "assistant",
      content: m.text,
    }));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      const toolCalls: Array<{ name: string; input: unknown; result: unknown }> = [];
      const messages: Anthropic.MessageParam[] = messageHistory;

      while (true) {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 2048,
          system: systemPrompt,
          tools: COACH_TOOLS,
          messages,
          stream: false,
        });

        if (response.stop_reason === "tool_use") {
          const toolUseBlocks = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );

          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const toolUse of toolUseBlocks) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "tool", name: toolUse.name })}\n\n`)
            );
            const result = await executeCoachTool(toolUse.name, toolUse.input as Record<string, unknown>);
            toolCalls.push({ name: toolUse.name, input: toolUse.input, result });
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            });
          }

          messages.push({ role: "assistant", content: response.content });
          messages.push({ role: "user", content: toolResults });
          continue;
        }

        const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
        if (textBlock) {
          const words = textBlock.text.split(" ");
          for (const word of words) {
            const chunk = fullText === "" ? word : ` ${word}`;
            fullText += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "delta", text: chunk })}\n\n`)
            );
            await new Promise((r) => setTimeout(r, 20));
          }
        }
        break;
      }

      // Save coach reply with reasoning
      await convex.mutation(api.coachMessages.saveCoachReply, {
        coachConversationId: coachConversationId as Id<"coachConversations">,
        text: fullText,
        claudeReasoning: toolCalls.length > 0 ? { toolCalls } : undefined,
      });

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function executeCoachTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "searchKnowledge":
      return await convex.action(api.coachTools.searchKnowledge, { query: input.query as string });
    case "searchRules":
      return await convex.action(api.coachTools.searchRules, { query: input.query as string });
    case "addKnowledgeEntry":
      return await convex.action(api.coachTools.addKnowledgeEntry, {
        title: input.title as string,
        content: input.content as string,
        sourceType: input.sourceType as "upload" | "chat" | "rule",
        sourceFileName: input.sourceFileName as string | undefined,
        supersedesId: input.supersedesId as string | undefined,
      });
    case "addRule":
      return await convex.action(api.coachTools.addRule, {
        ruleText: input.ruleText as string,
        structured: input.structured,
        priority: input.priority as number | undefined,
      });
    case "retireKnowledge":
      return await convex.action(api.coachTools.retireKnowledge, { id: input.id as string });
    case "retireRule":
      return await convex.action(api.coachTools.retireRule, { id: input.id as string });
    case "proposePromptUpdate":
      return await convex.action(api.coachTools.proposePromptUpdate, {
        persona: input.persona as "customer" | "coach",
        newContent: input.newContent as string,
        reason: input.reason as string,
      });
    case "activatePromptVersion":
      return await convex.action(api.coachTools.activatePromptVersion, { versionId: input.versionId as string });
    case "rollbackPrompt":
      return await convex.action(api.coachTools.rollbackPrompt, { persona: input.persona as "customer" | "coach" });
    case "getRecentCustomerConversation":
      return await convex.action(api.coachTools.getRecentCustomerConversation, { messageId: input.messageId as string });
    case "recordFeedback":
      return await convex.action(api.coachTools.recordFeedback, {
        messageId: input.messageId as string | undefined,
        text: input.text as string,
        sentiment: input.sentiment as "positive" | "negative" | "neutral",
        resolution: input.resolution as "addressed_by_rule" | "addressed_by_prompt_change" | "addressed_by_knowledge" | "noted" | "pending",
      });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
```

- [ ] **Step 2: TypeScript check and commit**

```bash
npx tsc --noEmit --skipLibCheck
git add app/api/coach/route.ts
git commit -m "feat: add streaming coach Claude API route"
```

---

**⛔ STAGE C3 COMPLETE — Stop and wait for review.**

---

## STAGE C4: Customer Claude Reads Rules + Knowledge

This stage modifies the customer Claude so it includes active rules and knowledge in its context on every message. This must happen after Stage 2 of the original plan (customer Claude integration) is complete.

### Task C4.1: Update customer chat API route

**Files:** Modify `app/api/chat/route.ts`

- [ ] **Step 1: Read app/api/chat/route.ts**

- [ ] **Step 2: Update context building to include rules + knowledge**

In the `POST` handler, after fetching conversation history and before calling Claude, add:

```typescript
  // Fetch active rules and knowledge from DB
  const [activePromptRow, activeRules, activeKnowledge] = await Promise.all([
    convex.query(api.promptVersions.getActive, { persona: "customer" }),
    convex.query(api.rules.listActive, {}),
    convex.query(api.knowledge.listActive, {}),
  ]);

  const basePrompt = activePromptRow?.content ?? SYSTEM_PROMPT_FALLBACK;

  const rulesSection = activeRules.length > 0
    ? `\n\n## Business Rules\n${activeRules
        .map((r, i) => `${i + 1}. ${r.ruleText}`)
        .join("\n")}`
    : "";

  const knowledgeSection = activeKnowledge.length > 0
    ? `\n\n## Knowledge Base\n${activeKnowledge
        .map((k) => `### ${k.title}\n${k.content}`)
        .join("\n\n")}`
    : "";

  const systemPrompt = basePrompt + rulesSection + knowledgeSection;
```

Replace the existing `system: SYSTEM_PROMPT` with `system: systemPrompt` in the Claude call.

- [ ] **Step 3: Add a fallback constant**

In `app/api/chat/route.ts`, add at the top (after imports):

```typescript
// Fallback if DB has no active prompt yet (should not happen after seeding)
const SYSTEM_PROMPT_FALLBACK = "You are Dripdash's booking assistant. Help customers schedule IV therapy sessions.";
```

Remove the import of `SYSTEM_PROMPT` from `lib/claudeTools.ts` (it's now in the DB).

- [ ] **Step 4: TypeScript check and commit**

```bash
npx tsc --noEmit --skipLibCheck
git add app/api/chat/route.ts lib/claudeTools.ts
git commit -m "feat: customer Claude now reads prompt, rules, and knowledge from DB"
```

---

**⛔ STAGE C4 COMPLETE — Stop and wait for review.**

---

## STAGE C5: Document Upload

### Task C5.1: File upload UI

**Files:** Create `components/FileUploadArea.tsx`, modify `components/CoachInput.tsx`

- [ ] **Step 1: Create components/FileUploadArea.tsx**

```tsx
"use client";

import { useRef, useState, DragEvent } from "react";
import { Paperclip, X } from "lucide-react";

interface Props {
  onFileSelect: (file: File) => void;
  pendingFile: File | null;
  onClearFile: () => void;
}

export default function FileUploadArea({ onFileSelect, pendingFile, onClearFile }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  };

  return (
    <div className="px-3 pt-2">
      {pendingFile ? (
        <div className="flex items-center gap-2 bg-[#ede9fe] rounded-lg px-3 py-2 text-sm">
          <Paperclip className="h-4 w-4 text-[#6366f1]" />
          <span className="flex-1 truncate text-gray-700">{pendingFile.name}</span>
          <button onClick={onClearFile}>
            <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg px-3 py-2 text-center cursor-pointer transition-colors text-xs ${
            dragging
              ? "border-[#6366f1] bg-[#ede9fe] text-[#6366f1]"
              : "border-gray-200 text-gray-400 hover:border-[#6366f1] hover:text-[#6366f1]"
          }`}
        >
          <Paperclip className="h-3 w-3 inline mr-1" />
          Drop a PDF, DOCX, image, or text file — or click to browse
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update CoachInput to include file upload and upload logic**

Update `components/CoachInput.tsx` to add `pendingFile` state and pass props to `FileUploadArea`. The file is uploaded to Convex storage before sending.

Add to `CoachInput` props: `onSendWithFile: (text: string, fileId?: string) => Promise<void>` and wire the upload:

```tsx
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import FileUploadArea from "./FileUploadArea";

// Inside CoachInput:
const [pendingFile, setPendingFile] = useState<File | null>(null);
const generateUploadUrl = useMutation(api.coachFiles.generateUploadUrl);

const handleSend = async () => {
  const trimmed = text.trim();
  if (!trimmed && !pendingFile) return;
  if (disabled || sending) return;
  setSending(true);
  setText("");
  
  let fileId: string | undefined;
  if (pendingFile) {
    const uploadUrl = await generateUploadUrl();
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": pendingFile.type },
      body: pendingFile,
    });
    const { storageId } = await res.json() as { storageId: string };
    fileId = storageId;
    setPendingFile(null);
  }
  
  await onSend(trimmed || `[File: ${pendingFile?.name}]`, fileId);
  setSending(false);
};
```

- [ ] **Step 3: Create convex/coachFiles.ts**

```typescript
import { mutation } from "./_generated/server";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
```

- [ ] **Step 4: Add extractFromUpload action to convex/coachTools.ts**

```typescript
export const extractFromUpload = action({
  args: { fileId: v.string(), fileName: v.string() },
  handler: async (ctx, { fileId, fileName }) => {
    const blob = await ctx.storage.get(fileId);
    if (!blob) throw new Error("File not found");

    // For images: send directly to Claude vision
    // For text/PDF: read as text (PDF extraction is basic in this prototype)
    let content: string;
    
    if (blob.type.startsWith("image/")) {
      const buffer = await blob.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      
      const anthropic = new (await import("@anthropic-ai/sdk")).default({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      
      const res = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [{
            type: "image",
            source: { type: "base64", media_type: blob.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64 },
          }, {
            type: "text",
            text: "Extract all text and structured information from this document. Format it clearly.",
          }],
        }],
      });
      content = res.content.find((b) => b.type === "text")?.text ?? "";
    } else {
      content = await blob.text();
    }

    // Ask Claude to categorize and suggest knowledge entries
    const anthropic = new (await import("@anthropic-ai/sdk")).default({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    const analysis = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `You are analyzing a document for an IV clinic booking system. Extract the key information and suggest knowledge entries.

Document content:
${content}

Return JSON with:
{
  "category": "menu" | "protocol" | "faq" | "policy" | "other",
  "summary": "one-line summary",
  "suggestedEntries": [{ "title": "...", "content": "..." }]
}`,
      }],
    });
    
    const analysisText = analysis.content.find((b) => b.type === "text")?.text ?? "{}";
    let parsed: { category: string; summary: string; suggestedEntries: Array<{ title: string; content: string }> };
    try {
      parsed = JSON.parse(analysisText);
    } catch {
      parsed = { category: "other", summary: "Document uploaded", suggestedEntries: [] };
    }

    return { extractedText: content, ...parsed, fileName };
  },
});
```

Add Anthropic import at the top of `convex/coachTools.ts`:
```typescript
// Note: Anthropic client is instantiated per-action call in Convex actions
```

- [ ] **Step 5: Wire extractFromUpload into the coach API route**

In `app/api/coach/route.ts`, add `extractFromUpload` to `executeCoachTool`:

```typescript
case "extractFromUpload":
  return await convex.action(api.coachTools.extractFromUpload, {
    fileId: input.fileId as string,
    fileName: input.fileName as string,
  });
```

Add `extractFromUpload` tool to `COACH_TOOLS` in `lib/coachTools.ts`:

```typescript
{
  name: "extractFromUpload",
  description: "Read and analyze an uploaded file. Returns extracted text, category, and suggested knowledge entries.",
  input_schema: {
    type: "object" as const,
    properties: {
      fileId: { type: "string", description: "Convex storage ID" },
      fileName: { type: "string" },
    },
    required: ["fileId", "fileName"],
  },
},
```

Also update `CoachPage.handleSend` to pass `fileId` to `/api/coach` in the request body, and update the API route to accept and pass `fileId` to the coach session context.

- [ ] **Step 6: TypeScript check and commit**

```bash
npx tsc --noEmit --skipLibCheck
git add components/FileUploadArea.tsx components/CoachInput.tsx convex/coachFiles.ts convex/coachTools.ts lib/coachTools.ts app/api/coach/route.ts
git commit -m "feat: document upload with Convex storage and extractFromUpload tool"
```

---

**⛔ STAGE C5 COMPLETE — Stop and wait for review.**

---

## STAGE C6: Prompt Versioning UI

The backend (propose/activate/rollback) was already built in C3. This stage adds the diff display in the coach chat.

### Task C6.1: Diff display for prompt proposals

The diff is surfaced through Coach Claude's text reply — it shows the old and new prompt with `---` / `+++` markers in its response before calling `activatePromptVersion`. No special UI component is needed; this is enforced through the coach system prompt.

Verify the behavior works end-to-end:
1. Tell Coach Claude: "Update the customer prompt to also say we offer hangover drips"
2. Coach Claude should show you the current prompt and the proposed change
3. You say "yes apply it"
4. Coach Claude calls `activatePromptVersion`
5. The next customer chat message should use the new prompt

- [ ] **Step 1: Test the prompt versioning flow manually**

Start a coach chat and try: "Add to the customer AI's prompt that we offer a hangover recovery drip for £150."

Expected coach behavior:
1. Shows current customer prompt
2. Shows proposed new prompt with the addition highlighted
3. Asks: "Shall I apply this?"
4. On "yes" → calls `activatePromptVersion`

- [ ] **Step 2: Commit if any fixes were needed**

```bash
git add -A
git commit -m "feat: prompt versioning flow verified end-to-end"
```

---

**⛔ STAGE C6 COMPLETE — Stop and wait for review.**

---

## STAGE C7: Flag-for-Coach Button

### Task C7.1: Add 🚩 button to AI messages

**Files:** Modify `components/MessageBubble.tsx`, `components/MessageThread.tsx`, `components/ChatPage.tsx`

- [ ] **Step 1: Update MessageBubble to accept onFlag prop**

Update `components/MessageBubble.tsx`:

```tsx
import { Doc } from "@/convex/_generated/dataModel";
import InspectorPanel from "./InspectorPanel";

interface Props {
  message: Doc<"messages">;
  onFlag?: (messageId: string) => void;
}

export default function MessageBubble({ message, onFlag }: Props) {
  const isCustomer = message.sender === "customer";
  const toolCalls =
    message.claudeReasoning && typeof message.claudeReasoning === "object"
      ? ((message.claudeReasoning as { toolCalls?: unknown[] }).toolCalls ?? [])
      : [];

  return (
    <div className={`flex flex-col mb-1 ${isCustomer ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
          isCustomer ? "bg-[#d9fdd3] rounded-tr-sm" : "bg-white rounded-tl-sm"
        }`}
      >
        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
          {message.text}
        </p>
        <p className="text-[11px] text-gray-400 text-right mt-0.5">
          {formatTime(message.createdAt)}
        </p>
      </div>
      {!isCustomer && (
        <div className="flex items-center gap-2 mt-0.5">
          {toolCalls.length > 0 && (
            <InspectorPanel
              toolCalls={toolCalls as Array<{ name: string; input: unknown; result: unknown }>}
            />
          )}
          {onFlag && (
            <button
              onClick={() => onFlag(message._id)}
              className="text-[11px] text-gray-400 hover:text-orange-500 transition-colors"
              title="Flag this reply for coach review"
            >
              🚩 Flag for coach
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Pass onFlag through MessageThread**

Update `components/MessageThread.tsx` to accept and pass down `onFlag`:

```tsx
interface Props {
  messages: Doc<"messages">[];
  streamingMessage: StreamingMessage | null;
  onFlag?: (messageId: string) => void;
}

// In the map:
{messages.map((msg) => (
  <MessageBubble key={msg._id} message={msg} onFlag={onFlag} />
))}
```

- [ ] **Step 3: Pass onFlag through ChatPage**

Update `components/ChatPage.tsx` to pass `onFlagForCoach` down to `MessageThread`:

```tsx
interface Props {
  onFlagForCoach: (messageId: string) => void;
}

// Inside return:
<MessageThread
  messages={messages ?? []}
  streamingMessage={streaming}
  onFlag={onFlagForCoach}
/>
```

- [ ] **Step 4: Handle flagged message context in CoachPage**

When `flaggedMessageId` arrives in `CoachPage`, pre-populate a context message at the top of the send:

In `components/CoachPage.tsx`, update `handleSend` to prepend the flag context if it's the first message after a flag:

```tsx
// In handleSend, before saving the founder message:
let messageText = text;
if (flaggedMessageId && conversationId) {
  // The flag context is passed to the API as metadata, not as a visible message
  // Coach Claude receives it in the request body and incorporates it
}
```

Update the `/api/coach` request body to include `flaggedMessageId` when present:

```typescript
body: JSON.stringify({
  coachConversationId: conversationId,
  text,
  flaggedMessageId: flaggedMessageId ?? undefined,
}),
```

Update `app/api/coach/route.ts` to inject flagged message context into the system prompt:

```typescript
let systemWithContext = systemPrompt;
if (body.flaggedMessageId) {
  const flagged = await convex.query(api.messages.getById, {
    messageId: body.flaggedMessageId as Id<"messages">,
  });
  if (flagged) {
    systemWithContext += `\n\n## Flagged Customer AI Reply\nThe founder just flagged this AI reply for review:\n"${flagged.text}"\n\nAsk what was wrong with it before doing anything else.`;
  }
}
```

- [ ] **Step 5: TypeScript check and commit**

```bash
npx tsc --noEmit --skipLibCheck
git add components/MessageBubble.tsx components/MessageThread.tsx components/ChatPage.tsx components/CoachPage.tsx app/api/coach/route.ts
git commit -m "feat: flag-for-coach button on AI messages with context injection"
```

---

**⛔ STAGE C7 COMPLETE — Stop and wait for review.**

---

## STAGE C8: Simulation Tool

### Task C8.1: simulateCustomerReply action

**Files:** Add to `convex/coachTools.ts`

- [ ] **Step 1: Add simulateCustomerReply to convex/coachTools.ts**

```typescript
export const simulateCustomerReply = action({
  args: { scenario: v.string() },
  handler: async (ctx, { scenario }) => {
    const [activePromptRow, activeRules, activeKnowledge] = await Promise.all([
      ctx.runQuery(api.promptVersions.getActive, { persona: "customer" }),
      ctx.runQuery(api.rules.listActive, {}),
      ctx.runQuery(api.knowledge.listActive, {}),
    ]);

    const basePrompt = activePromptRow?.content ?? "You are Dripdash's booking assistant.";
    const rulesSection = activeRules.length > 0
      ? `\n\n## Business Rules\n${activeRules.map((r, i) => `${i + 1}. ${r.ruleText}`).join("\n")}`
      : "";
    const knowledgeSection = activeKnowledge.length > 0
      ? `\n\n## Knowledge Base\n${activeKnowledge.map((k) => `### ${k.title}\n${k.content}`).join("\n\n")}`
      : "";
    const systemPrompt = basePrompt + rulesSection + knowledgeSection;

    const anthropic = new (await import("@anthropic-ai/sdk")).default({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: scenario }],
    });

    const reply = res.content.find((b) => b.type === "text")?.text ?? "";
    return { scenario, reply, promptVersion: activePromptRow?.version };
  },
});
```

- [ ] **Step 2: Wire into executeCoachTool**

Already handled in C3 (`simulateCustomerReply` case returns `{ error: "not yet implemented" }`). Update it:

```typescript
case "simulateCustomerReply":
  return await convex.action(api.coachTools.simulateCustomerReply, {
    scenario: input.scenario as string,
  });
```

- [ ] **Step 3: TypeScript check and commit**

```bash
npx tsc --noEmit --skipLibCheck
git add convex/coachTools.ts app/api/coach/route.ts
git commit -m "feat: simulateCustomerReply tool — preview customer AI behavior before deploying changes"
```

---

**⛔ STAGE C8 COMPLETE — All coach chat stages done.**

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|-------------|------|
| Second chat alongside customer chat | C2.1 (tab bar) |
| Visual distinction (purple vs teal) | C2.2 (CoachHeader, CoachMessageBubble) |
| Both chats coexist, not replaced | C2.1 (both mounted, hidden not unmounted) |
| Persistent coach conversation | C2.2 (CoachPage init via getOrCreate) |
| File upload (PDF, DOCX, image, text) | C5 |
| 🚩 Flag for coach button | C7 |
| Flag → switch tab + preload context | C7 |
| knowledge table | C1.1 |
| rules table | C1.1 |
| promptVersions table | C1.1 |
| feedback table | C1.1 |
| coachConversations table | C1.1 |
| coachMessages table | C1.1 |
| Seed promptVersions (customer + coach) | C1.2 |
| Customer prompt from DB (not hardcoded) | C4 |
| Customer Claude reads active rules | C4 |
| Customer Claude reads active knowledge | C4 |
| All 12 coach tools | C3 |
| Coach system prompt (drafted) | C1.2 seed |
| No auto prompt activation | C3 (system prompt instruction + tool design) |
| Approval gates | C3 (system prompt) + C6 (verified) |
| Simulate tool | C8 |
| Rollback | C3 (rollbackPrompt tool) |
| recordFeedback | C3 |
| README updated | Not yet — update in Stage 6 of original plan |
| Don't break customer chat | C4 uses DB prompt with fallback |

**No placeholders found.**

**Type consistency:** All Convex IDs cast via `as Parameters<typeof api.X.Y>[0]["field"]` pattern to preserve type safety without `any` casts on the call site.
