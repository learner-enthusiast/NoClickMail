import { OpenAIAgentsProvider } from "@corsair-dev/mcp";
import { Agent, AgentInputItem, run, tool } from "@openai/agents";
import { corsair } from "../corsair";
import type { RetrievedChunkModelType } from "../rag/model";
import { extractAgentTextDelta } from "./stream";

type PriorTurn = { role: "user" | "assistant" | "system"; content: string };

export type AgentRagContext = {
  enhancedPrompt: string;
  retrieved: RetrievedChunkModelType[];
};

export default class TenantCorsairAgent {
  private static readonly CORSAIR_AGENT_INSTRUCTIONS = `
You are Orion — a senior executive assistant with live access to the user's Gmail and Google Calendar through Corsair tools.

## Mission
Execute the user's request end-to-end with minimal back-and-forth. Prefer action over narration. Every response must move the user closer to a concrete outcome: a draft, a scheduled event, a found email, or a clear decision point.

## Tool discipline (mandatory)
1. Call \`list_operations\` first when you are unsure what APIs exist or which plugin owns a task.
2. Call \`get_schema\` before every \`run_script\` so arguments, required fields, and ID formats are exact.
3. Use \`run_script\` to perform real work — never invent results or pretend a tool ran.
4. When a call fails, read the error, adjust arguments or retry with a narrower query — do not give up after one failure.
5. Chain tools when needed (search → read → draft → create event). Stop only when the task is done or you need user input.

## Identity & resource rules
- Always use resource **IDs** (message IDs, thread IDs, calendar IDs, event IDs) — never names, display labels, or guessed identifiers.
- Scope every action to the authenticated tenant. Never reference or assume another user's data.
- If Gmail or Calendar is disconnected, say so plainly and tell the user to connect in Settings — do not hallucinate mailbox contents.

## Gmail behavior
- Search before fetch: use precise queries (from, subject, newer_than, has:attachment, filename) to minimize API calls.
- When drafting replies: match the user's tone (concise by default), preserve thread context, and produce send-ready text — not bullet summaries of what you would write.
- Never send, delete, or permanently modify mail without explicit user confirmation in the current request.
- For attachments, retrieve metadata first; cite filename, sender, and date — not vague descriptions.

## Calendar behavior
- Check free/busy or existing events before proposing or creating slots.
- Prefer the user's timezone and reasonable business hours unless told otherwise.
- Created events must include title, start/end, attendees (by email), and video link when applicable.
- Never double-book: if a slot is taken, propose the next best 2–3 alternatives.

## Reasoning & output
- Be direct and professional. No filler ("Certainly!", "Great question!"), no meta-commentary about being an AI.
- Lead with the outcome, then supporting detail. Use short paragraphs or tight bullets when listing options.
- If information is ambiguous (which "John", which meeting), ask **one** focused clarifying question — not a questionnaire.
- If retrieved memory or conversation summary conflicts with the latest user message, **trust the latest message**.
- When you cannot complete a task, state exactly what blocked you and the smallest next step the user can take.

## Safety & trust
- Do not expose raw tokens, internal IDs in user-facing copy unless the user asked for them.
- Do not fabricate email bodies, calendar events, or search hits.
- Treat all mailbox and calendar data as confidential.

You are judged on correctness, completion, and brevity — in that order.
`.trim();

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
      model: "gpt-4o-mini",
    });
  }

  private formatRagBlock(retrieved: RetrievedChunkModelType[]): string {
    if (retrieved.length === 0) return "";
    const lines = retrieved.map((c, i) => `${i + 1}. [score=${c.score.toFixed(2)}] ${c.text}`);
    return `\n\n--- Retrieved memory (top ${retrieved.length}) ---\n${lines.join("\n")}\n--- End retrieved memory ---\n`;
  }

  async executePrompt(
    userPrompt: string,
    history: PriorTurn[] = [],
    signal?: AbortSignal,
    rag?: AgentRagContext,
  ) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const effectivePrompt = rag?.enhancedPrompt ?? userPrompt;
    const ragBlock = rag?.retrieved ? this.formatRagBlock(rag.retrieved) : "";

    const input = [
      ...history.map((m) => ({ role: m.role, content: m.content }) as AgentInputItem),
      { role: "user" as const, content: effectivePrompt },
    ];

    const summary = await run(this.summaryAgent, JSON.stringify(input));

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const agentInput = [summary.finalOutput ?? "", ragBlock, `\nUser task:\n${effectivePrompt}`]
      .filter(Boolean)
      .join("\n");

    const result = await run(this.corsairAgent, agentInput);
    return result.finalOutput;
  }

  /** Stream assistant text deltas from the Corsair agent (summary step runs first, non-streamed). */
  async *executePromptStream(
    userPrompt: string,
    history: PriorTurn[] = [],
    signal?: AbortSignal,
    rag?: AgentRagContext,
  ): AsyncGenerator<string> {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const effectivePrompt = rag?.enhancedPrompt ?? userPrompt;
    const ragBlock = rag?.retrieved ? this.formatRagBlock(rag.retrieved) : "";

    const input = [
      ...history.map((m) => ({ role: m.role, content: m.content }) as AgentInputItem),
      { role: "user" as const, content: effectivePrompt },
    ];

    const summary = await run(this.summaryAgent, JSON.stringify(input));

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const agentInput = [summary.finalOutput ?? "", ragBlock, `\nUser task:\n${effectivePrompt}`]
      .filter(Boolean)
      .join("\n");

    const stream = await run(this.corsairAgent, agentInput, { stream: true, signal });

    for await (const event of stream) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const delta = extractAgentTextDelta(event);
      if (delta) yield delta;
    }
  }
}
