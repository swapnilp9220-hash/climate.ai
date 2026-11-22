import { NextRequest, NextResponse } from "next/server";
import { runCoreChat } from "@/lib/ai-orchestrator";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") ?? 0) > 16_384) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  const limit = rateLimit(`chat:${clientKey(request)}`, 20, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Rate limit reached. Try again in a minute." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  try {
    const body = await request.json();
    return NextResponse.json(await runCoreChat(body, request));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = /not configured/i.test(message) ? 503 : /not found/i.test(message) ? 404 : /sign in/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
