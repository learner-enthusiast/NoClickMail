import { gmailService } from "../../services";
import {
  getMessageInputModel,
  gmailMessageDetailModel,
  listInboxInputModel,
  listInboxOutputModel,
  listSentContactsInputModel,
  listSentContactsOutputModel,
  sendMessageInputModel,
  sendMessageOutputModel,
} from "@repo/services/gmail/model";
import { authenticatedProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";

const TAGS = ["Gmail"];
const getPath = generatePath("/gmail");

export const gmailRouter = router({
  inbox: authenticatedProcedure
    .meta({ openapi: { method: "GET", path: getPath("/inbox"), tags: TAGS } })
    .input(listInboxInputModel)
    .output(listInboxOutputModel)
    .query(({ ctx, input }) => gmailService.listInbox(ctx.user, input)),

  message: authenticatedProcedure
    .meta({ openapi: { method: "GET", path: getPath("/message"), tags: TAGS } })
    .input(getMessageInputModel)
    .output(gmailMessageDetailModel)
    .query(({ ctx, input }) => gmailService.getMessage(ctx.user, input)),

  send: authenticatedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/send"), tags: TAGS } })
    .input(sendMessageInputModel)
    .output(sendMessageOutputModel)
    .mutation(({ ctx, input }) => gmailService.sendMessage(ctx.user, input)), // packages/trpc/server/routes/gmail/route.ts
  sentContacts: authenticatedProcedure
    .meta({ openapi: { method: "GET", path: getPath("/sent-contacts"), tags: TAGS } })
    .input(listSentContactsInputModel)
    .output(listSentContactsOutputModel)
    .query(({ ctx, input }) => gmailService.listSentContacts(ctx.user, input)),
});
