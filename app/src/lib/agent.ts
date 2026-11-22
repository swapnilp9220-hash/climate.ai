// Backwards-compatible public entry point. All tool execution and orchestration
// now lives in the server-controlled Core services; no demo tool results here.
export { runCoreChat, conversationHistory, getConversation, deleteConversation, clearConversations } from "@/lib/ai-orchestrator";
export { toolRegistry, toolSchemas } from "@/lib/tools";
