import { pgTable, uuid, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { usersTable } from "./user";

export const chatThreads = pgTable("chat_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    content: text("content").notNull(),
    // rough token estimate, stored so we can budget context without re-counting
    tokenEstimate: integer("token_estimate").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byThread: index("chat_messages_thread_created_idx").on(t.threadId, t.createdAt),
  }),
);

export type SelectChatThread = typeof chatThreads.$inferSelect;
export type SelectChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
