import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CLAUDE_TOOLS } from "@/lib/claudeTools";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Fallback if DB has no active prompt (should not happen after seeding)
const SYSTEM_PROMPT_FALLBACK =
  "You are Dripdash's booking assistant. Help customers schedule IV therapy sessions in London.";

interface ChatRequest {
  conversationId: string;
  text: string;
  // customerId is now derived server-side from the conversation
}

export async function POST(req: NextRequest) {
  const body = await req.json() as ChatRequest;
  const { conversationId, text } = body;

  // Derive customerId from the conversation
  const conversation = await convex.query(api.conversations.get, {
    conversationId: conversationId as Id<"conversations">,
  });
  if (!conversation) {
    return new Response(
      JSON.stringify({ error: "Conversation not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const customerId = conversation.customerId;

  // Save customer message (skip hardcoded AI reply)
  await convex.mutation(api.messages.send, {
    conversationId: conversationId as Id<"conversations">,
    customerId,
    text,
    skipAiReply: true,
  });

  // Build system prompt from DB: base prompt + active knowledge
  const [activePromptRow, activeKnowledge] = await Promise.all([
    convex.query(api.promptVersions.getActive, { persona: "customer" }),
    convex.query(api.knowledge.listActive, {}),
  ]);

  const basePrompt = (activePromptRow as { content?: string } | null)?.content
    ?? SYSTEM_PROMPT_FALLBACK;

  const knowledge = activeKnowledge as Array<{ title: string; content: string }>;

  const knowledgeSection = knowledge.length > 0
    ? `\n\n## Knowledge Base\n${knowledge.map((k) => `### ${k.title}\n${k.content}`).join("\n\n")}`
    : "";
  const systemPrompt = basePrompt + knowledgeSection;

  // Load conversation history
  const history = await convex.query(api.messages.list, {
    conversationId: conversationId as Id<"conversations">,
  });

  // Build message history (exclude the message we just saved — it's the last one)
  const prior = (history as Array<{ sender: string; text: string }>).slice(0, -1);
  const messageHistory: Anthropic.MessageParam[] = prior
    .filter((m) => m.sender === "customer" || m.sender === "ai")
    .map((m) => ({
      role: (m.sender === "customer" ? "user" : "assistant") as "user" | "assistant",
      content: m.text,
    }));
  messageHistory.push({ role: "user", content: text });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      const toolCalls: Array<{ name: string; input: unknown; result: unknown }> = [];
      const messages: Anthropic.MessageParam[] = [...messageHistory];

      try {
        while (true) {
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 1024,
            system: systemPrompt,
            tools: CLAUDE_TOOLS,
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
                encoder.encode(
                  `data: ${JSON.stringify({ type: "tool", name: toolUse.name })}\n\n`
                )
              );
              const result = await executeCustomerTool(
                toolUse.name,
                toolUse.input as Record<string, unknown>,
                conversationId
              );
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

          // Stream final text word-by-word
          const textBlock = response.content.find(
            (b): b is Anthropic.TextBlock => b.type === "text"
          );
          if (textBlock) {
            const words = textBlock.text.split(" ");
            for (const word of words) {
              const chunk = fullText === "" ? word : ` ${word}`;
              fullText += chunk;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "delta", text: chunk })}\n\n`
                )
              );
              await new Promise((r) => setTimeout(r, 25));
            }
          }
          break;
        }

        // Save AI reply with Claude reasoning
        await convex.mutation(api.messages.saveAiReply, {
          conversationId: conversationId as Id<"conversations">,
          text: fullText,
          claudeReasoning: toolCalls.length > 0 ? { toolCalls } : undefined,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`)
        );
      }

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

async function executeCustomerTool(
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
