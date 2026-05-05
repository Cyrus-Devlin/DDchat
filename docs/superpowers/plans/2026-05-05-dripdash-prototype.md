# Dripdash AI Chat Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a WhatsApp-style AI booking assistant prototype for Dripdash IV clinic, deployable to Vercel, so the founder can experience the automated booking flow.

**Architecture:** Next.js 15 App Router serves a single-page chat UI; Convex handles all backend state (schema, mutations, queries, scheduled functions); Claude (via Next.js streaming API route) handles AI responses. The UI is a thin shell — all business logic lives in Convex.

**Tech Stack:** Next.js 15, TypeScript (strict), Tailwind CSS, shadcn/ui, Convex, Anthropic SDK, Vercel

---

## Stage Boundary Rule

This plan is divided into 6 stages. **Stop after completing each stage and wait for review before continuing.**

---

## File Map

### Stage 1 (Foundation)
| File | Purpose |
|------|---------|
| `convex/schema.ts` | All table definitions for the entire project |
| `convex/seed.ts` | Seed mutation — 5 nurses, 4 customers |
| `convex/customers.ts` | Customer list query |
| `convex/conversations.ts` | Get-or-create conversation mutation |
| `convex/messages.ts` | List query + send mutation (hardcoded AI reply) |
| `app/layout.tsx` | Root layout with ConvexProvider |
| `app/providers.tsx` | ConvexProvider client wrapper |
| `app/page.tsx` | Root page — renders PasswordGate or ChatPage |
| `app/api/auth/route.ts` | POST — validates password against env var |
| `app/api/seed/route.ts` | GET — triggers seed mutation |
| `components/PasswordGate.tsx` | Password gate UI |
| `components/ChatPage.tsx` | Main orchestrator — wires all components |
| `components/ChatHeader.tsx` | Persona dropdown + mode toggle stub |
| `components/MessageThread.tsx` | Scrolling message list |
| `components/MessageBubble.tsx` | Individual message bubble |
| `components/ChatInput.tsx` | Textarea + send button |
| `.env.local.example` | Env var template |
| `README.md` | Project documentation |

### Stage 2 (Claude + streaming)
| File | Purpose |
|------|---------|
| `app/api/chat/route.ts` | Streaming Claude endpoint |
| `convex/claudeTools.ts` | `getAvailableNurses` tool implementation |
| `lib/claudeTools.ts` | Claude tool definitions (TypeScript) |
| `components/ChatPage.tsx` | Modified — streaming state + API call |

### Stage 3 (Booking state machine)
| File | Purpose |
|------|---------|
| `convex/bookings.ts` | Booking mutations/queries |
| `convex/nurseQueries.ts` | Nurse query mutations/queries |
| `convex/claudeTools.ts` | Extended — all 6 tools implemented |

### Stage 4 (Nurse simulator + activity panel)
| File | Purpose |
|------|---------|
| `convex/nurseSimulator.ts` | Scheduled function — simulates nurse replies |
| `components/NurseActivityPanel.tsx` | Collapsible activity feed |

### Stage 5 (Inspector panel)
| File | Purpose |
|------|---------|
| `components/InspectorPanel.tsx` | Collapsible Claude reasoning panel |

### Stage 6 (Polish + deploy)
| File | Purpose |
|------|---------|
| `vercel.json` | Vercel config |
| `README.md` | Updated deploy instructions |

---

## STAGE 1: Foundation

### Task 1: Initialize Next.js Project

**Files:** Creates project root files

- [ ] **Step 1: Run create-next-app in current directory**

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --yes
```

- [ ] **Step 2: Verify tsconfig has strict mode**

Open `tsconfig.json` and confirm `"strict": true` is present in `compilerOptions`. If not, add it.

- [ ] **Step 3: Install Convex and Anthropic SDK**

```bash
npm install convex @anthropic-ai/sdk
```

- [ ] **Step 4: Install lucide-react (icons)**

```bash
npm install lucide-react
```

- [ ] **Step 5: Create .env.local.example**

Create `.env.local.example`:
```
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
ANTHROPIC_API_KEY=sk-ant-...
PROTOTYPE_PASSWORD=choose-a-password
```

Create `.env.local` with the same keys — fill in real values as they become available.

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "chore: initialize Next.js 15 project with Convex and Anthropic SDK"
```

---

### Task 2: Set Up Convex

- [ ] **Step 1: Initialize Convex (interactive)**

```bash
npx convex dev
```

Follow the prompts: log in to Convex, create a new project named `dripdash-prototype`. This generates `convex/_generated/` and sets `NEXT_PUBLIC_CONVEX_URL` in `.env.local`.

Keep this terminal running (it watches for schema changes). Open a second terminal for subsequent commands.

- [ ] **Step 2: Verify generated files exist**

```bash
ls convex/_generated/
```

Expected: `api.d.ts  api.js  dataModel.d.ts  react.d.ts  server.d.ts`

---

### Task 3: Install shadcn/ui

- [ ] **Step 1: Initialize shadcn**

```bash
npx shadcn@latest init --defaults
```

Accept defaults. Choose `neutral` as base color when prompted.

- [ ] **Step 2: Add required components**

```bash
npx shadcn@latest add button input select badge collapsible textarea
```

- [ ] **Step 3: Verify components exist**

```bash
ls components/ui/
```

Expected: `button.tsx  input.tsx  select.tsx  badge.tsx  collapsible.tsx  textarea.tsx`

---

### Task 4: Define Convex Schema

**Files:** Create `convex/schema.ts`

- [ ] **Step 1: Write the schema**

Create `convex/schema.ts`:

```typescript
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
```

- [ ] **Step 2: Verify Convex accepts the schema**

The `npx convex dev` terminal should show no errors and log "Schema updated". If it shows errors, fix them before continuing.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add Convex schema for all tables"
```

---

### Task 5: Seed Function

**Files:** Create `convex/seed.ts`

- [ ] **Step 1: Write the seed mutation**

Create `convex/seed.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add convex/seed.ts
git commit -m "feat: add Convex seed mutation (5 nurses, 4 customers)"
```

---

### Task 6: Convex Queries and Mutations

**Files:** Create `convex/customers.ts`, `convex/conversations.ts`, `convex/messages.ts`

- [ ] **Step 1: Write customers.ts**

Create `convex/customers.ts`:

```typescript
import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("customers").order("asc").collect();
  },
});
```

- [ ] **Step 2: Write conversations.ts**

Create `convex/conversations.ts`:

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const getOrCreate = mutation({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_customerId", (q) => q.eq("customerId", customerId))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("conversations", {
      customerId,
      autoReplyEnabled: true,
      lastMessageAt: Date.now(),
    });
  },
});
```

- [ ] **Step 3: Write messages.ts**

Create `convex/messages.ts`:

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("asc")
      .collect();
  },
});

