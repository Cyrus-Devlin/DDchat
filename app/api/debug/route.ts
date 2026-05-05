import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { requireAuth } from "@/lib/requireAuth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const [rules, knowledge, prompt] = await Promise.all([
    convex.query(api.rules.listActive, {}),
    convex.query(api.knowledge.listActive, {}),
    convex.query(api.promptVersions.getActive, { persona: "customer" }),
  ]);

  const basePrompt = (prompt as { content?: string } | null)?.content ?? "(no active prompt)";
  const rulesSection = (rules as Array<{ ruleText: string }>).length > 0
    ? `\n\n## Business Rules\n${(rules as Array<{ ruleText: string }>).map((r, i) => `${i + 1}. ${r.ruleText}`).join("\n")}`
    : "";
  const fullSystemPrompt = basePrompt + rulesSection;

  return NextResponse.json({
    promptVersion: (prompt as { version?: number } | null)?.version ?? null,
    ruleCount: (rules as Array<{ ruleText: string }>).length,
    rules: (rules as Array<{ ruleText: string }>).map((r) => r.ruleText),
    knowledgeEntries: (knowledge as Array<{ title: string }>).map((k) => k.title),
    fullSystemPrompt,
  });
}
