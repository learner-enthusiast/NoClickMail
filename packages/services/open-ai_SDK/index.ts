import { OpenAIAgentsProvider } from "@corsair-dev/mcp";
import { Agent, run, tool } from "@openai/agents";
import { corsair } from "../corsair";

export default class TenantCorsairAgent {
  private static readonly CORSAIR_AGENT_INSTRUCTIONS =
    "You have access to Corsair tools. Use list_operations to discover available APIs, " +
    "get_schema to understand required arguments, and run_script to execute them. " +
    "When referencing resources (like channels), always use their ID, not their name.";

  private readonly corsairAgent: Agent;

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

  async executePrompt(userPrompt: string) {
    const agentRunResult = await run(this.corsairAgent, userPrompt);
    console.log(agentRunResult);
    return agentRunResult.finalOutput;
  }
}
