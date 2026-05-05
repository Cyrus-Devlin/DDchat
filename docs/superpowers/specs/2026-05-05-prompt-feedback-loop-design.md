# Prompt Feedback Loop Design

## Goal

Replace the current rules-based customer AI with a single evolving system prompt. The founder gives plain-English feedback on a test conversation, Coach rewrites the prompt in the background, and the chat resets ready for the next test. No tab switching, no approval step, no rule accumulation.

## Architecture

### What changes

**1. Rules removed from customer AI context**
`api.rules.listActive` is stripped from `app/api/chat/route.ts`. The customer AI receives only:
- Active `promptVersions` entry (persona: "customer") — the single source of truth
- Active `knowledge` entries (reference data: menu, pricing, etc.)

Rules still exist in the DB and are still manageable via the Coach tab, but they no longer affect the customer AI. Everything the customer AI knows lives in one prompt.

**2. New `/api/feedback-prompt` route**
A POST endpoint that:
1. Fetches the current active customer prompt from `promptVersions`
2. Fetches the full conversation from `messages` for the given `conversationId`
3. Calls Claude (one-shot, no tools) with the prompt, conversation, and feedback note
4. Receives a rewritten system prompt
5. Calls `api.promptVersions.propose` + `api.promptVersions.activate` to create and activate the new version
6. Returns `{ ok: true }`

The Claude call uses this instruction:
> "Here is the current customer AI system prompt. Here is a conversation it just had. The founder's feedback: [feedbackText]. Rewrite the system prompt to address the feedback. Preserve everything that is working well. Return only the new prompt text, nothing else."

**3. No change to Coach tab**
The Coach tab remains for heavier tasks: uploading documents, reviewing prompt version history, rolling back to a previous version.

---

## UI Changes

### ChatHeader.tsx
Adds a "💬 Give feedback" button on the right side of the teal header bar. Button is disabled when the conversation has no messages.

### FeedbackPanel.tsx (new component)
A card that overlays the bottom of the message thread when the feedback button is clicked. Contains:
- A textarea: "What should change?"
- Cancel button (closes panel, no action)
- Submit button (triggers the feedback flow)

States:
- Default: textarea + cancel + submit
- Submitting: button shows "Updating…", textarea disabled
- Success: panel closes, green toast "✓ Prompt updated", chat clears
- Error: red toast "✗ Update failed — try again", panel stays open, chat does NOT clear

### ChatInput.tsx
No change. Trash icon (Clear Chat) remains for resetting without feedback.

---

## Data Flow

```
Founder types feedback → POST /api/feedback-prompt
  → fetch current prompt (promptVersions.getActive)
  → fetch conversation (messages.list)
  → call Claude: rewrite prompt
  → promptVersions.propose + activate
  → return { ok: true }
Client receives ok
  → show "✓ Prompt updated" toast
  → call messages.clearConversation
  → close feedback panel
```

---

## Files to create / modify

| File | Change |
|------|--------|
| `app/api/feedback-prompt/route.ts` | New — feedback processing endpoint |
| `components/FeedbackPanel.tsx` | New — overlay feedback UI |
| `components/ChatHeader.tsx` | Add "💬 Give feedback" button + disabled state |
| `components/ChatPage.tsx` | Wire feedback panel open/close + success handler |
| `app/api/chat/route.ts` | Remove `api.rules.listActive` call |

---

## Guardrails

- Old prompt versions are never deleted — `promptVersions` table retains full history for rollback via Coach tab
- Feedback button disabled with no messages (nothing for Claude to review)
- Failed updates do not clear the chat (founder can retry or use Coach tab)
- Claude is instructed to preserve working behaviour — feedback is additive correction, not full rewrites

---

## Out of scope

- Automatic prompt improvement without founder input
- Showing the diff of what changed (Coach tab handles this for users who want it)
- Multi-turn feedback conversation (this is single-shot: one note → one rewrite)
- Rules table deprecated from customer AI but not removed from DB (Coach still manages it)
