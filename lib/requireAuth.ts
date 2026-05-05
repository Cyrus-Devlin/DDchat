import { NextRequest, NextResponse } from "next/server";

export function requireAuth(req: NextRequest): NextResponse | null {
  const auth = req.headers.get("x-admin-password");
  if (auth !== process.env.PROTOTYPE_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
