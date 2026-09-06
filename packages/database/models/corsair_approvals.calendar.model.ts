export const googleCalendarCorsairActionValues = [
  "agent_execute",
  "search",
  "read",
  "create",
  "update",
  "delete",
  "check_availability",
] as const;

export type GoogleCalendarCorsairAction = (typeof googleCalendarCorsairActionValues)[number];

export interface GoogleCalendarCorsairParameters {
  calendarId?: string;
  eventId?: string;

  summary?: string;
  description?: string;
  location?: string;

  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };

  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };

  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;

  recurrence?: string[];

  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: "email" | "popup";
      minutes: number;
    }>;
  };

  timeMin?: string;
  timeMax?: string;
  query?: string;
}
