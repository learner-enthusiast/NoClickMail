import type { RouterInputs } from "@repo/trpc/client";
import { pickMutationState, pickQueryState } from "~/lib/constants";
import { trpc } from "~/trpc/client";

export const calendarEvents = (input?: RouterInputs["calendar"]["events"]) =>
  pickQueryState(trpc.calendar.events.useQuery(input ?? {}));

export const calendarEvent = (input: RouterInputs["calendar"]["event"]) =>
  pickQueryState(trpc.calendar.event.useQuery(input));

export const createCalendarEvent = () => pickMutationState(trpc.calendar.createEvent.useMutation());

export const deleteCalendarEvent = () => pickMutationState(trpc.calendar.deleteEvent.useMutation());
