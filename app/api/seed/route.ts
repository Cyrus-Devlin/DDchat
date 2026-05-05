import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { requireAuth } from "@/lib/requireAuth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const result = await convex.mutation(api.seed.run, {});
  return NextResponse.json(result);
}
