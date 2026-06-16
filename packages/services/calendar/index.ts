import { corsair } from "../corsair";
import type {
  CalendarEventModelType,
  CreateEventInputModelType,
  CreateEventOutputModelType,
  DeleteEventOutputModelType,
  GetEventInputModelType,
  ListEventsInputModelType,
  ListEventsOutputModelType,
} from "./model";

type CalendarDate = { date?: string; dateTime?: string; timeZone?: string };
type CalendarEventRaw = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: CalendarDate;
  end?: CalendarDate;
  attendees?: { email?: string }[];
};

class CalendarService {
  private calendar(tenantId: string) {
    return corsair.withTenant(tenantId).googlecalendar.api;
  }

  async listEvents(
    tenantId: string,
    input: ListEventsInputModelType,
  ): Promise<ListEventsOutputModelType> {
    const res = await this.calendar(tenantId).events.getMany({
      calendarId: input.calendarId,
      timeMin: input.timeMin,
      timeMax: input.timeMax,
      maxResults: input.maxResults,
      pageToken: input.pageToken,
      q: input.q,
      singleEvents: input.singleEvents,
      orderBy: input.orderBy,
    });

    const events = (res.items ?? []).map((e) => this.toEvent(e as CalendarEventRaw));
    return { events, nextPageToken: res.nextPageToken };
  }

  async getEvent(tenantId: string, input: GetEventInputModelType): Promise<CalendarEventModelType> {
    const e = (await this.calendar(tenantId).events.get({
      calendarId: input.calendarId,
      id: input.id,
    })) as CalendarEventRaw;
    return this.toEvent(e);
  }

  async createEvent(
    tenantId: string,
    input: CreateEventInputModelType,
  ): Promise<CreateEventOutputModelType> {
    const e = (await this.calendar(tenantId).events.create({
      calendarId: input.calendarId,
      event: {
        summary: input.summary,
        description: input.description,
        location: input.location,
        start: { dateTime: input.start },
        end: { dateTime: input.end },
        attendees: input.attendees?.map((email) => ({ email })),
      },
    })) as CalendarEventRaw;
    return { id: e.id ?? "", htmlLink: e.htmlLink ?? null };
  }

  async deleteEvent(
    tenantId: string,
    input: GetEventInputModelType,
  ): Promise<DeleteEventOutputModelType> {
    await this.calendar(tenantId).events.delete({
      calendarId: input.calendarId,
      id: input.id,
    });
    return { success: true };
  }

  private toEvent(e: CalendarEventRaw): CalendarEventModelType {
    const allDay = !!e.start?.date && !e.start?.dateTime;
    return {
      id: e.id ?? "",
      status: e.status ?? null,
      summary: e.summary ?? null,
      description: e.description ?? null,
      location: e.location ?? null,
      start: e.start?.dateTime ?? e.start?.date ?? null,
      end: e.end?.dateTime ?? e.end?.date ?? null,
      allDay,
      htmlLink: e.htmlLink ?? null,
      attendees: (e.attendees ?? []).map((a) => a.email ?? "").filter(Boolean),
    };
  }
}

export default CalendarService;
