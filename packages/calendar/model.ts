import { z } from "zod";

/** GET /calendar/events */
export const listEventsInputModel = z.object({
  calendarId: z.string().default("primary"),
  timeMin: z.string().optional().describe("RFC3339 lower bound (inclusive)"),
  timeMax: z.string().optional().describe("RFC3339 upper bound (exclusive)"),
  maxResults: z.number().int().min(1).max(250).default(20),
  pageToken: z.string().optional(),
  q: z.string().optional(),
  singleEvents: z.boolean().default(true),
  orderBy: z.enum(["startTime", "updated"]).default("startTime"),
});
export type ListEventsInputModelType = z.infer<typeof listEventsInputModel>;

export const calendarEventModel = z.object({
  id: z.string(),
  status: z.string().nullable(),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  allDay: z.boolean(),
  htmlLink: z.string().nullable(),
  attendees: z.array(z.string()),
});
export type CalendarEventModelType = z.infer<typeof calendarEventModel>;

export const listEventsOutputModel = z.object({
  events: z.array(calendarEventModel),
  nextPageToken: z.string().optional(),
});
export type ListEventsOutputModelType = z.infer<typeof listEventsOutputModel>;

/** GET /calendar/event */
export const getEventInputModel = z.object({
  calendarId: z.string().default("primary"),
  id: z.string().describe("Calendar event id"),
});
export type GetEventInputModelType = z.infer<typeof getEventInputModel>;

/** POST /calendar/event */
export const createEventInputModel = z.object({
  calendarId: z.string().default("primary"),
  summary: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  start: z.string().describe("RFC3339 dateTime, e.g. 2026-06-20T10:00:00+05:30"),
  end: z.string().describe("RFC3339 dateTime"),
  attendees: z.array(z.email()).optional(),
});
export type CreateEventInputModelType = z.infer<typeof createEventInputModel>;

export const createEventOutputModel = z.object({
  id: z.string(),
  htmlLink: z.string().nullable(),
});
export type CreateEventOutputModelType = z.infer<typeof createEventOutputModel>;

export const deleteEventInputModel = getEventInputModel;
export const deleteEventOutputModel = z.object({ success: z.boolean() });
export type DeleteEventOutputModelType = z.infer<typeof deleteEventOutputModel>;

/** Webhook events (Calendar push) */
export const calendarEventTypeModel = z.enum(["eventCreated", "eventUpdated", "eventDeleted"]);
export const calendarChangeEventModel = z.object({
  type: calendarEventTypeModel,
  calendarId: z.string().optional(),
  eventId: z.string().optional(),
});
export type CalendarChangeEventModelType = z.infer<typeof calendarChangeEventModel>;
