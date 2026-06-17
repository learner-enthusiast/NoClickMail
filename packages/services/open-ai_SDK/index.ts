import { OpenAIAgentsProvider } from "@corsair-dev/mcp";
import { Agent, AgentInputItem, run, tool } from "@openai/agents";
import { corsair } from "../corsair";
type PriorTurn = { role: "user" | "assistant" | "system"; content: string };
export default class TenantCorsairAgent {
  private static readonly CORSAIR_AGENT_INSTRUCTIONS =
    "You have access to Corsair tools. Use list_operations to discover available APIs, " +
    "get_schema to understand required arguments, and run_script to execute them. " +
    "When referencing resources (like channels), always use their ID, not their name.";

  private readonly corsairAgent: Agent;
  private summaryAgent = new Agent({
    name: "Conversation Summarizer",
    instructions: `
  You summarize conversations.
  
  Return:
  - User goals
  - Completed actions
  - Pending tasks
  - Important entities
  
  Be concise.
  `,
  });

  constructor(private readonly tenantId: string) {
    const openAIAgentsProvider = new OpenAIAgentsProvider();

    const tenantScopedCorsairClient = corsair.withTenant(this.tenantId);

    const corsairTools = openAIAgentsProvider.build({
      corsair: tenantScopedCorsairClient,
      tool,
    });

    this.corsairAgent = new Agent({
      name: "tenant-corsair-agent",
      instructions: TenantCorsairAgent.CORSAIR_AGENT_INSTRUCTIONS,
      tools: corsairTools,
    });
  }

  async executePrompt(userPrompt: string, history: PriorTurn[] = []) {
    // Map stored history → agent input items, then append the new user turn.
    const input = [
      ...history.map((m) => ({ role: m.role, content: m.content }) as AgentInputItem),
      { role: "user" as const, content: userPrompt },
    ];

    const summary = await run(this.summaryAgent, JSON.stringify(input));
    const result = await run(this.corsairAgent, summary.finalOutput ?? "");
    return result.finalOutput;
  }
}
