import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET() {
  const [rules, knowledge, prompt] = await Promise.all([
    convex.query(api.rules.listActive, {}),
    convex.query(api.knowledge.listActive, {}),
    convex.query(api.promptVersions.getActive, { persona: "customer" }),
  ]);

  return NextResponse.json({
    rules: (rules as Array<{ ruleText: string }>).map((r) => r.ruleText),
    knowledgeEntries: (knowledge as Array<{ title: string }>).map((k) => k.title),
    promptVersion: (prompt as { version?: number } | null)?.version ?? null,
    promptPreview: ((prompt as { content?: string } | null)?.content ?? "").slice(0, 100),
  });
}
