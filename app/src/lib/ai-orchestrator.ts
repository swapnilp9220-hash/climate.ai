import OpenAI from "openai";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { toolSchemas, type ToolResult } from "@/lib/tools";
import type { NextRequest } from "next/server";
import { languageName } from "@/lib/agent-language";
import { resolveAgentTool } from "@/lib/agents";
import { parseChatInput, requiredText } from "@/lib/input-validation";

const functionTools = Object.entries(toolSchemas).map(([name, tool]) => ({ type: "function" as const, function: { name, description: tool.description, parameters: tool.parameters, strict: true } }));

function validateArguments(name: string, value: unknown) {
  const args = value as Record<string, unknown>;
  const location = requiredText(args.location, "Location", 2, 120);
  if (["get_mandi_prices", "analyze_crop_conditions", "estimate_crop_yield"].includes(name)) {
    return { crop: requiredText(args.crop, "Crop", 2, 80), location };
  }
  return { location };
}

export async function runCoreChat(payload: unknown, request: NextRequest) {
  const { conversationId, message, language } = parseChatInput(payload);
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Sign in is required to use AI chat.");
  if (!process.env.OPENAI_API_KEY) throw new Error("AI is not configured: add OPENAI_API_KEY on the server.");
  if (!process.env.DATABASE_URL) throw new Error("Conversation storage is not configured: add DATABASE_URL.");

  let conversation = conversationId ? await db.conversation.findFirst({ where: { id: conversationId, userId } }) : null;
  if (conversationId && !conversation) throw new Error("Conversation was not found.");
  if (!conversation) conversation = await db.conversation.create({ data: { userId, title: message.slice(0, 72) } });
  const previous = await db.conversationMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" }, take: 20 });
  await db.conversationMessage.create({ data: { conversationId: conversation.id, role: "user", content: message } });

  const responseLanguage = languageName(language);
  const system = `You are ResilioAI Core, an agriculture, climate, and resource assistant. Reply in ${responseLanguage}, unless the user asks for a different language. Use backend tools for current and location-specific data. Do not invent measurements, market prices, yield estimates, meter readings, or savings. Explain data source, freshness, and units. Clearly mark unavailable sources. For climate risk explain the screening method and that it is not an official seasonal index. Format answers as readable Markdown and finish with a short Sources list containing the providers and timestamps returned by tools. Never invent references. Ask a concise follow-up when location or crop details are essential. Never make real-world system changes.`;
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...previous.map((item) => ({ role: item.role as "user" | "assistant", content: item.content })),
    { role: "user", content: message },
  ];
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 20000, maxRetries: 1 });
  const activities: Array<{ agent: string; tool: string; status: string; result?: ToolResult }> = [];
  let answer = "";
  for (let pass = 0; pass < 3; pass++) {
    const result = await client.chat.completions.create({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", messages, tools: functionTools, tool_choice: "auto", temperature: 0.25 });
    const response = result.choices[0]?.message;
    if (!response) throw new Error("The AI returned an empty response.");
    messages.push(response);
    if (!response.tool_calls?.length) { answer = response.content ?? "I could not prepare a response."; break; }

    const toolMessages = await Promise.all(response.tool_calls.slice(0, 5).map(async (call) => {
      if (call.type !== "function") {
        const note = "This ResilioAI deployment only supports its registered read-only function tools.";
        return { role: "tool" as const, tool_call_id: call.id, content: JSON.stringify({ available: false, data: null, source: "tool router", observedAt: new Date().toISOString(), dataType: "unavailable", note }) };
      }
      const name = call.function.name;
      let resolved: ReturnType<typeof resolveAgentTool> | undefined;
      try { resolved = resolveAgentTool(name); }
      catch (error) {
        const message = error instanceof Error ? error.message : "Unknown tool";
        return { role: "tool" as const, tool_call_id: call.id, content: JSON.stringify({ available: false, data: null, source: "tool router", observedAt: new Date().toISOString(), dataType: "unavailable", note: message }) };
      }
      const activity: { agent: string; tool: string; status: string; result?: ToolResult } = { agent: resolved.agent.name, tool: name, status: "running" };
      activities.push(activity);
      try {
        const args = validateArguments(name, JSON.parse(call.function.arguments));
        const toolResult = await resolved.tool(...Object.values(args));
        activity.status = toolResult.available ? "complete" : "unavailable";
        activity.result = toolResult;
        await db.toolExecutionLog.create({ data: { tool: name, status: activity.status, source: toolResult.source } }).catch(() => undefined);
        await db.agentExecutionLog.create({ data: { conversationId: conversation!.id, agent: activity.agent, status: activity.status, summary: name } }).catch(() => undefined);
        return { role: "tool" as const, tool_call_id: call.id, content: JSON.stringify(toolResult) };
      } catch (error) {
        activity.status = "failed";
        const toolResult: ToolResult = { available: false, data: null, source: "tool validation", observedAt: new Date().toISOString(), dataType: "unavailable", note: error instanceof Error ? error.message : "Tool failed" };
        activity.result = toolResult;
        await db.toolExecutionLog.create({ data: { tool: name, status: "failed", source: toolResult.source } }).catch(() => undefined);
        return { role: "tool" as const, tool_call_id: call.id, content: JSON.stringify(toolResult) };
      }
    }));
    for (const call of response.tool_calls.slice(5)) {
      const toolResult: ToolResult = { available: false, data: null, source: "tool execution limit", observedAt: new Date().toISOString(), dataType: "unavailable", note: "At most five tools are executed per model turn. Ask a narrower question to run the remaining analysis." };
      toolMessages.push({ role: "tool" as const, tool_call_id: call.id, content: JSON.stringify(toolResult) });
    }
    messages.push(...toolMessages);
  }
  if (!answer) throw new Error("The analysis reached its tool-call limit. Please narrow the request and retry.");
  await db.conversationMessage.create({ data: { conversationId: conversation.id, role: "assistant", content: answer } });
  await db.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
  return { conversationId: conversation.id, answer, message: answer, location: undefined, route: [...new Set(activities.map((item) => item.agent))], calls: activities, activities };
}

export async function conversationHistory(userId: string) {
  if (!process.env.DATABASE_URL) return [];
  return db.conversation.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 25, select: { id: true, title: true, updatedAt: true } });
}
export async function getConversation(id: string, userId: string) {
  if (!process.env.DATABASE_URL) throw new Error("Conversation storage is not configured.");
  return db.conversation.findFirst({ where: { id, userId }, select: { id: true, title: true, messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true, createdAt: true } } } });
}
export async function deleteConversation(id: string, userId: string) {
  if (!process.env.DATABASE_URL) throw new Error("Conversation storage is not configured.");
  return (await db.conversation.deleteMany({ where: { id, userId } })).count > 0;
}
export async function clearConversations(userId: string) {
  if (!process.env.DATABASE_URL) throw new Error("Conversation storage is not configured.");
  return db.conversation.deleteMany({ where: { userId } });
}
