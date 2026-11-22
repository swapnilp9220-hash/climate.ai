import { NextResponse } from "next/server";
import { conversationHistory } from "@/lib/ai-orchestrator";
import { getSessionUser } from "@/lib/auth";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUser(request);
    if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    return NextResponse.json({ conversations: await conversationHistory(userId) });
  }
  catch { return NextResponse.json({ error: "Could not load conversations." }, { status: 503 }); }
}

export async function DELETE(request: NextRequest) {
  const userId = await getSessionUser(request);
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Conversation storage is not configured." }, { status: 503 });
  const result = await db.conversation.deleteMany({ where: { userId } });
  return NextResponse.json({ deleted: result.count });
}
