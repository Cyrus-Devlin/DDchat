# Prompt Feedback Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace rule-based customer AI with a single evolving prompt, and add an inline feedback button that rewrites the prompt based on a test conversation.

**Architecture:** Remove `rules.listActive` from the customer chat route so the prompt is the sole source of truth. A new `/api/feedback-prompt` route receives the conversation + founder note, calls Claude to rewrite the prompt, and activates the new version. A `FeedbackPanel` overlay in the customer chat collects the note, shows a toast on success, and auto-clears the chat.

**Tech Stack:** Next.js 16, TypeScript, Convex, Anthropic SDK, Tailwind, shadcn/ui

---

## File Map

| File | Change |
|------|--------|
| `app/api/chat/route.ts` | Remove `rules.listActive` call and `rulesSection` injection |
| `app/api/feedback-prompt/route.ts` | **New** — one-shot Claude call to rewrite the prompt |
| `components/FeedbackPanel.tsx` | **New** — overlay textarea + submit/cancel |
| `components/ChatHeader.tsx` | Add "💬 Give feedback" button with disabled state |
| `components/ChatPage.tsx` | Add feedback panel state, toast state, success/error handling |

---

## Task 1: Strip rules from customer chat route

**Files:** Modify `app/api/chat/route.ts`

- [ ] **Step 1: Read current app/api/chat/route.ts**

Identify these two blocks to remove:
```typescript
convex.query(api.rules.listActive, {}),   // in the Promise.all
```
and:
```typescript
const rules = activeRules as Array<{ ruleText: string }>;
const rulesSection = rules.length > 0
  ? `\n\n## Business Rules\n${rules.map((r, i) => `${i + 1}. ${r.ruleText}`).join("\n")}`
  : "";
```
and the `rulesSection` concatenation in `systemPrompt`.

- [ ] **Step 2: Remove rules injection**

Replace the parallel fetch block with:
```typescript
  const [activePromptRow, activeKnowledge] = await Promise.all([
    convex.query(api.promptVersions.getActive, { persona: "customer" }),
    convex.query(api.knowledge.listActive, {}),
  ]);
```

Replace the systemPrompt building block with:
```typescript
  const basePrompt = (activePromptRow as { content?: string } | null)?.content
    ?? SYSTEM_PROMPT_FALLBACK;

  const knowledge = activeKnowledge as Array<{ title: string; content: string }>;

  const knowledgeSection = knowledge.length > 0
    ? `\n\n## Knowledge Base\n${knowledge.map((k) => `### ${k.title}\n${k.content}`).join("\n\n")}`
    : "";
  const systemPrompt = basePrompt + knowledgeSection;
```

Also remove the `activeRules` variable and any unused `rules` variable.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1
```
Expected: no output (zero errors).

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: remove rules injection from customer chat — prompt is sole source of truth"
```

---

## Task 2: Create feedback API route

**Files:** Create `app/api/feedback-prompt/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface FeedbackRequest {
  conversationId: string;
  feedbackText: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as FeedbackRequest;
  const { conversationId, feedbackText } = body;

  // Fetch current prompt and conversation in parallel
  const [activePrompt, messages] = await Promise.all([
    convex.query(api.promptVersions.getActive, { persona: "customer" }),
    convex.query(api.messages.list, {
      conversationId: conversationId as Id<"conversations">,
    }),
  ]);

  const currentPrompt = (activePrompt as { content?: string } | null)?.content
    ?? "You are Dripdash's booking assistant.";

  const conversation = (messages as Array<{ sender: string; text: string }>)
    .filter((m) => m.sender === "customer" || m.sender === "ai")
    .map((m) => `${m.sender === "customer" ? "Customer" : "AI"}: ${m.text}`)
    .join("\n\n");

  // One-shot rewrite — no tools, no loop
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: `You are improving an AI customer service system prompt based on founder feedback.

Current system prompt:
<prompt>
${currentPrompt}
</prompt>

Conversation the AI just had:
<conversation>
${conversation || "(no messages yet)"}
</conversation>

Founder's feedback:
<feedback>
${feedbackText}
</feedback>

Rewrite the system prompt to address the feedback. Preserve everything that is working well. Make minimal targeted changes. Return only the new prompt text, nothing else — no explanation, no preamble.`,
    }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const newPrompt = textBlock && "text" in textBlock ? (textBlock.text as string) : null;

  if (!newPrompt) {
    return NextResponse.json({ error: "Failed to generate prompt" }, { status: 500 });
  }

  // Propose then activate new version
  const versionId = await convex.mutation(api.promptVersions.propose, {
    persona: "customer",
    content: newPrompt,
    changeReason: `Founder feedback: ${feedbackText.slice(0, 120)}`,
    proposedBy: "coach_claude",
  });

  await convex.mutation(api.promptVersions.activate, { versionId });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/feedback-prompt/route.ts
