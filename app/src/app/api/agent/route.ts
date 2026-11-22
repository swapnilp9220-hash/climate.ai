import { NextRequest, NextResponse } from "next/server";
import { clearConversations, conversationHistory, deleteConversation, getConversation, runCoreChat } from "@/lib/ai-orchestrator";
import { getSessionUser } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") ?? 0) > 16_384) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  const limit = rateLimit(`chat:${clientKey(request)}`, 20, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Rate limit reached. Try again in a minute." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  try {
    const body = await request.json();
    const result = await runCoreChat({ conversationId: body.conversationId, message: body.message, language: body.language }, request);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The agent could not complete the request.";
    const status = /not configured/i.test(message) ? 503 : /not found/i.test(message) ? 404 : /sign in/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: NextRequest) {
  const userId = await getSessionUser(request);
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const conversationId = request.nextUrl.searchParams.get("conversationId") ?? request.nextUrl.searchParams.get("sessionId");
  if (!conversationId) return NextResponse.json({ conversations: await conversationHistory(userId) });
  const conversation = await getConversation(conversationId, userId);
  return conversation ? NextResponse.json({ history: conversation.messages, conversationId }) : NextResponse.json({ error: "Conversation was not found." }, { status: 404 });
}

export async function DELETE(request: NextRequest) {
  const userId = await getSessionUser(request);
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const conversationId = request.nextUrl.searchParams.get("conversationId") ?? request.nextUrl.searchParams.get("sessionId");
  try {
    if (!conversationId || conversationId === "resilio-main-session") {
      const result = await clearConversations(userId);
      return NextResponse.json({ cleared: true, deleted: result.count });
    }
    const deleted = await deleteConversation(conversationId, userId);
    return NextResponse.json({ cleared: deleted }, { status: deleted ? 200 : 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Clear history failed." }, { status: 503 });
  }
}
