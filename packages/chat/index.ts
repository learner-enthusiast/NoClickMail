import db, { and, asc, desc, eq, lt, or, sql } from "@repo/database";
import { chatMessages, chatThreads } from "@repo/database/schema";
import { notFound } from "@repo/error";

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

  /**
   * Paginate thread messages newest-first internally, returning each page in chronological order.
   * Without a cursor, returns the latest `limit` messages. With a cursor, returns the next
   * `limit` messages that are older than that message.
   */
  async getMessagesPage(
    userId: string,
    threadId: string,
    input: { limit: number; cursor?: string },
  ) {
    await this.getThreadForUser(userId, threadId);

    const filters = [
      eq(chatMessages.threadId, threadId),
      eq(chatMessages.userId, userId),
    ];

    if (input.cursor) {
      const cursorMessage = await this.getMessageForUser(userId, input.cursor);
      if (cursorMessage.threadId !== threadId) {
        throw notFound("Message not found in this thread");
      }

      filters.push(
        or(
          lt(chatMessages.createdAt, cursorMessage.createdAt),
          and(
            eq(chatMessages.createdAt, cursorMessage.createdAt),
            lt(chatMessages.id, cursorMessage.id),
          ),
        )!,
      );
    }

    const rows = await db
      .select()
      .from(chatMessages)
      .where(and(...filters))
      .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
      .limit(input.limit + 1);

    const hasMore = rows.length > input.limit;
    const pageRows = hasMore ? rows.slice(0, input.limit) : rows;
    const messages = [...pageRows].reverse();

    return {
      messages,
      nextCursor: hasMore && messages.length > 0 ? messages[0]!.id : null,
    };
  }

  async appendMessage(input: {
    userId: string;
    threadId: string;
    role: "user" | "assistant" | "system";
    content: string;
    approvalId?: string;
    imageUrl?: string[];
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
        approvalId: input.approvalId ?? null,
        imageUrl: input.imageUrl ?? null,
        tokenEstimate: estimateTokens(content),
      })
      .returning();

    await db
      .update(chatThreads)
      .set({ updatedAt: new Date() })
      .where(and(eq(chatThreads.id, input.threadId), eq(chatThreads.userId, input.userId)));

    return msg!;
  }

  async getMessageForUser(userId: string, messageId: string) {
    const [msg] = await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.id, messageId), eq(chatMessages.userId, userId)))
      .limit(1);
    if (!msg) throw notFound("Message not found");
    return msg;
  }

  /** Append one uploaded attachment URL without clobbering others on the same message. */
  async appendMessageImageUrl(input: {
    userId: string;
    messageId: string;
    imageUrl: string;
  }) {
    const [msg] = await db
      .update(chatMessages)
      .set({
        imageUrl: sql`array_append(coalesce(${chatMessages.imageUrl}, array[]::text[]), ${input.imageUrl}::text)`,
      })
      .where(
        and(eq(chatMessages.id, input.messageId), eq(chatMessages.userId, input.userId)),
      )
      .returning();

    if (!msg) throw notFound("Message not found");
    return msg;
  }
}

export default ChatService;