git commit -m "feat: add /api/feedback-prompt — rewrites customer prompt from conversation + note"
```

---

## Task 3: Create FeedbackPanel component

**Files:** Create `components/FeedbackPanel.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  onSubmit: (feedbackText: string) => Promise<void>;
  onCancel: () => void;
}

export default function FeedbackPanel({ onSubmit, onCancel }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      // Success: ChatPage closes the panel by setting feedbackOpen=false,
      // which unmounts this component — no need to reset submitting here.
    } catch {
      // Failed: keep panel open so founder can retry
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-xl rounded-t-2xl p-4 z-10">
      <p className="text-sm font-medium text-gray-700 mb-2">What should change?</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="The AI confirmed the postcode too explicitly — it should just continue naturally…"
        disabled={submitting}
        rows={3}
        autoFocus
        className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#128c7e] leading-5"
      />
      <div className="flex justify-end gap-2 mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!text.trim() || submitting}
          className="bg-[#128c7e] hover:bg-[#0e7065] text-white"
        >
          {submitting ? "Updating…" : "Submit feedback"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/FeedbackPanel.tsx
git commit -m "feat: add FeedbackPanel overlay component"
```

---

## Task 4: Update ChatHeader with feedback button

**Files:** Modify `components/ChatHeader.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
interface Props {
  onFeedback: () => void;
  feedbackDisabled: boolean;
}

export default function ChatHeader({ onFeedback, feedbackDisabled }: Props) {
  return (
    <div className="bg-[#128c7e] px-4 py-3 flex items-center justify-between shadow-md flex-shrink-0">
      <span className="text-white font-semibold text-sm">Dripdash Booking Assistant</span>
      <button
        onClick={onFeedback}
        disabled={feedbackDisabled}
        title="Give feedback on this conversation"
        className="text-white/80 hover:text-white text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        💬 Give feedback
      </button>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1
```
Expected: errors about `ChatPage` passing wrong props to `ChatHeader` — these get fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add components/ChatHeader.tsx
git commit -m "feat: add Give feedback button to ChatHeader"
```

---

## Task 5: Wire everything in ChatPage

**Files:** Modify `components/ChatPage.tsx`

- [ ] **Step 1: Replace the file**

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import ChatHeader from "./ChatHeader";
import MessageThread from "./MessageThread";
import ChatInput from "./ChatInput";
import FeedbackPanel from "./FeedbackPanel";

interface StreamingMessage {
  text: string;
  toolsCalled: string[];
}

interface Toast {
  message: string;
  type: "success" | "error";
}

interface Props {
  onSwitchToCoach: (message: string) => void;
}

export default function ChatPage({ onSwitchToCoach }: Props) {
  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getDefault = useMutation(api.conversations.getDefault);
  const clearConversation = useMutation(api.messages.clearConversation);
  const getOrCreateCoach = useMutation(api.coachConversations.getOrCreate);
  const saveFounderMessage = useMutation(api.coachMessages.saveFounderMessage);
  const recordFeedback = useMutation(api.feedback.record);

  useEffect(() => {
    getDefault({}).then((id) => setConversationId(id));
  }, []);

  const messages = useQuery(
    api.messages.list,
    conversationId ? { conversationId } : "skip"
  );

  const showToast = (message: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const handleClear = async () => {
    if (!conversationId) return;
    await clearConversation({ conversationId });
  };

  const handleSend = async (text: string) => {
    if (!conversationId) return;

    setStreaming({ text: "", toolsCalled: [] });

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, text }),
    });

    if (!res.body) {
      setStreaming(null);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

      for (const line of lines) {
        try {
          const json = JSON.parse(line.slice(6)) as
            | { type: "delta"; text: string }
            | { type: "tool"; name: string }
            | { type: "done" }
            | { type: "error"; message: string };

          if (json.type === "delta") {
            setStreaming((prev) =>
              prev ? { ...prev, text: prev.text + json.text } : null
            );
          } else if (json.type === "tool") {
            setStreaming((prev) =>
              prev ? { ...prev, toolsCalled: [...prev.toolsCalled, json.name] } : null
            );
          } else if (json.type === "done" || json.type === "error") {
            setStreaming(null);
          }
        } catch {
          // malformed SSE line, skip
        }
      }
    }

    setStreaming(null);
  };

  const handleFeedbackSubmit = async (feedbackText: string): Promise<void> => {
    if (!conversationId) throw new Error("No conversation");

    const res = await fetch("/api/feedback-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, feedbackText }),
    });

    if (!res.ok) {
      showToast("✗ Update failed — try again", "error");
      throw new Error("Update failed"); // FeedbackPanel catches and stays open
    }

    // Success: close panel, show toast, clear chat
    setFeedbackOpen(false);
    showToast("✓ Prompt updated", "success");
    await clearConversation({ conversationId });
  };

  const handleMessageFeedback = async (messageId: string, messageText: string, feedbackText: string) => {
    await recordFeedback({
      messageId: messageId as Id<"messages">,
      conversationId: conversationId ?? undefined,
      text: feedbackText,
      sentiment: "negative",
      resolution: "pending",
    });

    const coachConvId = await getOrCreateCoach({});
    await saveFounderMessage({
      coachConversationId: coachConvId,
      text: `🚩 Flagged AI reply for review:\n\n"${messageText}"\n\nMy feedback: ${feedbackText}`,
    });

    const contextMessage = `🚩 Flagged AI reply for review:\n\n"${messageText}"\n\nFounder's feedback: ${feedbackText}`;
    onSwitchToCoach(contextMessage);
  };

  const hasMessages = (messages ?? []).length > 0;

  return (
    <div className="flex flex-col h-full bg-[#e5ddd5]">
      <ChatHeader
        onFeedback={() => setFeedbackOpen(true)}
        feedbackDisabled={!conversationId || !hasMessages}
      />
      <div className="flex-1 overflow-hidden relative">
        <MessageThread
          messages={messages ?? []}
          streamingMessage={streaming}
          onFeedback={handleMessageFeedback}
        />
        {toast && (
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full text-sm text-white shadow-lg whitespace-nowrap ${
            toast.type === "success" ? "bg-[#128c7e]" : "bg-red-500"
          }`}>
            {toast.message}
          </div>
        )}
        {feedbackOpen && (
          <FeedbackPanel
            onSubmit={handleFeedbackSubmit}
            onCancel={() => setFeedbackOpen(false)}
          />
        )}
      </div>
      <ChatInput
        onSend={handleSend}
        onClear={handleClear}
        disabled={!conversationId}
      />
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1
```
Expected: no output (zero errors).

- [ ] **Step 3: Verify the MessageThread still needs `relative` positioning**

The `relative` class is on the `div` wrapping `MessageThread`. Confirm `MessageThread.tsx` itself has `flex-1 overflow-y-auto` — it should be unchanged. The `relative` wrapper gives `FeedbackPanel` (`absolute bottom-0`) and the toast (`absolute top-4`) their positioning context.

- [ ] **Step 4: Commit**

```bash
git add components/ChatPage.tsx
git commit -m "feat: wire FeedbackPanel and toast into ChatPage"
```

---

## Task 6: Verify end-to-end

- [ ] **Step 1: Confirm npx convex dev is running and deployed**

Check the terminal running `npx convex dev` shows no errors and `✔ Convex functions ready`.

- [ ] **Step 2: Start dev server if not running**

```bash
npm run dev
```

- [ ] **Step 3: Run the booking reset to start with a clean prompt**

```bash
curl -X POST http://localhost:3000/api/reset-booking
```

Expected response: `{"retired":{"rules":...,"knowledge":...,"prompts":...},"created":{"rules":5,...}}`

- [ ] **Step 4: Test the full feedback loop**

1. Open `http://localhost:3000`
2. Send a test message as a customer — e.g. "Hi, I want a drip"
3. Observe the AI response
4. Click "💬 Give feedback" in the header — panel appears
5. Type: "The AI should ask which drip they're interested in before anything else"
6. Click "Submit feedback"
7. Observe: button shows "Updating…", then "✓ Prompt updated" toast appears, chat clears
8. Open `http://localhost:3000/api/debug` — confirm `promptVersion` incremented
9. Send the same opening message again — observe whether the AI behaviour changed

- [ ] **Step 5: Test disabled state**

Clear the chat (trash icon). Verify "💬 Give feedback" button is greyed out and unclickable with no messages.

- [ ] **Step 6: Test error handling**

Temporarily set `ANTHROPIC_API_KEY=bad-key` in `.env.local`, restart `npm run dev`, try submitting feedback.
Expected: "✗ Update failed — try again" toast, panel stays open, chat NOT cleared.
Restore the real key and restart afterwards.

---

## Self-Review

**Spec coverage:**
- ✅ Rules removed from customer chat route (Task 1)
- ✅ `/api/feedback-prompt` route (Task 2)
- ✅ `FeedbackPanel` component (Task 3)
- ✅ `ChatHeader` feedback button, disabled when no messages (Task 4)
- ✅ Toast: success (green) and error (red) (Task 5)
- ✅ On success: panel closes, toast shows, chat clears (Task 5)
- ✅ On error: toast shows, panel stays open, chat NOT cleared (Task 5)
- ✅ Prompt history preserved in `promptVersions` (inherent — activate never deletes)

**No placeholders found.**

**Type consistency:** `handleFeedbackSubmit: (feedbackText: string) => Promise<void>` matches `FeedbackPanel`'s `onSubmit` prop type exactly. `Toast` interface used consistently. `feedbackDisabled` boolean passed and consumed correctly.
