import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { createSession, getSessionUser, sessionCookieName } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: Boolean(await getSessionUser(request)), setupRequired: !process.env.RESILIO_ADMIN_PASSWORD || !process.env.RESILIO_SESSION_SECRET });
}
export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") ?? 0) > 4_096) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  const limit = rateLimit(`login:${clientKey(request)}`, 8, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many sign-in attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  if (!process.env.RESILIO_ADMIN_PASSWORD || !process.env.RESILIO_SESSION_SECRET) return NextResponse.json({ error: "Configure RESILIO_ADMIN_PASSWORD and RESILIO_SESSION_SECRET on the server first." }, { status: 503 });
  try {
    const body = await request.json();
    if (typeof body.password !== "string" || body.password.length > 256) return NextResponse.json({ error: "The password is incorrect." }, { status: 401 });
    const supplied = createHash("sha256").update(body.password).digest();
    const expected = createHash("sha256").update(process.env.RESILIO_ADMIN_PASSWORD).digest();
    if (!timingSafeEqual(supplied, expected)) return NextResponse.json({ error: "The password is incorrect." }, { status: 401 });
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(sessionCookieName, createSession(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch { return NextResponse.json({ error: "Sign in could not be completed." }, { status: 400 }); }
}
export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(sessionCookieName, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
