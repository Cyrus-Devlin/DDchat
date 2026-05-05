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

  const versionId = await convex.mutation(api.promptVersions.propose, {
    persona: "customer",
    content: newPrompt,
    changeReason: `Founder feedback: ${feedbackText.slice(0, 120)}`,
    proposedBy: "coach_claude",
  });

  await convex.mutation(api.promptVersions.activate, { versionId });

  return NextResponse.json({ ok: true });
}