// Stage 1: hardcoded AI reply. Stage 2 replaces this with Claude streaming.
export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    customerId: v.id("customers"),
    text: v.string(),
  },
  handler: async (ctx, { conversationId, customerId, text }) => {
    const now = Date.now();

    await ctx.db.insert("messages", {
      conversationId,
      sender: "customer",
      senderRefId: customerId,
      text,
      channel: "prototype",
      createdAt: now,
    });

    await ctx.db.patch(conversationId, { lastMessageAt: now });

    await ctx.db.insert("messages", {
      conversationId,
      sender: "ai",
      text: "Hi! I'm the Dripdash booking assistant. I can help you schedule an IV therapy session. What area are you in, and when are you looking to book?",
      channel: "prototype",
      createdAt: now + 1,
    });
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add convex/customers.ts convex/conversations.ts convex/messages.ts
git commit -m "feat: add Convex queries and mutations for customers, conversations, messages"
```

---

### Task 7: Auth API Route and Seed Route

**Files:** Create `app/api/auth/route.ts`, `app/api/seed/route.ts`

- [ ] **Step 1: Write auth route**

Create `app/api/auth/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json() as { password?: string };

  if (body.password === process.env.PROTOTYPE_PASSWORD) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

- [ ] **Step 2: Write seed route**

Create `app/api/seed/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET() {
  const result = await convex.mutation(api.seed.run, {});
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/
git commit -m "feat: add auth and seed API routes"
```

---

### Task 8: App Layout and Providers

**Files:** Modify `app/layout.tsx`, create `app/providers.tsx`

- [ ] **Step 1: Write providers.tsx**

Create `app/providers.tsx`:

```tsx
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

- [ ] **Step 2: Update app/layout.tsx**

Replace the contents of `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dripdash Booking Assistant",
  description: "IV therapy booking prototype",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx app/providers.tsx
git commit -m "feat: add ConvexProvider wrapper"
```

---

### Task 9: PasswordGate Component

**Files:** Create `components/PasswordGate.tsx`

- [ ] **Step 1: Write PasswordGate**

Create `components/PasswordGate.tsx`:

```tsx
"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  onUnlock: () => void;
}

