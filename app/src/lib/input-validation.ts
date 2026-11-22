export type SupportedLanguage = "en" | "hi" | "mr";

export function requiredText(value: unknown, label: string, minimum: number, maximum: number) {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const clean = value.trim();
  if (clean.length < minimum) throw new Error(`${label} must contain at least ${minimum} characters.`);
  if (clean.length > maximum) throw new Error(`${label} must contain no more than ${maximum} characters.`);
  return clean;
}

export function parseChatInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Request body must be an object.");
  const body = value as Record<string, unknown>;
  const message = requiredText(body.message, "Message", 1, 2000);
  const conversationId = body.conversationId === undefined ? undefined : requiredText(body.conversationId, "Conversation ID", 8, 40);
  const language = body.language === undefined ? "en" : body.language;
  if (language !== "en" && language !== "hi" && language !== "mr") throw new Error("Language must be en, hi, or mr.");
  return { conversationId, message, language: language as SupportedLanguage };
}
