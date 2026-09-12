import z from "zod";
import { TRPCError } from "@trpc/server";
import { agentProcedure, authenticatedProcedure, router } from "../../trpc";
import { chatService, corsairApprovalService, ragService } from "../../services";
import { toTRPCError } from "../../map-error";
import {
  corsairApprovalApproveInputModel,
  corsairApprovalListPaginationInputModel,
  corsairApprovalModel,
  corsairApprovalPaginatedListOutputModel,
  corsairApprovalUpdateDraftInputModel,
  corsairApprovalUploadAttachmentInputModel,
} from "@repo/services/model";

function assertNotAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new TRPCError({ code: "CLIENT_CLOSED_REQUEST", message: "Request aborted" });
  }
}

/**
 * After approval execution: append result to Postgres and update Mem0 long-term memory.
 */
async function appendApprovalResultAndUpdateMem0(
  userId: string,
  approvalId: string,
  threadId: string,
  output: string,
) {
  const approval = await corsairApprovalService.getForUser(userId, approvalId);
  const params = approval.parameters as { prompt?: string; messageId?: string };
  const userContent = typeof params.prompt === "string" ? params.prompt : approval.title;

  await chatService.appendMessage({
    userId,
    threadId,
    role: "assistant",
    content: output,
  });

  if (params.messageId) {
    await ragService.saveTurnToLongTermMemoryIfEnabled({
      userId,
      threadId,
      messageId: params.messageId,
      userContent,
      assistantContent: output,
    });

    // await ragService.indexCompletedTurnForRetrieval({
    //   userId,
    //   threadId,
    //   userMessageId: params.messageId,
    //   assistantMessageId: assistantMessage.id,
    //   userContent,
    //   assistantContent: output,
    // });
  }
}

export const corsairApprovalsRouter = router({
  list: authenticatedProcedure
    .input(
      z
        .object({
          statuses: z
            .array(
              z.enum([
                "pending",
                "failed",
                "executing",
                "completed",
                "rejected",
                "expired",
                "approved",
              ]),
            )
            .optional(),
        })
        .optional(),
    )
    .output(z.array(corsairApprovalModel))
    .query(async ({ ctx, input }) => {
      const rows = await corsairApprovalService.listForUser(ctx.user, input?.statuses);
      return rows.map((row) => corsairApprovalService.serialize(row));
    }),

  get: authenticatedProcedure
    .input(z.object({ approvalId: z.uuid() }))
    .output(corsairApprovalModel)
    .query(async ({ ctx, input }) => {
      const row = await corsairApprovalService.getForUser(ctx.user, input.approvalId);
      return corsairApprovalService.serialize(row);
    }),

  listCompleted: authenticatedProcedure
    .input(corsairApprovalListPaginationInputModel)
    .output(corsairApprovalPaginatedListOutputModel)
    .query(({ ctx, input }) => corsairApprovalService.listCompletedForUser(ctx.user, input)),

  listPending: authenticatedProcedure
    .input(corsairApprovalListPaginationInputModel)
    .output(corsairApprovalPaginatedListOutputModel)
    .query(({ ctx, input }) => corsairApprovalService.listPendingForUser(ctx.user, input)),

  listRejected: authenticatedProcedure
    .input(corsairApprovalListPaginationInputModel)
    .output(corsairApprovalPaginatedListOutputModel)
    .query(({ ctx, input }) => corsairApprovalService.listRejectedForUser(ctx.user, input)),

  listExpired: authenticatedProcedure
    .input(corsairApprovalListPaginationInputModel)
    .output(corsairApprovalPaginatedListOutputModel)
    .query(({ ctx, input }) => corsairApprovalService.listExpiredForUser(ctx.user, input)),

  listFailed: authenticatedProcedure
    .input(corsairApprovalListPaginationInputModel)
    .output(corsairApprovalPaginatedListOutputModel)
    .query(({ ctx, input }) => corsairApprovalService.listFailedForUser(ctx.user, input)),

  reject: agentProcedure
    .input(z.object({ approvalId: z.uuid() }))
    .output(corsairApprovalModel)
    .mutation(async ({ ctx, input }) => {
      const row = await corsairApprovalService.reject(ctx.user, input.approvalId);
      return corsairApprovalService.serialize(row);
    }),

  updateDraft: agentProcedure
    .input(corsairApprovalUpdateDraftInputModel)
    .output(corsairApprovalModel)
    .mutation(async ({ ctx, input }) => {
      const row = await corsairApprovalService.applyDraftEdits(
        ctx.user,
        input.approvalId,
        input.draft,
      );
      return corsairApprovalService.serialize(row);
    }),

  uploadAttachment: agentProcedure
    .input(corsairApprovalUploadAttachmentInputModel)
    .output(corsairApprovalModel)
    .mutation(async ({ ctx, input }) => {
      const row = await corsairApprovalService.uploadAttachment(ctx.user, input);
      return corsairApprovalService.serialize(row);
    }),

  approve: agentProcedure.input(corsairApprovalApproveInputModel).mutation(async function* ({
    ctx,
    input,
  }) {
    try {
      assertNotAborted(ctx.signal);

      if (input.draft) {
        await corsairApprovalService.applyDraftEdits(ctx.user, input.approvalId, input.draft);
      }

      for await (const event of corsairApprovalService.executeStream(
        ctx.user,
        input.approvalId,
        ctx.signal,
      )) {
        if (event.type === "delta") {
          yield { type: "delta" as const, text: event.text };
        } else {
          await appendApprovalResultAndUpdateMem0(
            ctx.user,
            input.approvalId,
            event.threadId,
            event.output,
          );
          yield {
            type: "done" as const,
            approvalId: input.approvalId,
            threadId: event.threadId,
            output: event.output,
          };
        }
      }
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  retry: agentProcedure.input(z.object({ approvalId: z.uuid() })).mutation(async function* ({
    ctx,
    input,
  }) {
    try {
      assertNotAborted(ctx.signal);

      const approval = await corsairApprovalService.getForUser(ctx.user, input.approvalId);
      if (approval.status !== "failed" && approval.status !== "executing") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Only failed or stuck approvals can be retried (current: ${approval.status})`,
        });
      }

      for await (const event of corsairApprovalService.executeStream(
        ctx.user,
        input.approvalId,
        ctx.signal,
      )) {
        if (event.type === "delta") {
          yield { type: "delta" as const, text: event.text };
        } else {
          await appendApprovalResultAndUpdateMem0(
            ctx.user,
            input.approvalId,
            event.threadId,
            event.output,
          );
          yield {
            type: "done" as const,
            approvalId: input.approvalId,
            threadId: event.threadId,
            output: event.output,
          };
        }
      }
    } catch (err) {
      throw toTRPCError(err);
    }
  }),
});
