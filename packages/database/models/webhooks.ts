import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// packages/database/models/webhooks.ts
export const calendarWatchChannels = pgTable("calendar_watch_channels", {
  channelId: text("channel_id").primaryKey(),
  resourceId: text("resource_id").notNull(),
  tenantId: text("tenant_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});
