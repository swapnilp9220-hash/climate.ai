import { NextResponse } from "next/server";
import { deleteConversation, getConversation } from "@/lib/ai-orchestrator";
import { getSessionUser } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUser(request);
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await context.params;
  const conversation = await getConversation(id, userId);
  return conversation ? NextResponse.json({ conversation }) : NextResponse.json({ error: "Conversation was not found." }, { status: 404 });
}
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getSessionUser(request);
    if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { id } = await context.params;
    if (!/^[a-zA-Z0-9_-]{8,40}$/.test(id)) return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 });
    const deleted = await deleteConversation(id, userId);
    return NextResponse.json({ deleted }, { status: deleted ? 200 : 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 503 });
  }
}
