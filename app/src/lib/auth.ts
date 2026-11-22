import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

const cookieName = "resilio_session";
const secret = () => process.env.RESILIO_SESSION_SECRET;
function sign(payload: string) { return createHmac("sha256", secret()!).update(payload).digest("base64url"); }

export async function getSessionUser(request: NextRequest): Promise<string | null> {
  if (process.env.NODE_ENV !== "production" && !process.env.RESILIO_ADMIN_PASSWORD) return "local-user";
  if (!secret() || !process.env.RESILIO_ADMIN_PASSWORD) return null;
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try { const data = JSON.parse(Buffer.from(payload, "base64url").toString()); return data.exp > Date.now() ? data.sub : null; } catch { return null; }
}

export function createSession() {
  if (!secret()) throw new Error("RESILIO_SESSION_SECRET is not configured.");
  const payload = Buffer.from(JSON.stringify({ sub: "workspace-owner", exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export const sessionCookieName = cookieName;
