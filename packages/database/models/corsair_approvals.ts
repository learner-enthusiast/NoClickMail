import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./user";
import type { GmailCorsairAction, GmailCorsairParameters } from "./corsair_approvals.gmail.model";
import type {
  GoogleCalendarCorsairAction,
  GoogleCalendarCorsairParameters,
} from "./corsair_approvals.calendar.model";
import type { CorsairAgentExecutionParameters } from "./corsair_approvals.agent.model";

export * from "./corsair_approvals.gmail.model";
export * from "./corsair_approvals.calendar.model";
export * from "./corsair_approvals.agent.model";

export const corsairEventServiceValues = ["gmail", "google_calendar"] as const;
export type CorsairEventService = (typeof corsairEventServiceValues)[number];

export const corsairEventStatusValues = [
  "pending",
  "approved",
  "rejected",
  "expired",
  "executing",
  "completed",
  "failed",
] as const;
export type CorsairEventStatus = (typeof corsairEventStatusValues)[number];

export const corsairEventRiskLevelValues = ["low", "medium", "high"] as const;
export type CorsairEventRiskLevel = (typeof corsairEventRiskLevelValues)[number];

export const corsairApprovalEvents = pgTable(
  "corsair_approval_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    service: text("service", { enum: corsairEventServiceValues }).notNull(),
    action: text("action").notNull(),

    status: text("status", { enum: corsairEventStatusValues }).notNull().default("pending"),
    riskLevel: text("risk_level", { enum: corsairEventRiskLevelValues }).notNull(),

    title: text("title").notNull(),
    description: text("description").notNull(),

    parameters: jsonb("parameters").notNull().default({}),
    requiresApproval: boolean("requires_approval").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    approvedAt: timestamp("approved_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),

    result: jsonb("result"),
    error: text("error"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("corsair_approval_events_user_status_idx").on(t.userId, t.status),
    index("corsair_approval_events_expires_at_idx").on(t.expiresAt),
  ],
);

export type CorsairEvent = typeof corsairApprovalEvents.$inferSelect;
export type InsertCorsairEvent = typeof corsairApprovalEvents.$inferInsert;

type CorsairEventBase = Omit<CorsairEvent, "service" | "action" | "parameters">;

export type CorsairGmailApprovalEvent = CorsairEventBase & {
  service: "gmail";
  action: GmailCorsairAction;
  parameters: GmailCorsairParameters | CorsairAgentExecutionParameters;
};

export type CorsairGoogleCalendarApprovalEvent = CorsairEventBase & {
  service: "google_calendar";
  action: GoogleCalendarCorsairAction;
  parameters: GoogleCalendarCorsairParameters | CorsairAgentExecutionParameters;
};

export type CorsairApprovalEvent = CorsairGmailApprovalEvent | CorsairGoogleCalendarApprovalEvent;

export type InsertCorsairGmailApprovalEvent = Omit<InsertCorsairEvent, "service" | "action" | "parameters"> & {
  service: "gmail";
  action: GmailCorsairAction;
  parameters: GmailCorsairParameters;
};

export type InsertCorsairGoogleCalendarApprovalEvent = Omit<
  InsertCorsairEvent,
  "service" | "action" | "parameters"
> & {
  service: "google_calendar";
  action: GoogleCalendarCorsairAction;
  parameters: GoogleCalendarCorsairParameters;
};

export type InsertCorsairApprovalEvent =
  | InsertCorsairGmailApprovalEvent
  | InsertCorsairGoogleCalendarApprovalEvent;