export default function PasswordGate({ onUnlock }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      localStorage.setItem("dripdash_unlocked", "true");
      onUnlock();
    } else {
      setError(true);
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#e5ddd5]">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-80">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-gray-800">Dripdash</h1>
          <p className="text-sm text-gray-500 mt-1">Booking Assistant Prototype</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={error ? "border-red-400" : ""}
            autoFocus
          />
          {error && (
            <p className="text-red-500 text-xs text-center">Incorrect password</p>
          )}
          <Button type="submit" className="w-full bg-[#128c7e] hover:bg-[#0e7065]" disabled={loading}>
            {loading ? "Checking..." : "Enter"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/PasswordGate.tsx
git commit -m "feat: add PasswordGate component"
```

---

### Task 10: Chat UI Components

**Files:** Create `components/ChatHeader.tsx`, `components/MessageBubble.tsx`, `components/MessageThread.tsx`, `components/ChatInput.tsx`

- [ ] **Step 1: Write ChatHeader.tsx**

Create `components/ChatHeader.tsx`:

```tsx
"use client";

import { Doc, Id } from "@/convex/_generated/dataModel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Props {
  customers: Doc<"customers">[];
  selectedCustomerId: Id<"customers"> | null;
  onSelectCustomer: (id: Id<"customers">) => void;
  mode: "customer" | "founder";
  onModeChange: (mode: "customer" | "founder") => void;
}

export default function ChatHeader({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  mode,
  onModeChange,
}: Props) {
  return (
    <div className="bg-[#128c7e] px-4 py-3 flex items-center gap-3 shadow-md flex-shrink-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-white/80 text-sm whitespace-nowrap">As:</span>
        <Select
          value={selectedCustomerId ?? ""}
          onValueChange={(v) => onSelectCustomer(v as Id<"customers">)}
        >
          <SelectTrigger className="bg-white/20 border-0 text-white h-8 w-44 text-sm focus:ring-0">
            <SelectValue placeholder="Pick a customer…" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <button
        onClick={() => onModeChange(mode === "customer" ? "founder" : "customer")}
        className="flex-shrink-0"
        title="Founder mode — coming in a later stage"
      >
        <Badge
          variant="outline"
          className="border-white/30 text-white/50 text-xs cursor-not-allowed"
        >
          {mode === "customer" ? "Customer" : "Founder"} mode
        </Badge>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Write MessageBubble.tsx**

Create `components/MessageBubble.tsx`:

```tsx
import { Doc } from "@/convex/_generated/dataModel";

interface Props {
  message: Doc<"messages">;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({ message }: Props) {
  const isCustomer = message.sender === "customer";

  return (
    <div className={`flex mb-1 ${isCustomer ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
          isCustomer
            ? "bg-[#d9fdd3] rounded-tr-sm"
            : "bg-white rounded-tl-sm"
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

- [ ] **Step 3: Write MessageThread.tsx**

Create `components/MessageThread.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import MessageBubble from "./MessageBubble";

interface Props {
  messages: Doc<"messages">[];
}

export default function MessageThread({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">
          Select a customer to start chatting
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {messages.map((msg) => (
        <MessageBubble key={msg._id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 4: Write ChatInput.tsx**

Create `components/ChatInput.tsx`:

```tsx
"use client";

import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface Props {
  onSend: (text: string) => Promise<void>;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
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
    <div className="bg-[#f0f0f0] px-3 py-2 flex items-end gap-2 flex-shrink-0 border-t border-gray-200">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "Select a customer first…" : "Type a message"}
        disabled={disabled || sending}
        rows={1}
        className="flex-1 resize-none rounded-2xl px-4 py-2 text-sm bg-white border border-gray-200 outline-none focus:border-gray-300 overflow-y-auto leading-5"
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !text.trim() || sending}
        size="icon"
        className="rounded-full bg-[#00a884] hover:bg-[#008f71] text-white flex-shrink-0 h-9 w-9"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add components/ChatHeader.tsx components/MessageBubble.tsx components/MessageThread.tsx components/ChatInput.tsx
git commit -m "feat: add chat UI components (header, message thread, input)"
```

---

### Task 11: ChatPage Orchestrator

**Files:** Create `components/ChatPage.tsx`

- [ ] **Step 1: Write ChatPage.tsx**

Create `components/ChatPage.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import ChatHeader from "./ChatHeader";
import MessageThread from "./MessageThread";
import ChatInput from "./ChatInput";

export default function ChatPage() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<Id<"customers"> | null>(null);
  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const [mode, setMode] = useState<"customer" | "founder">("customer");

  const customers = useQuery(api.customers.list);
  const messages = useQuery(
    api.messages.list,
    conversationId ? { conversationId } : "skip"
  );

  const getOrCreate = useMutation(api.conversations.getOrCreate);
  const sendMessage = useMutation(api.messages.send);

  const handleSelectCustomer = async (customerId: Id<"customers">) => {
    setSelectedCustomerId(customerId);
    const convId = await getOrCreate({ customerId });
    setConversationId(convId);
  };

  const handleSend = async (text: string) => {
    if (!conversationId || !selectedCustomerId) return;
    await sendMessage({ conversationId, customerId: selectedCustomerId, text });
  };

  return (
    <div className="flex flex-col h-screen bg-[#e5ddd5]">
      <ChatHeader
        customers={customers ?? []}
        selectedCustomerId={selectedCustomerId}
        onSelectCustomer={handleSelectCustomer}
        mode={mode}
        onModeChange={setMode}
      />
      <MessageThread messages={messages ?? []} />
      <ChatInput onSend={handleSend} disabled={!conversationId} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ChatPage.tsx
git commit -m "feat: add ChatPage orchestrator component"
```

---

### Task 12: Root Page

**Files:** Modify `app/page.tsx`

- [ ] **Step 1: Write app/page.tsx**

Replace `app/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import PasswordGate from "@/components/PasswordGate";
import ChatPage from "@/components/ChatPage";

export default function Home() {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (localStorage.getItem("dripdash_unlocked") === "true") {
      setUnlocked(true);
    }
    setChecking(false);
  }, []);

  if (checking) return null;
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  return <ChatPage />;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add root page with password gate"
```

---

### Task 13: Seed and Verify Stage 1

- [ ] **Step 1: Start dev server**

In a new terminal:
```bash
npm run dev
```

Expected: server starts on http://localhost:3000

- [ ] **Step 2: Seed the database**

```bash
curl http://localhost:3000/api/seed
```

Expected response: `{"seeded":true}` (or `{"already":true}` if run again)

Verify in the Convex dashboard (https://dashboard.convex.dev) that the `nurses` and `customers` tables have 5 and 4 rows respectively.

- [ ] **Step 3: Test the full flow**

Open http://localhost:3000.

1. Enter the password from `.env.local` → should enter the chat page
2. Select "Sarah Thompson" from the dropdown → message thread should appear (empty)
3. Type "Hi, I'd like to book a session" and press Enter → two messages should appear: the customer's message (green, right) and the hardcoded AI reply (white, left)
4. Switch to "Tom Okafor" → a fresh empty conversation should appear
5. Send another message → it should show up in Tom's conversation, not Sarah's

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "stage-1: complete foundation — schema, seed, basic chat UI with hardcoded responses"
```

---

### Task 14: README

**Files:** Create `README.md`

- [ ] **Step 1: Write README.md**

Create `README.md`:

```markdown
# Dripdash AI Chat Prototype

WhatsApp-style AI booking assistant prototype for Dripdash IV clinic.

## Running locally

### Prerequisites
- Node.js 18+
- Convex account (free at convex.dev)
- Anthropic API key (added in Stage 2)

### Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Initialize Convex (run once):
   ```
   npx convex dev
   ```
   Log in and create a project. This sets `NEXT_PUBLIC_CONVEX_URL` in `.env.local`.

3. Copy `.env.local.example` to `.env.local` and fill in all values.

4. Start the dev server:
   ```
   npm run dev
   ```

5. Seed the database (first run only):
   ```
   curl http://localhost:3000/api/seed
   ```

Visit http://localhost:3000.

## Deploying to Vercel

1. Push to GitHub.
2. Import the repo in Vercel.
3. Add environment variables: `NEXT_PUBLIC_CONVEX_URL`, `ANTHROPIC_API_KEY`, `PROTOTYPE_PASSWORD`.
4. Deploy.

For Convex in production, run `npx convex deploy` to push schema and functions to the production deployment.

## Architecture

| Path | Purpose |
|------|---------|
| `convex/schema.ts` | All table definitions — ported to real platform later |
| `convex/seed.ts` | Sample nurses + customers |
| `convex/messages.ts` | Message storage and retrieval |
| `convex/claudeTools.ts` | Claude tool implementations (Stage 2+) |
| `convex/nurseSimulator.ts` | Simulated nurse reply scheduler (Stage 4+) |
| `app/api/chat/route.ts` | Streaming Claude endpoint (Stage 2+) |
| `components/ChatPage.tsx` | Main UI orchestrator |
| `components/NurseActivityPanel.tsx` | Activity feed (Stage 4+) |
| `components/InspectorPanel.tsx` | Claude reasoning panel (Stage 5+) |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and architecture overview"
```

---

**⛔ STAGE 1 COMPLETE — Stop here and wait for review before continuing.**

---

## STAGE 2: Claude Integration + Streaming

### Task 15: Claude Tool Definitions

**Files:** Create `lib/claudeTools.ts`

- [ ] **Step 1: Write Claude tool type definitions**

Create `lib/claudeTools.ts`:

```typescript
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const CLAUDE_TOOLS: Tool[] = [
  {
    name: "getAvailableNurses",
    description:
      "Returns nurses who cover the given area and are likely available at the requested datetime. Use this before messaging nurses to know who to contact.",
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
    name: "messageNurses",
    description:
      "Sends an availability query to the specified nurses for a booking. Returns query IDs. Nurses reply asynchronously — call checkNurseResponses after a moment.",
    input_schema: {
      type: "object" as const,
      properties: {
        nurseIds: {
          type: "array",
          items: { type: "string" },
          description: "Convex IDs of nurses to query",
        },
        bookingId: {
          type: "string",
          description: "Convex ID of the booking",
        },
        location: {
          type: "string",
          description: "Full address for the appointment",
        },
        time: {
          type: "string",
          description: "ISO 8601 datetime of the requested appointment",
        },
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
        bookingId: {
          type: "string",
          description: "Convex ID of the booking",
        },
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
        bookingId: {
          type: "string",
          description: "Convex ID of the booking",
        },
        nurseId: {
          type: "string",
          description: "Convex ID of the confirmed nurse",
        },
      },
      required: ["bookingId", "nurseId"],
    },
  },
  {
    name: "proposeAlternativeTimes",
    description:
      "Sends a message to the customer proposing alternative appointment times when none of the polled nurses are available.",
    input_schema: {
      type: "object" as const,
      properties: {
        bookingId: {
          type: "string",
          description: "Convex ID of the booking",
        },
        times: {
          type: "array",
          items: { type: "string" },
          description: "Array of ISO 8601 datetime strings to propose",
        },
      },
      required: ["bookingId", "times"],
    },
  },
  {
    name: "escalateToHuman",
    description:
      "Flags the conversation for human review and stops AI auto-reply. Use for medical questions, complaints, or anything outside booking scope.",
    input_schema: {
      type: "object" as const,
      properties: {
        reason: {
          type: "string",
          description: "Why the conversation is being escalated",
        },
      },
      required: ["reason"],
    },
  },
];

export const SYSTEM_PROMPT = `You are Dripdash's booking assistant. Dripdash is a London-based IV nutrient therapy clinic.

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
- Keep responses short. One or two sentences max unless you're listing options.`;
```

- [ ] **Step 2: Commit**

```bash
git add lib/claudeTools.ts
git commit -m "feat: add Claude tool definitions and system prompt"
```

---

### Task 16: Convex getAvailableNurses Tool

**Files:** Create `convex/claudeTools.ts`

- [ ] **Step 1: Write claudeTools.ts**

Create `convex/claudeTools.ts`:

```typescript
import { action } from "./_generated/server";
import { v } from "convex/values";

export const getAvailableNurses = action({
  args: {
    area: v.string(),
    datetime: v.string(),
  },
  handler: async (ctx, { area, datetime }) => {
    const nurses = await ctx.runQuery(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (internal as any).nurses.listAll,
      {}
    );

    const requestedDate = new Date(datetime);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const requestedDay = dayNames[requestedDate.getDay()];
    const requestedHour = requestedDate.getHours();
    const requestedMinute = requestedDate.getMinutes();

    const areaUpper = area.toUpperCase().replace(/\s/g, "");

    const available = nurses.filter((nurse: {
      coverageAreas: string[];
      workingHours: { start: string; end: string; days: string[] };
    }) => {
      const coversArea = nurse.coverageAreas.some((a: string) => {
        const normalized = a.toUpperCase().replace(/\s/g, "");
        return normalized === areaUpper || areaUpper.startsWith(normalized);
      });
      if (!coversArea) return false;

      const worksDay = nurse.workingHours.days.includes(requestedDay);
      if (!worksDay) return false;

      const [startH, startM] = nurse.workingHours.start.split(":").map(Number);
      const [endH, endM] = nurse.workingHours.end.split(":").map(Number);
      const requestedMins = requestedHour * 60 + requestedMinute;
      const startMins = startH * 60 + startM;
      const endMins = endH * 60 + endM;

      return requestedMins >= startMins && requestedMins <= endMins - 60;
    });

    return available.map((n: { _id: string; name: string; coverageAreas: string[]; simulatedReliability: number }) => ({
      id: n._id,
      name: n.name,
      coverageAreas: n.coverageAreas,
      reliability: n.simulatedReliability,
    }));
  },
});
```

- [ ] **Step 2: Create convex/nurses.ts with listAll query**

Create `convex/nurses.ts`:

```typescript
import { query } from "./_generated/server";

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("nurses").collect();
  },
});
```

- [ ] **Step 3: Fix the internal reference in claudeTools.ts**

The `internal` reference above is a placeholder. Replace the `getAvailableNurses` action with a version that uses `ctx.runQuery` correctly. Update `convex/claudeTools.ts` to import the query properly:

```typescript
import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const getAvailableNurses = action({
  args: {
    area: v.string(),
    datetime: v.string(),
  },
  handler: async (ctx, { area, datetime }) => {
    const nurses = await ctx.runQuery(internal.nurses.listAll, {});

    const requestedDate = new Date(datetime);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const requestedDay = dayNames[requestedDate.getDay()];
    const requestedHour = requestedDate.getHours();
    const requestedMinute = requestedDate.getMinutes();

    const areaUpper = area.toUpperCase().replace(/\s/g, "");

    const available = nurses.filter((nurse) => {
      const coversArea = nurse.coverageAreas.some((a) => {
        const normalized = a.toUpperCase().replace(/\s/g, "");
        return normalized === areaUpper || areaUpper.startsWith(normalized);
      });
      if (!coversArea) return false;

      const worksDay = nurse.workingHours.days.includes(requestedDay);
      if (!worksDay) return false;

      const [startH, startM] = nurse.workingHours.start.split(":").map(Number);
      const [endH, endM] = nurse.workingHours.end.split(":").map(Number);
      const requestedMins = requestedHour * 60 + requestedMinute;
      const startMins = startH * 60 + startM;
      const endMins = endH * 60 + endM;

      return requestedMins >= startMins && requestedMins <= endMins - 60;
    });

    return available.map((n) => ({
      id: n._id,
      name: n.name,
      coverageAreas: n.coverageAreas,
      reliability: n.simulatedReliability,
    }));
  },
});
```

Note: `internal` refers to Convex internal functions. For `listAll` to be callable via `internal`, it must be defined in a file that Convex treats as an internal function. If Convex's code generation doesn't put `nurses.listAll` in `internal`, use `api.nurses.listAll` via `ctx.runQuery` instead. Check `convex/_generated/api.d.ts` after running `npx convex dev` to confirm the correct import.

- [ ] **Step 4: Commit**

```bash
git add convex/claudeTools.ts convex/nurses.ts
git commit -m "feat: add getAvailableNurses Convex action and nurses query"
```

---

### Task 17: Streaming Claude API Route

**Files:** Create `app/api/chat/route.ts`

- [ ] **Step 1: Write the streaming route**

Create `app/api/chat/route.ts`:

```typescript
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CLAUDE_TOOLS, SYSTEM_PROMPT } from "@/lib/claudeTools";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface ChatRequest {
  conversationId: string;
  customerId: string;
  text: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as ChatRequest;
  const { conversationId, customerId, text } = body;

  // Save the customer message
  await convex.mutation(api.messages.send, {
    conversationId: conversationId as Id<"conversations">,
    customerId: customerId as Id<"customers">,
    text,
    skipAiReply: true,
  });

  // Fetch conversation history for context
  const history = await convex.query(api.messages.list, {
    conversationId: conversationId as Id<"conversations">,
  });

  const messageHistory: Anthropic.MessageParam[] = history
    .filter((m) => m.sender === "customer" || m.sender === "ai")
    .map((m) => ({
      role: m.sender === "customer" ? "user" : "assistant",
      content: m.text,
    }));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      const toolCalls: Array<{ name: string; input: unknown; result: unknown }> = [];

      const messages: Anthropic.MessageParam[] = messageHistory;

      // Agentic loop — Claude may call tools before giving a final reply
      while (true) {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: CLAUDE_TOOLS,
          messages,
          stream: false, // Use non-streaming for tool calls; stream only final text
        });

        if (response.stop_reason === "tool_use") {
          const toolUseBlocks = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );

          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const toolUse of toolUseBlocks) {
            const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>, conversationId);
            toolCalls.push({ name: toolUse.name, input: toolUse.input, result });
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            });

            // Stream a signal to the client that a tool was called
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "tool", name: toolUse.name })}\n\n`)
            );
          }

          messages.push({ role: "assistant", content: response.content });
          messages.push({ role: "user", content: toolResults });
          continue;
        }

        // Final text response — stream it
        const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
        if (textBlock) {
          // Simulate streaming by sending the text in chunks
          const words = textBlock.text.split(" ");
          for (const word of words) {
            const chunk = fullText === "" ? word : ` ${word}`;
            fullText += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "delta", text: chunk })}\n\n`)
            );
            await new Promise((r) => setTimeout(r, 30));
          }
        }

        break;
      }

      // Save the final AI message to Convex with reasoning
      await convex.mutation(api.messages.saveAiReply, {
        conversationId: conversationId as Id<"conversations">,
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

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  _conversationId: string
): Promise<unknown> {
  switch (name) {
    case "getAvailableNurses":
      return await convex.action(api.claudeTools.getAvailableNurses, {
        area: input.area as string,
        datetime: input.datetime as string,
      });
    default:
      return { error: `Tool '${name}' not yet implemented (Stage 3)` };
  }
}
```

- [ ] **Step 2: Update convex/messages.ts to support skipAiReply and saveAiReply**

Update `convex/messages.ts` — replace the `send` mutation and add `saveAiReply`:

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("asc")
      .collect();
  },
});

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    customerId: v.id("customers"),
    text: v.string(),
    skipAiReply: v.optional(v.boolean()),
  },
  handler: async (ctx, { conversationId, customerId, text, skipAiReply }) => {
    const now = Date.now();

    await ctx.db.insert("messages", {
      conversationId,
      sender: "customer",
      senderRefId: customerId,
      text,
      channel: "prototype",
      createdAt: now,
    });

    await ctx.db.patch(conversationId, { lastMessageAt: now });

    // Hardcoded fallback only when not using Claude (Stage 1 mode)
    if (!skipAiReply) {
      await ctx.db.insert("messages", {
        conversationId,
        sender: "ai",
        text: "Hi! I'm the Dripdash booking assistant. I can help you schedule an IV therapy session. What area are you in, and when are you looking to book?",
        channel: "prototype",
        createdAt: now + 1,
      });
    }
  },
});

export const saveAiReply = mutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.string(),
    claudeReasoning: v.optional(v.any()),
  },
  handler: async (ctx, { conversationId, text, claudeReasoning }) => {
    await ctx.db.insert("messages", {
      conversationId,
      sender: "ai",
      text,
      channel: "prototype",
      createdAt: Date.now(),
      ...(claudeReasoning ? { claudeReasoning } : {}),
    });
    await ctx.db.patch(conversationId, { lastMessageAt: Date.now() });
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add app/api/chat/route.ts convex/messages.ts
git commit -m "feat: add streaming Claude API route with tool execution loop"
```

---

### Task 18: Wire Streaming into ChatPage

**Files:** Modify `components/ChatPage.tsx`

- [ ] **Step 1: Update ChatPage to call /api/chat with streaming**

Replace `components/ChatPage.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import ChatHeader from "./ChatHeader";
import MessageThread from "./MessageThread";
import ChatInput from "./ChatInput";

interface StreamingMessage {
  text: string;
  toolsCalled: string[];
}

export default function ChatPage() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<Id<"customers"> | null>(null);
  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const [mode, setMode] = useState<"customer" | "founder">("customer");
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null);

  const customers = useQuery(api.customers.list);
  const messages = useQuery(
    api.messages.list,
    conversationId ? { conversationId } : "skip"
  );

  const getOrCreate = useMutation(api.conversations.getOrCreate);

  const handleSelectCustomer = async (customerId: Id<"customers">) => {
    setSelectedCustomerId(customerId);
    const convId = await getOrCreate({ customerId });
    setConversationId(convId);
  };

  const handleSend = async (text: string) => {
    if (!conversationId || !selectedCustomerId) return;

    setStreaming({ text: "", toolsCalled: [] });

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        customerId: selectedCustomerId,
        text,
      }),
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
          | { type: "tool"; name: string }
          | { type: "done" };

        if (json.type === "delta") {
          setStreaming((prev) =>
            prev ? { ...prev, text: prev.text + json.text } : null
          );
        } else if (json.type === "tool") {
          setStreaming((prev) =>
            prev
              ? { ...prev, toolsCalled: [...prev.toolsCalled, json.name] }
              : null
          );
        } else if (json.type === "done") {
          setStreaming(null);
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#e5ddd5]">
      <ChatHeader
        customers={customers ?? []}
        selectedCustomerId={selectedCustomerId}
        onSelectCustomer={handleSelectCustomer}
        mode={mode}
        onModeChange={setMode}
      />
      <MessageThread
        messages={messages ?? []}
        streamingMessage={streaming}
      />
      <ChatInput onSend={handleSend} disabled={!conversationId} />
    </div>
  );
}
```

- [ ] **Step 2: Update MessageThread to show streaming message**

Update `components/MessageThread.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import MessageBubble from "./MessageBubble";

interface StreamingMessage {
  text: string;
  toolsCalled: string[];
}

interface Props {
  messages: Doc<"messages">[];
  streamingMessage: StreamingMessage | null;
}

export default function MessageThread({ messages, streamingMessage }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingMessage?.text]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {messages.length === 0 && !streamingMessage && (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500 text-sm">
            Select a customer to start chatting
          </p>
        </div>
      )}
      {messages.map((msg) => (
        <MessageBubble key={msg._id} message={msg} />
      ))}
      {streamingMessage && (
        <div className="flex justify-start mb-1">
          <div className="max-w-[75%] rounded-lg px-3 py-2 shadow-sm bg-white rounded-tl-sm">
            {streamingMessage.toolsCalled.length > 0 && (
              <p className="text-[11px] text-gray-400 mb-1">
                🔧 {streamingMessage.toolsCalled.join(", ")}
              </p>
            )}
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

- [ ] **Step 3: Test Stage 2**

1. Start `npx convex dev` (if not running)
2. Start `npm run dev`
3. Open http://localhost:3000, select Sarah Thompson
4. Type "Hi, I'd like a drip in W2 on Saturday at 2pm"
5. Verify: the typing indicator appears, then Claude's reply streams in token-by-token
6. In the Convex dashboard, verify a message row was saved with `sender: "ai"` and (if tools were called) `claudeReasoning` populated

- [ ] **Step 4: Commit**

```bash
git add components/ChatPage.tsx components/MessageThread.tsx
git commit -m "feat: wire Claude streaming into chat UI"
```

---

**⛔ STAGE 2 COMPLETE — Stop here and wait for review before continuing.**

---

## STAGE 3: Booking State Machine + Remaining Tools

### Task 19: Booking and NurseQuery Mutations

**Files:** Create `convex/bookings.ts`, `convex/nurseQueries.ts`

- [ ] **Step 1: Write convex/bookings.ts**

Create `convex/bookings.ts`:

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    customerId: v.id("customers"),
    location: v.string(),
    requestedTime: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bookings", {
      customerId: args.customerId,
      location: args.location,
      requestedTime: args.requestedTime,
      state: "requested",
      createdAt: Date.now(),
    });
  },
});

export const updateState = mutation({
  args: {
    bookingId: v.id("bookings"),
    state: v.union(
      v.literal("requested"),
      v.literal("polling_nurses"),
      v.literal("confirmed"),
      v.literal("cancelled")
    ),
    nurseId: v.optional(v.id("nurses")),
    confirmedTime: v.optional(v.number()),
  },
  handler: async (ctx, { bookingId, state, nurseId, confirmedTime }) => {
    await ctx.db.patch(bookingId, {
      state,
      ...(nurseId ? { nurseId } : {}),
      ...(confirmedTime ? { confirmedTime } : {}),
    });
  },
});

export const get = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    return await ctx.db.get(bookingId);
  },
});
```

- [ ] **Step 2: Write convex/nurseQueries.ts**

Create `convex/nurseQueries.ts`:

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createMany = mutation({
  args: {
    bookingId: v.id("bookings"),
    nurseIds: v.array(v.id("nurses")),
    responseDelayMs: v.number(),
  },
  handler: async (ctx, { bookingId, nurseIds, responseDelayMs }) => {
    const now = Date.now();
    const ids: string[] = [];
    for (const nurseId of nurseIds) {
      const id = await ctx.db.insert("nurseQueries", {
        bookingId,
        nurseId,
        sentAt: now,
        responseDelayMs,
      });
      ids.push(id);
    }
    return ids;
  },
});

export const listForBooking = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    return await ctx.db
      .query("nurseQueries")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", bookingId))
      .collect();
  },
});

