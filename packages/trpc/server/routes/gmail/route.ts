import { gmailService } from "../../services";
import {
  deleteMessageInputModel,
  deleteMessageOutputModel,
  getMessageInputModel,
  gmailMessageDetailModel,
  listDraftsInputModel,
  listInboxInputModel,
  listInboxOutputModel,
  listMessagesOutputModel,
  listSentContactsInputModel,
  listSentContactsOutputModel,
  listSentInputModel,
  markMessageReadInputModel,
  markMessageReadOutputModel,
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
  listSentMessages: authenticatedProcedure
    .meta({ openapi: { method: "GET", path: getPath("/sent-messages"), tags: TAGS } })
    .input(listSentInputModel)
    .output(listMessagesOutputModel)
    .query(({ ctx, input }) => gmailService.listSent(ctx.user, input)),

  listDraftMessages: authenticatedProcedure
    .meta({ openapi: { method: "GET", path: getPath("/draft-messages"), tags: TAGS } })
    .input(listDraftsInputModel)
    .output(listMessagesOutputModel)
    .query(({ ctx, input }) => gmailService.listDrafts(ctx.user, input)),

  deleteMessage: authenticatedProcedure
    .meta({ openapi: { method: "DELETE", path: getPath("/message"), tags: TAGS } })
    .input(deleteMessageInputModel)
    .output(deleteMessageOutputModel)
    .mutation(({ ctx, input }) => gmailService.deleteMessage(ctx.user, input)),

  markMessageRead: authenticatedProcedure
    .meta({ openapi: { method: "PATCH", path: getPath("/message/read"), tags: TAGS } })
    .input(markMessageReadInputModel)
    .output(markMessageReadOutputModel)
    .mutation(({ ctx, input }) => gmailService.markMessageRead(ctx.user, input)),
});
