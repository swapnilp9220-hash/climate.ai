import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/lib/db";

async function check(name: string, task: () => Promise<unknown>) {
  try { await task(); return true; } catch { return false; }
}

export async function GET() {
  const [languageModel, database, weather, soil] = await Promise.all([
    check("language model", async () => { if (!process.env.OPENAI_API_KEY) throw new Error(); const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 4500, maxRetries: 0 }); await client.models.list(); }),
    check("database", async () => { if (!process.env.DATABASE_URL) throw new Error(); await db.$queryRaw`SELECT 1`; }),
    check("weather", async () => { const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=19.9&longitude=74.8&current=temperature_2m", { signal: AbortSignal.timeout(4500), cache: "no-store" }); if (!response.ok) throw new Error(); }),
    check("soil", async () => { const response = await fetch("https://rest.isric.org/soilgrids/v2.0/properties/query?lon=74.8&lat=19.9&property=phh2o&depth=0-5cm&value=mean", { signal: AbortSignal.timeout(4500), cache: "no-store" }); if (!response.ok) throw new Error(); }),
  ]);
  const checks = { languageModel, database, weather, soil, mandi: Boolean(process.env.AGMARKNET_API_KEY), resourceMeters: false };
  const coreConfigured = checks.languageModel && checks.database;
  const status = coreConfigured && checks.weather && checks.soil ? "online" : Object.values(checks).some(Boolean) ? "degraded" : "offline";
  return NextResponse.json({ status, checks, checkedAt: new Date().toISOString() }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
