import db, { and, asc, desc, eq } from "@repo/database";
import { chatMessages, chatThreads } from "@repo/database/schema";
import { notFound } from "../error";

// ── Tunables for message storage ──
const MAX_MESSAGE_CHARS = 4_000; // truncate any single huge message

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4); // cheap heuristic; good enough for budgeting
}

class ChatService {
  async getThreadForUser(userId: string, threadId: string) {
    const [thread] = await db
      .select()
      .from(chatThreads)
      .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)))
      .limit(1);
    if (!thread) throw notFound("Thread not found");
    return thread;
  }
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
    await this.getThreadForUser(input.userId, input.threadId);
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
}

export default ChatService;
