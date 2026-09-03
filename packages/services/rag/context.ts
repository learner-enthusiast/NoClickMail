import db, { and, desc, eq } from "@repo/database";
import { chatMessages } from "@repo/database/schema";
import type { ThreadContextMessageModelType } from "./context.model";

const MAX_CONTEXT_MESSAGES = 10;
const MAX_CONTEXT_CHARS = 12_000;

/**
 * Build a bounded thread history window for the agent.
 *
 * Separate from Pinecone/Mem0 retrieval — this is recent in-thread
 * conversation from Postgres, tenant-isolated by userId + threadId.
 */
export async function buildThreadContext(
  userId: string,
  threadId: string,
): Promise<ThreadContextMessageModelType[]> {
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
    if (len > charBudget) break;
    charBudget -= len;
    picked.push(row);
  }

  return picked.reverse().map((m) => ({ role: m.role, content: m.content }));
}
