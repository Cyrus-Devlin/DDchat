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
  flaggedMessageId?: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as CoachRequest;
  const { coachConversationId, text, flaggedMessageId } = body;

  // Get active coach prompt from DB
  const activePrompt = await convex.query(api.promptVersions.getActive, {
    persona: "coach",
  });
  let systemPrompt = activePrompt?.content ??
    "You are Coach Claude, the Dripdash founder's AI training partner.";

  // Inject flagged message context if present
  if (flaggedMessageId) {
    const flagged = await convex.query(api.messages.getById, {
      messageId: flaggedMessageId as Id<"messages">,
    });
    if (flagged) {
      systemPrompt +=
        `\n\n## Flagged Customer AI Reply\nThe founder just flagged this AI reply for review:\n"${flagged.text}"\n\nAsk what was wrong with it before doing anything else.`;
    }
  }

  // Build conversation history
  const history = await convex.query(api.coachMessages.list, {
    coachConversationId: coachConversationId as Id<"coachConversations">,
  });

  // Include all prior messages except the one just saved (it's the last founder message)
  const prior = history.slice(0, -1);
  const messageHistory: Anthropic.MessageParam[] = prior
    .filter((m: { sender: string; text: string }) => m.sender === "founder" || m.sender === "coach")
    .map((m: { sender: string; text: string }) => ({
      role: (m.sender === "founder" ? "user" : "assistant") as "user" | "assistant",
      content: m.text,
    }));

  // Append the current user message
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
              // Signal tool call to client
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "tool", name: toolUse.name })}\n\n`
                )
              );
              const result = await executeCoachTool(
                toolUse.name,
                toolUse.input as Record<string, unknown>
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
              await new Promise((r) => setTimeout(r, 20));
            }
          }
          break;
        }

        // Save complete reply to Convex
        await convex.mutation(api.coachMessages.saveCoachReply, {
          coachConversationId: coachConversationId as Id<"coachConversations">,
          text: fullText,
          claudeReasoning: toolCalls.length > 0 ? { toolCalls } : undefined,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message })}\n\n`
          )
        );
      }

      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
      );
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

async function executeCoachTool(
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "searchKnowledge":
      return await convex.action(api.coachTools.searchKnowledge, {
        query: input.query as string,
      });
    case "searchRules":
      return await convex.action(api.coachTools.searchRules, {
        query: input.query as string,
      });
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
      return await convex.action(api.coachTools.retireKnowledge, {
        id: input.id as string,
      });
    case "retireRule":
      return await convex.action(api.coachTools.retireRule, {
        id: input.id as string,
      });
    case "proposePromptUpdate":
      return await convex.action(api.coachTools.proposePromptUpdate, {
        persona: input.persona as "customer" | "coach",
        newContent: input.newContent as string,
        reason: input.reason as string,
      });
    case "activatePromptVersion":
      return await convex.action(api.coachTools.activatePromptVersion, {
        versionId: input.versionId as string,
      });
    case "rollbackPrompt":
      return await convex.action(api.coachTools.rollbackPrompt, {
        persona: input.persona as "customer" | "coach",
      });
    case "getRecentCustomerConversation":
      return await convex.action(api.coachTools.getRecentCustomerConversation, {
        messageId: input.messageId as string,
      });
    case "simulateCustomerReply":
      return await convex.action(api.coachTools.simulateCustomerReply, {
        scenario: input.scenario as string,
      });
    case "recordFeedback":
      return await convex.action(api.coachTools.recordFeedback, {
        messageId: input.messageId as string | undefined,
        text: input.text as string,
        sentiment: input.sentiment as "positive" | "negative" | "neutral",
        resolution: input.resolution as
          | "addressed_by_rule"
          | "addressed_by_prompt_change"
          | "addressed_by_knowledge"
          | "noted"
          | "pending",
      });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
