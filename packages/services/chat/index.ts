import db, { and, asc, desc, eq } from "@repo/database";
import { chatMessages, chatThreads } from "@repo/database/schema";

// ── Tunables for "careful" context ──
const MAX_CONTEXT_MESSAGES = 20; // hard cap on turns sent to the model
const MAX_CONTEXT_CHARS = 12_000; // ~3–4k tokens budget for history
const MAX_MESSAGE_CHARS = 4_000; // truncate any single huge message

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4); // cheap heuristic; good enough for budgeting
}

class ChatService {
  async createThread(userId: string, title?: string) {
    const [thread] = await db
      .insert(chatThreads)
      .values({ userId, title: title ?? null })
      .returning();
    return thread!;
  }

  async listThreads(userId: string) {
    return db
      .select()
      .from(chatThreads)
      .where(eq(chatThreads.userId, userId))
      .orderBy(desc(chatThreads.updatedAt));
  }

  /** Always scope by BOTH threadId and userId so one user can't read another's thread. */
  async getMessages(userId: string, threadId: string) {
    return db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.threadId, threadId), eq(chatMessages.userId, userId)))
      .orderBy(asc(chatMessages.createdAt));
  }

  async appendMessage(input: {
    userId: string;
    threadId: string;
    role: "user" | "assistant" | "system";
    content: string;
  }) {
    const content = input.content.slice(0, MAX_MESSAGE_CHARS);
    const [msg] = await db
      .insert(chatMessages)
      .values({
        userId: input.userId,
        threadId: input.threadId,
        role: input.role,
        content,
        tokenEstimate: estimateTokens(content),
      })
      .returning();

    await db
      .update(chatThreads)
      .set({ updatedAt: new Date() })
      .where(and(eq(chatThreads.id, input.threadId), eq(chatThreads.userId, input.userId)));

    return msg!;
  }

  /**
   * Build a SAFE, BOUNDED context window for the model.
   * - tenant-isolated (userId + threadId)
   * - newest-first walk, stop at message/char caps
   * - returns chronological order for the model
   */
  async buildContext(userId: string, threadId: string) {
    const rows = await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.threadId, threadId), eq(chatMessages.userId, userId)))
      .orderBy(desc(chatMessages.createdAt))
      .limit(MAX_CONTEXT_MESSAGES);

    const picked: typeof rows = [];
    let charBudget = MAX_CONTEXT_CHARS;

    for (const row of rows) {
      const len = row.content.length;
      if (len > charBudget) break; // stop once we'd blow the budget
      charBudget -= len;
      picked.push(row);
    }

    return picked.reverse().map((m) => ({ role: m.role, content: m.content }));
  }
}

export default ChatService;