export const setResponse = mutation({
  args: {
    queryId: v.id("nurseQueries"),
    response: v.union(v.literal("yes"), v.literal("no")),
  },
  handler: async (ctx, { queryId, response }) => {
    await ctx.db.patch(queryId, {
      response,
      respondedAt: Date.now(),
    });
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add convex/bookings.ts convex/nurseQueries.ts
git commit -m "feat: add booking and nurseQuery Convex mutations"
```

---

### Task 20: Implement All Claude Tools

**Files:** Update `convex/claudeTools.ts`, update `app/api/chat/route.ts`

- [ ] **Step 1: Update convex/claudeTools.ts with all tool implementations**

Replace `convex/claudeTools.ts`:

```typescript
import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

export const getAvailableNurses = action({
  args: { area: v.string(), datetime: v.string() },
  handler: async (ctx, { area, datetime }) => {
    const nurses = await ctx.runQuery(api.nurses.listAll, {});

    const date = new Date(datetime);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const day = days[date.getDay()];
    const mins = date.getHours() * 60 + date.getMinutes();
    const areaKey = area.toUpperCase().replace(/\s/g, "");

    return nurses
      .filter((n) => {
        const covers = n.coverageAreas.some((a) => {
          const k = a.toUpperCase().replace(/\s/g, "");
          return k === areaKey || areaKey.startsWith(k);
        });
        if (!covers) return false;
        if (!n.workingHours.days.includes(day)) return false;
        const [sh, sm] = n.workingHours.start.split(":").map(Number);
        const [eh, em] = n.workingHours.end.split(":").map(Number);
        return mins >= sh * 60 + sm && mins <= eh * 60 + em - 60;
      })
      .map((n) => ({
        id: n._id,
        name: n.name,
        coverageAreas: n.coverageAreas,
        reliability: n.simulatedReliability,
      }));
  },
});

export const messageNurses = action({
  args: {
    nurseIds: v.array(v.string()),
    bookingId: v.string(),
    location: v.string(),
    time: v.string(),
  },
  handler: async (ctx, { nurseIds, bookingId, location, time }) => {
    // Average response delay: 60s–180s (accelerated 5x = 12s–36s in simulator)
    const delayMs = Math.floor(Math.random() * (180000 - 60000) + 60000);

    const queryIds = await ctx.runMutation(api.nurseQueries.createMany, {
      bookingId: bookingId as Parameters<typeof api.nurseQueries.createMany>[0]["bookingId"],
      nurseIds: nurseIds as Parameters<typeof api.nurseQueries.createMany>[0]["nurseIds"],
      responseDelayMs: delayMs,
    });

    await ctx.runMutation(api.bookings.updateState, {
      bookingId: bookingId as Parameters<typeof api.bookings.updateState>[0]["bookingId"],
      state: "polling_nurses",
    });

    return { queryIds, location, time, message: `Queried ${nurseIds.length} nurse(s). Responses expected in ~${Math.round(delayMs / 1000 / 5)}s (accelerated).` };
  },
});

export const checkNurseResponses = action({
  args: { bookingId: v.string() },
  handler: async (ctx, { bookingId }) => {
    const queries = await ctx.runQuery(api.nurseQueries.listForBooking, {
      bookingId: bookingId as Parameters<typeof api.nurseQueries.listForBooking>[0]["bookingId"],
    });

    return queries.map((q) => ({
      nurseId: q.nurseId,
      response: q.response ?? "pending",
      respondedAt: q.respondedAt,
    }));
  },
});

export const confirmBooking = action({
  args: { bookingId: v.string(), nurseId: v.string() },
  handler: async (ctx, { bookingId, nurseId }) => {
    await ctx.runMutation(api.bookings.updateState, {
      bookingId: bookingId as Parameters<typeof api.bookings.updateState>[0]["bookingId"],
      state: "confirmed",
      nurseId: nurseId as Parameters<typeof api.bookings.updateState>[0]["nurseId"],
      confirmedTime: Date.now(),
    });
    return { confirmed: true };
  },
});

export const escalateToHuman = action({
  args: { conversationId: v.string(), reason: v.string() },
  handler: async (ctx, { conversationId, reason }) => {
    await ctx.runMutation(api.conversations.setAutoReply, {
      conversationId: conversationId as Parameters<typeof api.conversations.setAutoReply>[0]["conversationId"],
      autoReplyEnabled: false,
    });
    return { escalated: true, reason };
  },
});
```

- [ ] **Step 2: Add setAutoReply mutation to convex/conversations.ts**

Add to `convex/conversations.ts`:

```typescript
export const setAutoReply = mutation({
  args: {
    conversationId: v.id("conversations"),
    autoReplyEnabled: v.boolean(),
  },
  handler: async (ctx, { conversationId, autoReplyEnabled }) => {
    await ctx.db.patch(conversationId, { autoReplyEnabled });
  },
});
```

- [ ] **Step 3: Update executeTool in app/api/chat/route.ts**

Replace the `executeTool` function in `app/api/chat/route.ts`:

```typescript
async function executeTool(
  name: string,
  input: Record<string, unknown>,
  conversationId: string
): Promise<unknown> {
  switch (name) {
    case "getAvailableNurses":
      return await convex.action(api.claudeTools.getAvailableNurses, {
        area: input.area as string,
        datetime: input.datetime as string,
      });
    case "messageNurses":
      return await convex.action(api.claudeTools.messageNurses, {
        nurseIds: input.nurseIds as string[],
        bookingId: input.bookingId as string,
        location: input.location as string,
        time: input.time as string,
      });
    case "checkNurseResponses":
      return await convex.action(api.claudeTools.checkNurseResponses, {
        bookingId: input.bookingId as string,
      });
    case "confirmBooking":
      return await convex.action(api.claudeTools.confirmBooking, {
        bookingId: input.bookingId as string,
        nurseId: input.nurseId as string,
      });
    case "proposeAlternativeTimes":
      // Returns a structured object; Claude will use this to compose a message
      return { proposed: input.times, bookingId: input.bookingId };
    case "escalateToHuman":
      return await convex.action(api.claudeTools.escalateToHuman, {
        conversationId,
        reason: input.reason as string,
      });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
```

Note: `proposeAlternativeTimes` doesn't need a Convex action — Claude composes the message itself after getting the structured response, and the text goes into the normal AI reply.

- [ ] **Step 4: Update system prompt to include booking creation instruction**

Claude needs to know how to create a booking before calling `messageNurses`. Update `SYSTEM_PROMPT` in `lib/claudeTools.ts` to add:

```
Before calling messageNurses, you must have a bookingId. Ask the customer for their full address and preferred time, then tell them "Let me check nurse availability" — at that point call getAvailableNurses, then messageNurses with the booking details. Use the conversationId passed in context as a reference for escalation.
```

Actually, Claude needs to create a booking row in Convex before calling `messageNurses`. Add a `createBooking` tool to `CLAUDE_TOOLS` in `lib/claudeTools.ts`:

```typescript
{
  name: "createBooking",
  description: "Creates a booking record. Must be called before messageNurses. Returns a bookingId.",
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
```

Add `createBooking` to the `executeTool` switch:

```typescript
case "createBooking":
  const bookingId = await convex.mutation(api.bookings.create, {
    customerId: input.customerId as Id<"customers">,
    location: input.location as string,
    requestedTime: new Date(input.requestedTime as string).getTime(),
  });
  return { bookingId };
```

And add the import at the top of `app/api/chat/route.ts`:
```typescript
import { Id } from "@/convex/_generated/dataModel";
```

- [ ] **Step 5: Commit**

```bash
git add convex/claudeTools.ts convex/conversations.ts app/api/chat/route.ts lib/claudeTools.ts
git commit -m "feat: implement all Claude tools and booking state machine"
```

---

**⛔ STAGE 3 COMPLETE — Stop here and wait for review before continuing.**

---

## STAGE 4: Nurse Simulator + Activity Panel

### Task 21: Nurse Simulator Scheduled Function

**Files:** Create `convex/nurseSimulator.ts`

- [ ] **Step 1: Write the simulator**

Create `convex/nurseSimulator.ts`:

```typescript
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// Adjust this constant to speed up or slow down the simulator.
// 1 = real time. 5 = 5x faster (default for prototype demos).
const TIME_ACCELERATION = 5;

export const tick = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find all pending queries whose delay has elapsed
    const pending = await ctx.db
      .query("nurseQueries")
      .filter((q) => q.eq(q.field("response"), undefined))
      .collect();

    for (const query of pending) {
      const elapsed = now - query.sentAt;
      const acceleratedDelay = query.responseDelayMs / TIME_ACCELERATION;

      if (elapsed < acceleratedDelay) continue;

      // Look up the nurse to get their reliability
      const nurse = await ctx.db.get(query.nurseId);
      if (!nurse) continue;

      // Low reliability nurses may simply not respond (leave as null)
      const willRespond = Math.random() < Math.max(nurse.simulatedReliability, 0.4);
      if (!willRespond) {
        // Mark as no to avoid re-processing
        await ctx.db.patch(query._id, {
          response: "no",
          respondedAt: now,
        });
        continue;
      }

      const saysYes = Math.random() < nurse.simulatedReliability;
      await ctx.db.patch(query._id, {
        response: saysYes ? "yes" : "no",
        respondedAt: now,
      });
    }
  },
});
```

- [ ] **Step 2: Register the scheduler in convex/crons.ts**

Create `convex/crons.ts`:

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "nurse simulator tick",
  { seconds: 30 },
  internal.nurseSimulator.tick
);

export default crons;
```

Note: With `TIME_ACCELERATION = 5`, a nurse with a 60s–180s simulated delay will respond within 12s–36s real time. The scheduler runs every 30s, so responses appear within ~30s of the query.

- [ ] **Step 3: Commit**

```bash
git add convex/nurseSimulator.ts convex/crons.ts
git commit -m "feat: add nurse simulator scheduled function (5x accelerated)"
```

---

### Task 22: Nurse Activity Panel

**Files:** Create `components/NurseActivityPanel.tsx`, update `components/ChatPage.tsx`

- [ ] **Step 1: Write NurseActivityPanel.tsx**

Create `components/NurseActivityPanel.tsx`:

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface Props {
  conversationId: Id<"conversations"> | null;
}

export default function NurseActivityPanel({ conversationId }: Props) {
  const [open, setOpen] = useState(true);

  // Get all messages that are nurse-related in this conversation
  const messages = useQuery(
    api.messages.list,
    conversationId ? { conversationId } : "skip"
  );

  // Get all nurse queries referenced in Claude tool calls
  const nurseActivity = (messages ?? [])
    .filter((m) => m.claudeReasoning)
    .flatMap((m) => {
      const reasoning = m.claudeReasoning as {
        toolCalls?: Array<{ name: string; input: unknown; result: unknown }>;
      };
      return (reasoning.toolCalls ?? [])
        .filter((t) => ["messageNurses", "checkNurseResponses", "confirmBooking"].includes(t.name))
        .map((t) => ({ tool: t.name, input: t.input, result: t.result, at: m.createdAt }));
    });

  if (nurseActivity.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t border-gray-200 bg-gray-50 flex-shrink-0">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2 text-xs text-gray-500 hover:bg-gray-100">
        <span className="font-medium">Nurse Activity</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-3 space-y-1 max-h-32 overflow-y-auto">
          {nurseActivity.map((activity, i) => (
            <ActivityRow key={i} activity={activity} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ActivityRow({
  activity,
}: {
  activity: { tool: string; input: unknown; result: unknown; at: number };
}) {
  const time = new Date(activity.at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  let label = "";
  if (activity.tool === "messageNurses") {
    const input = activity.input as { nurseIds: string[]; location: string; time: string };
    label = `→ Queried ${input.nurseIds.length} nurse(s) for ${input.location}`;
  } else if (activity.tool === "checkNurseResponses") {
    const result = activity.result as Array<{ response: string }>;
    const yes = result.filter((r) => r.response === "yes").length;
    const no = result.filter((r) => r.response === "no").length;
    const pending = result.filter((r) => r.response === "pending").length;
    label = `← Responses: ${yes} yes, ${no} no, ${pending} pending`;
  } else if (activity.tool === "confirmBooking") {
    label = `✓ Booking confirmed`;
  }

  return (
    <div className="flex gap-2 text-xs text-gray-600">
      <span className="text-gray-400 flex-shrink-0">{time}</span>
      <span>{label}</span>
    </div>
  );
}
```

- [ ] **Step 2: Add NurseActivityPanel to ChatPage.tsx**

In `components/ChatPage.tsx`, import and add the panel between MessageThread and ChatInput:

```tsx
import NurseActivityPanel from "./NurseActivityPanel";

// Inside the return, between MessageThread and ChatInput:
<NurseActivityPanel conversationId={conversationId} />
```

- [ ] **Step 3: Commit**

```bash
git add components/NurseActivityPanel.tsx components/ChatPage.tsx
git commit -m "feat: add nurse activity panel showing tool call activity"
```

---

**⛔ STAGE 4 COMPLETE — Stop here and wait for review before continuing.**

---

## STAGE 5: Inspector Panel

### Task 23: Inspector Panel

**Files:** Create `components/InspectorPanel.tsx`, update `components/MessageBubble.tsx`

- [ ] **Step 1: Write InspectorPanel.tsx**

Create `components/InspectorPanel.tsx`:

```tsx
"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

interface ToolCall {
  name: string;
  input: unknown;
  result: unknown;
}

interface Props {
  toolCalls: ToolCall[];
}

export default function InspectorPanel({ toolCalls }: Props) {
  const [open, setOpen] = useState(false);

  if (toolCalls.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-1 ml-2">
      <CollapsibleTrigger className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
        🔍 Why? ({toolCalls.length} tool{toolCalls.length !== 1 ? "s" : ""} called)
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 bg-gray-50 rounded-lg p-2 border border-gray-100 space-y-2 max-w-sm">
          {toolCalls.map((call, i) => (
            <div key={i} className="text-[11px]">
              <div className="font-medium text-gray-700">→ {call.name}</div>
              <div className="text-gray-500 mt-0.5">
                <span className="text-gray-400">in: </span>
                <code className="break-all">{JSON.stringify(call.input)}</code>
              </div>
              <div className="text-gray-500 mt-0.5">
                <span className="text-gray-400">out: </span>
                <code className="break-all">{JSON.stringify(call.result)}</code>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

- [ ] **Step 2: Update MessageBubble.tsx to show InspectorPanel for AI messages**

Replace `components/MessageBubble.tsx`:

```tsx
import { Doc } from "@/convex/_generated/dataModel";
import InspectorPanel from "./InspectorPanel";

interface Props {
  message: Doc<"messages">;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({ message }: Props) {
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
      {!isCustomer && toolCalls.length > 0 && (
        <InspectorPanel
          toolCalls={toolCalls as Array<{ name: string; input: unknown; result: unknown }>}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Test Inspector**

Send a message that triggers Claude to call tools (e.g., "I want a drip in W2 tomorrow at 3pm"). After Claude replies, verify the "🔍 Why?" link appears below the AI bubble. Click it — tool names, inputs, and outputs should be visible.

- [ ] **Step 4: Commit**

```bash
git add components/InspectorPanel.tsx components/MessageBubble.tsx
git commit -m "feat: add inspector panel showing Claude tool calls below AI messages"
```

---

**⛔ STAGE 5 COMPLETE — Stop here and wait for review before continuing.**

---

## STAGE 6: Polish + Deploy

### Task 24: UI Polish

- [ ] **Step 1: Verify WhatsApp-style styling end-to-end**

Check each of these visually in the browser:
- Background: `#e5ddd5` (warm gray, WhatsApp)
- Customer bubbles: `#d9fdd3` (pale green), right-aligned
- AI bubbles: white, left-aligned
- Header: `#128c7e` (teal)
- Send button: `#00a884` (green)
- Timestamps in `11px` gray
- Typing indicator with animated dots during streaming

Fix any visual inconsistencies before moving on.

- [ ] **Step 2: Add a welcome message on first load**

Update `convex/conversations.ts` `getOrCreate` to insert a welcome message when creating a new conversation:

```typescript
// At the end of the "if no existing" branch, after ctx.db.insert("conversations", ...):
const convId = await ctx.db.insert("conversations", {
  customerId,
  autoReplyEnabled: true,
  lastMessageAt: Date.now(),
});

await ctx.db.insert("messages", {
  conversationId: convId,
  sender: "ai",
  text: "Hi! I'm the Dripdash booking assistant 👋 I can help you schedule an IV therapy session. What area are you in, and when are you looking to book?",
  channel: "prototype",
  createdAt: Date.now(),
});

return convId;
```

- [ ] **Step 3: Commit polish**

```bash
git add -A
git commit -m "polish: WhatsApp styling, welcome message on new conversation"
```

---

### Task 25: Vercel Deploy

- [ ] **Step 1: Push to GitHub**

```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

- [ ] **Step 2: Deploy Convex to production**

```bash
npx convex deploy
```

This pushes schema + functions to the production Convex deployment and outputs the production `NEXT_PUBLIC_CONVEX_URL`.

- [ ] **Step 3: Import to Vercel**

1. Go to vercel.com → New Project → Import from GitHub
2. Select the repo
3. Add environment variables:
   - `NEXT_PUBLIC_CONVEX_URL` (production Convex URL from step 2)
   - `ANTHROPIC_API_KEY`
   - `PROTOTYPE_PASSWORD`
4. Deploy

- [ ] **Step 4: Seed production database**

```bash
curl https://your-vercel-url.vercel.app/api/seed
```

- [ ] **Step 5: Smoke test production**

Open the Vercel URL, enter the password, select a customer, send a test message. Verify Claude responds, nurse queries appear in the activity panel, and the inspector shows tool calls.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: production-ready — all stages complete"
git push
```

---

**✅ STAGE 6 COMPLETE — Prototype is live.**

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered by |
|-------------|-----------|
| WhatsApp-style chat UI | Tasks 10-12 |
| Persona picker dropdown | Task 10 (ChatHeader) |
| Founder mode toggle (stub) | Task 10 (ChatHeader, non-functional) |
| Message thread, green/white bubbles | Tasks 10-11 |
| Streaming responses | Tasks 17-18 |
| Nurse activity panel | Task 22 |
| Inspector "Why?" panel | Task 23 |
| Convex schema (all 7 tables) | Task 4 |
| Seed data (5 nurses, 4 customers) | Task 5 |
| All 6 Claude tools | Tasks 15-16, 20 |
| Booking state machine | Tasks 19-20 |
| Nurse simulator (30s tick, 5x accel) | Task 21 |
| Password gate + localStorage | Tasks 9, 12 |
| No real auth/WhatsApp/SMS | N/A — excluded |
| README + env example | Task 14 |
| Strict TypeScript | Task 1 + throughout |
| Vercel deploy | Task 25 |

**No placeholders found.**

**Type consistency:** `Id<"conversations">`, `Id<"customers">`, `Id<"nurses">` used consistently across all Convex function args and React components.
