import { agricultureAgent } from "./agriculture-agent";
import { climateAgent } from "./climate-agent";
import { resourceAgent } from "./resource-agent";

export const specializedAgents = [agricultureAgent, climateAgent, resourceAgent];
export type SpecializedAgent = (typeof specializedAgents)[number];

export function resolveAgentTool(toolName: string) {
  const agent = specializedAgents.find((candidate) => Object.hasOwn(candidate.tools, toolName));
  if (!agent) throw new Error(`No specialized agent owns tool: ${toolName}`);
  const tool = (agent.tools as Record<string, (...args: string[]) => Promise<import("@/lib/tools").ToolResult>>)[toolName];
  if (!tool) throw new Error(`The ${agent.name} does not expose tool: ${toolName}`);
  return { agent, tool };
}
