import { calendarService } from "../../services";
import {
  calendarEventModel,
  createEventInputModel,
  createEventOutputModel,
  deleteEventInputModel,
  deleteEventOutputModel,
  getEventInputModel,
  listEventsInputModel,
  listEventsOutputModel,
} from "@repo/services/calendar/model";
import { authenticatedProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";

const TAGS = ["Calendar"];
const getPath = generatePath("/calendar");

export const calendarRouter = router({
  events: authenticatedProcedure
    .meta({ openapi: { method: "GET", path: getPath("/events"), tags: TAGS } })
    .input(listEventsInputModel)
    .output(listEventsOutputModel)
    .query(({ ctx, input }) => calendarService.listEvents(ctx.user, input)),

  event: authenticatedProcedure
    .meta({ openapi: { method: "GET", path: getPath("/event"), tags: TAGS } })
    .input(getEventInputModel)
    .output(calendarEventModel)
    .query(({ ctx, input }) => calendarService.getEvent(ctx.user, input)),

  createEvent: authenticatedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/event"), tags: TAGS } })
    .input(createEventInputModel)
    .output(createEventOutputModel)
    .mutation(({ ctx, input }) => calendarService.createEvent(ctx.user, input)),

  deleteEvent: authenticatedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/event/delete"), tags: TAGS } })
    .input(deleteEventInputModel)
    .output(deleteEventOutputModel)
    .mutation(({ ctx, input }) => calendarService.deleteEvent(ctx.user, input)),
});
