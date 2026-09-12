import db, { and, count, desc, eq, gt } from "@repo/database";
import {
  corsairApprovalEvents,
  corsairAgentExecuteAction,
  type CorsairAgentExecutionParameters,
  type CorsairEvent,
  type CorsairEventStatus,
  type GmailAttachmentRef,
} from "@repo/database/schema";
import type { RagRunResultModelType } from "@repo/rag-models/pipeline.model";
import { badRequest, notFound, normalizeServiceError } from "@repo/error";
import {
  planCorsairActionFromRag,
  compactPlannedParameters,
  ensureExecutablePlannedAction,
  extractGmailSendFields,
  requiresCorsairApproval,
  type PlannedCorsairAction,
} from "./planner";
import {
  collectSendRecipients,
  resolvePerRecipientSendDrafts,
  shouldSplitGmailSendApprovals,
  splitPlannedSendByRecipient,
} from "./split-send";

export { requiresCorsairApproval } from "./planner";
export {
  collectSendRecipients,
  shouldSplitGmailSendApprovals,
  splitPlannedSendByRecipient,
  resolvePerRecipientSendDrafts,
  wantsIndividualSends,
} from "./split-send";
import { formatApprovalExecutionForChat } from "./format-chat";
import { executeApprovedCorsairEventStream } from "./execute";
import {
  formatApprovalUpdatedMessage,
  formatMultipleApprovalsUpdatedMessage,
  planApprovalEditsFromChat,
  resolveApprovalsToEdit,
} from "./edit-from-chat";
import type { ThreadContextMessageModelType } from "@repo/rag-models/context.model";
import type {
  CorsairApprovalListPaginationInputModelType,
  CorsairApprovalPaginatedListOutputModelType,
  CorsairApprovalDraftEditModelType,
} from "./model";
import {
  assertAttachmentSizeLimits,
  copyAttachmentToApproval,
  mergeAttachmentEdits,
  normalizeAttachments,
  uploadApprovalAttachment,
  uploadChatFileToApproval,
} from "./attachments";

const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

export function formatApprovalCreatedMessage(
  approval: string | Array<{ id: string; to?: string }>,
): string {
  if (typeof approval === "string") {
    return (
      "I've created an approval request for your requested action.\n\n" +
      `[Review approval](/approval/${approval})\n\n` +
      "Review the details and approve or reject before sending."
    );
  }

  if (approval.length === 1) {
    return formatApprovalCreatedMessage(approval[0]!.id);
  }

  const lines = approval.map((item, index) => {
    const label = item.to ? `Send to ${item.to}` : `Email ${index + 1}`;
    return `${index + 1}. ${label} — [Review approval](/approval/${item.id})`;
  });

  return (
    `I've created ${approval.length} separate approval requests — one email per recipient.\n\n` +
    `${lines.join("\n")}\n\n` +
    "Review and approve each email individually before sending."
  );
}

export { formatApprovalExecutionForChat } from "./format-chat";

function chatContextFromParameters(parameters: CorsairEvent["parameters"]): {
  threadId: string;
  messageId?: string;
  prompt?: string;
} {
  const params = parameters as Record<string, unknown>;
  const threadId = params.threadId;
  if (typeof threadId !== "string") {
    throw badRequest("Approval is missing threadId");
  }
  return {
    threadId,
    messageId: typeof params.messageId === "string" ? params.messageId : undefined,
    prompt: typeof params.prompt === "string" ? params.prompt : undefined,
  };
}

class CorsairApprovalService {
  serialize(row: CorsairEvent) {
    return {
      id: row.id,
      userId: row.userId,
      service: row.service,
      action: row.action,
      status: row.status,
      riskLevel: row.riskLevel,
      title: row.title,
      description: row.description,
      parameters: row.parameters as Record<string, unknown>,
      requiresApproval: row.requiresApproval,
      expiresAt: row.expiresAt.toISOString(),
      approvedAt: row.approvedAt?.toISOString() ?? null,
      executedAt: row.executedAt?.toISOString() ?? null,
      result: row.result,
      error: row.error,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getForUser(userId: string, approvalId: string) {
    const [row] = await db
      .select()
      .from(corsairApprovalEvents)
      .where(
        and(eq(corsairApprovalEvents.id, approvalId), eq(corsairApprovalEvents.userId, userId)),
      )
      .limit(1);
    if (!row) throw notFound("Approval not found");
    return row;
  }

  async listForUser(userId: string, statuses?: CorsairEvent["status"][]) {
    const rows = await db
      .select()
      .from(corsairApprovalEvents)
      .where(
        and(
          eq(corsairApprovalEvents.userId, userId),
          gt(corsairApprovalEvents.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(corsairApprovalEvents.createdAt));

    if (!statuses?.length) return rows;
    return rows.filter((row) => statuses.includes(row.status));
  }

  private buildPaginationMeta(
    page: number,
    pageSize: number,
    totalCount: number,
  ): CorsairApprovalPaginatedListOutputModelType["pagination"] {
    const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
    return {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && totalPages > 0,
    };
  }

  async listPaginatedByStatusForUser(
    userId: string,
    status: CorsairEventStatus,
    input: CorsairApprovalListPaginationInputModelType,
  ): Promise<CorsairApprovalPaginatedListOutputModelType> {
    const page = input.page;
    const pageSize = input.pageSize;
    const whereClause = and(
      eq(corsairApprovalEvents.userId, userId),
      eq(corsairApprovalEvents.status, status),
    );

    const [countRow] = await db
      .select({ totalCount: count() })
      .from(corsairApprovalEvents)
      .where(whereClause);

    const totalCount = countRow?.totalCount ?? 0;

    const rows = await db
      .select()
      .from(corsairApprovalEvents)
      .where(whereClause)
      .orderBy(desc(corsairApprovalEvents.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      items: rows.map((row) => this.serialize(row)),
      pagination: this.buildPaginationMeta(page, pageSize, totalCount),
    };
  }

  listCompletedForUser(userId: string, input: CorsairApprovalListPaginationInputModelType) {
    return this.listPaginatedByStatusForUser(userId, "completed", input);
  }

  async listPendingForUser(
    userId: string,
    input: CorsairApprovalListPaginationInputModelType,
  ): Promise<CorsairApprovalPaginatedListOutputModelType> {
    const page = input.page;
    const pageSize = input.pageSize;
    const whereClause = and(
      eq(corsairApprovalEvents.userId, userId),
      eq(corsairApprovalEvents.status, "pending"),
      gt(corsairApprovalEvents.expiresAt, new Date()),
    );

    const [countRow] = await db
      .select({ totalCount: count() })
      .from(corsairApprovalEvents)
      .where(whereClause);

    const totalCount = countRow?.totalCount ?? 0;

    const rows = await db
      .select()
      .from(corsairApprovalEvents)
      .where(whereClause)
      .orderBy(desc(corsairApprovalEvents.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      items: rows.map((row) => this.serialize(row)),
      pagination: this.buildPaginationMeta(page, pageSize, totalCount),
    };
  }

  listRejectedForUser(userId: string, input: CorsairApprovalListPaginationInputModelType) {
    return this.listPaginatedByStatusForUser(userId, "rejected", input);
  }

  listExpiredForUser(userId: string, input: CorsairApprovalListPaginationInputModelType) {
    return this.listPaginatedByStatusForUser(userId, "expired", input);
  }

  listFailedForUser(userId: string, input: CorsairApprovalListPaginationInputModelType) {
    return this.listPaginatedByStatusForUser(userId, "failed", input);
  }

  async listPendingForThread(userId: string, threadId: string) {
    const rows = await db
      .select()
      .from(corsairApprovalEvents)
      .where(
        and(
          eq(corsairApprovalEvents.userId, userId),
          eq(corsairApprovalEvents.status, "pending"),
          gt(corsairApprovalEvents.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(corsairApprovalEvents.createdAt));

    return rows.filter((row) => {
      const params = row.parameters as Record<string, unknown>;
      return params.threadId === threadId;
    });
  }

  async editPendingApprovalFromChat(input: {
    userId: string;
    threadId: string;
    prompt: string;
    history: ThreadContextMessageModelType[];
    signal?: AbortSignal;
  }): Promise<{ output: string; approvalId?: string }> {
    const pendingInThread = await this.listPendingForThread(input.userId, input.threadId);
    const gmailPending = pendingInThread.filter(
      (row) => row.service === "gmail" && row.action === "send",
    );

    const resolved = resolveApprovalsToEdit({
      prompt: input.prompt,
      history: input.history,
      pendingInThread: gmailPending.length > 0 ? gmailPending : pendingInThread,
    });

    if ("clarify" in resolved) {
      return { output: resolved.clarify };
    }

    const updated: Array<{ id: string; to?: string; subject?: string }> = [];

    for (const approval of resolved.approvals) {
      const fields = extractGmailSendFields(approval.parameters as Record<string, unknown>);
      if (!fields) {
        return {
          output:
            "That approval isn't a Gmail send draft I can edit from chat yet. Open it on the approval page to review.",
        };
      }

      const draft = await planApprovalEditsFromChat({
        prompt: input.prompt,
        current: fields,
        signal: input.signal,
      });

      if (!draft.to && !draft.subject && !draft.body) {
        return {
          output:
            "I couldn't tell what to change. Try: \"edit the approval to add my address as … and email as …\" or mention the recipient/subject.",
        };
      }

      const row = await this.applyDraftEdits(input.userId, approval.id, draft);
      const updatedFields = extractGmailSendFields(row.parameters as Record<string, unknown>);
      updated.push({
        id: row.id,
        to: updatedFields?.to,
        subject: updatedFields?.subject,
      });
    }

    const output =
      updated.length === 1
        ? formatApprovalUpdatedMessage(updated[0]!)
        : formatMultipleApprovalsUpdatedMessage(updated);

    return { output, approvalId: updated[0]?.id };
  }

  async planFromRag(input: {
    prompt: string;
    rag: RagRunResultModelType;
    signal?: AbortSignal;
  }) {
    const rawPlanned = await planCorsairActionFromRag(input);
    const planned = ensureExecutablePlannedAction(rawPlanned);
    return {
      rawPlanned,
      planned,
      requiresApproval: requiresCorsairApproval(planned, rawPlanned),
    };
  }

  buildParametersForRag(input: {
    prompt: string;
    threadId: string;
    messageId: string;
    rag: RagRunResultModelType;
    planned: PlannedCorsairAction;
  }) {
    return this.buildApprovalParameters(input);
  }

  private buildApprovalParameters(input: {
    prompt: string;
    threadId: string;
    messageId: string;
    rag: RagRunResultModelType;
    planned: PlannedCorsairAction;
  }) {
    const agentContext: CorsairAgentExecutionParameters = {
      prompt: input.prompt,
      enhancedPrompt: input.rag.enhancedPrompt,
      threadId: input.threadId,
      messageId: input.messageId,
      history: input.rag.history,
      retrieved: input.rag.retrieved,
    };

    return input.planned.action === corsairAgentExecuteAction
      ? agentContext
      : {
          ...compactPlannedParameters(input.planned.parameters),
          threadId: input.threadId,
          messageId: input.messageId,
          prompt: input.prompt,
          agentContext,
        };
  }

  async createFromPlanned(input: {
    userId: string;
    planned: PlannedCorsairAction;
    parameters: CorsairEvent["parameters"];
  }) {
    const [row] = await db
      .insert(corsairApprovalEvents)
      .values({
        userId: input.userId,
        service: input.planned.service,
        action: input.planned.action,
        status: "pending",
        riskLevel: input.planned.riskLevel,
        title: input.planned.title,
        description: input.planned.description,
        parameters: input.parameters,
        requiresApproval: true,
        expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
      })
      .returning();

    return row!;
  }

  getSendRecipientsForSplit(prompt: string, planned: PlannedCorsairAction): string[] {
    const compact = compactPlannedParameters(planned.parameters);
    return collectSendRecipients(prompt, compact);
  }

  shouldSplitSendApprovals(planned: PlannedCorsairAction, prompt: string): boolean {
    return shouldSplitGmailSendApprovals(planned, prompt);
  }

  async createSplitSendApprovalsFromPlanned(input: {
    userId: string;
    prompt: string;
    planned: PlannedCorsairAction;
    baseParameters: CorsairEvent["parameters"];
    recipients: string[];
    emailDraft?: string;
  }) {
    const compact = compactPlannedParameters(input.planned.parameters);
    const fallbackSubject =
      typeof compact.subject === "string" ? compact.subject : undefined;
    const fallbackBody = typeof compact.body === "string" ? compact.body : undefined;

    const drafts = resolvePerRecipientSendDrafts({
      prompt: input.prompt,
      recipients: input.recipients,
      emailDraft: input.emailDraft,
      fallbackSubject,
      fallbackBody,
    });

    const plannedActions = splitPlannedSendByRecipient(input.planned, drafts);
    const baseParams = input.baseParameters as Record<string, unknown>;
    const baseAttachments = normalizeAttachments(baseParams);

    const approvals = [];
    for (const perRecipientPlanned of plannedActions) {
      const recipient = perRecipientPlanned.parameters.to?.[0];
      let parameters: Record<string, unknown> = {
        ...baseParams,
        ...compactPlannedParameters(perRecipientPlanned.parameters),
        to: recipient ? [recipient] : [],
        subject: perRecipientPlanned.parameters.subject,
        body: perRecipientPlanned.parameters.body,
      };

      const approval = await this.createFromPlanned({
        userId: input.userId,
        planned: perRecipientPlanned,
        parameters,
      });

      if (baseAttachments.length > 0) {
        const copied = await Promise.all(
          baseAttachments.map((source) =>
            copyAttachmentToApproval({
              userId: input.userId,
              approvalId: approval.id,
              source,
            }),
          ),
        );
        parameters = { ...parameters, attachments: copied };
        const [updated] = await db
          .update(corsairApprovalEvents)
          .set({ parameters, updatedAt: new Date() })
          .where(eq(corsairApprovalEvents.id, approval.id))
          .returning();
        approvals.push(updated ?? approval);
      } else {
        approvals.push(approval);
      }
    }

    return approvals;
  }

  /** Copy every chat attachment onto each approval, replacing any existing attachment set. */
  async syncChatFilesToApprovals(input: {
    userId: string;
    approvals: CorsairEvent[];
    attachedFiles: Array<{ filename: string; mimeType?: string; data: string }>;
  }) {
    if (input.attachedFiles.length === 0) return;

    const decoded = input.attachedFiles.map((file) => ({
      filename: file.filename,
      mimeType: file.mimeType,
      body: Buffer.from(file.data, "base64"),
    }));

    for (const approval of input.approvals) {
      const refs: GmailAttachmentRef[] = [];

      for (const file of decoded) {
        refs.push(
          await uploadChatFileToApproval({
            userId: input.userId,
            approvalId: approval.id,
            filename: file.filename,
            mimeType: file.mimeType,
            body: file.body,
          }),
        );
      }

      assertAttachmentSizeLimits(refs);

      const parameters = {
        ...(approval.parameters as Record<string, unknown>),
        attachments: refs,
      };

      await db
        .update(corsairApprovalEvents)
        .set({ parameters, updatedAt: new Date() })
        .where(eq(corsairApprovalEvents.id, approval.id));
    }
  }

  async syncChatFilesToApproval(input: {
    userId: string;
    approvalId: string;
    attachedFiles: Array<{ filename: string; mimeType?: string; data: string }>;
  }) {
    const approval = await this.getForUser(input.userId, input.approvalId);
    await this.syncChatFilesToApprovals({
      userId: input.userId,
      approvals: [approval],
      attachedFiles: input.attachedFiles,
    });
    return this.getForUser(input.userId, input.approvalId);
  }

  async uploadAttachment(
    userId: string,
    input: {
      approvalId: string;
      filename: string;
      mimeType?: string;
      data: string;
    },
  ) {
    const approval = await this.getForUser(userId, input.approvalId);
    if (approval.status !== "pending") {
      throw badRequest(`Cannot attach files to approval in status "${approval.status}"`);
    }
    if (approval.service !== "gmail" || approval.action !== "send") {
      throw badRequest("Attachments are only supported for Gmail send approvals.");
    }

    const body = Buffer.from(input.data, "base64");
    const existing = normalizeAttachments(approval.parameters as Record<string, unknown>);
    assertAttachmentSizeLimits(existing, body.length);

    const ref = await uploadApprovalAttachment({
      userId,
      approvalId: input.approvalId,
      filename: input.filename,
      mimeType: input.mimeType,
      body,
    });

    const parameters = {
      ...(approval.parameters as Record<string, unknown>),
      attachments: [...existing, ref],
    };

    const [row] = await db
      .update(corsairApprovalEvents)
      .set({ parameters, updatedAt: new Date() })
      .where(eq(corsairApprovalEvents.id, input.approvalId))
      .returning();

    return row!;
  }

  async createFromRag(input: {
    userId: string;
    prompt: string;
    threadId: string;
    messageId: string;
    rag: RagRunResultModelType;
    signal?: AbortSignal;
  }) {
    const { planned } = await this.planFromRag({
      prompt: input.prompt,
      rag: input.rag,
      signal: input.signal,
    });

    const parameters = this.buildApprovalParameters({
      prompt: input.prompt,
      threadId: input.threadId,
      messageId: input.messageId,
      rag: input.rag,
      planned,
    });

    return this.createFromPlanned({
      userId: input.userId,
      planned,
      parameters,
    });
  }

  private async assertExecutable(approval: CorsairEvent) {
    if (
      approval.status !== "pending" &&
      approval.status !== "failed" &&
      approval.status !== "executing"
    ) {
      throw badRequest(`Cannot run approval in status "${approval.status}"`);
    }
    if (approval.status === "pending" && approval.expiresAt < new Date()) {
      await db
        .update(corsairApprovalEvents)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(corsairApprovalEvents.id, approval.id));
      throw badRequest("Approval has expired");
    }
  }

  async applyDraftEdits(
    userId: string,
    approvalId: string,
    draft: CorsairApprovalDraftEditModelType,
  ) {
    const approval = await this.getForUser(userId, approvalId);
    if (approval.status !== "pending") {
      throw badRequest(`Cannot edit approval in status "${approval.status}"`);
    }

    const parameters = { ...(approval.parameters as Record<string, unknown>) };
    const hasDraftField =
      draft.to !== undefined ||
      draft.subject !== undefined ||
      draft.body !== undefined ||
      draft.attachments !== undefined ||
      (draft.removeAttachmentIds?.length ?? 0) > 0;
    if (!hasDraftField) return approval;

    if (draft.to !== undefined) {
      const trimmed = draft.to.trim();
      parameters.to = trimmed ? [trimmed] : [];
    }
    if (draft.subject !== undefined) {
      parameters.subject = draft.subject;
    }
    if (draft.body !== undefined) {
      parameters.body = draft.body;
    }

    if (draft.attachments !== undefined || (draft.removeAttachmentIds?.length ?? 0) > 0) {
      const existing = normalizeAttachments(parameters);
      parameters.attachments = mergeAttachmentEdits(existing, draft);
    }

    const sendFields = extractGmailSendFields(parameters);
    if (!sendFields) {
      throw badRequest("Email requires recipient, subject, and body before sending.");
    }

    const [row] = await db
      .update(corsairApprovalEvents)
      .set({ parameters, updatedAt: new Date() })
      .where(eq(corsairApprovalEvents.id, approvalId))
      .returning();

    return row!;
  }

  async reject(userId: string, approvalId: string) {
    const approval = await this.getForUser(userId, approvalId);
    if (approval.status !== "pending") {
      throw badRequest(`Cannot reject approval in status "${approval.status}"`);
    }

    const [row] = await db
      .update(corsairApprovalEvents)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(corsairApprovalEvents.id, approvalId))
      .returning();

    return row!;
  }

  async *executeStream(
    userId: string,
    approvalId: string,
    signal?: AbortSignal,
  ): AsyncGenerator<
    { type: "delta"; text: string } | { type: "done"; output: string; threadId: string }
  > {
    const approval = await this.getForUser(userId, approvalId);
    await this.assertExecutable(approval);

    const chatContext = chatContextFromParameters(approval.parameters);

    await db
      .update(corsairApprovalEvents)
      .set({
        status: "executing",
        approvedAt: approval.approvedAt ?? new Date(),
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(corsairApprovalEvents.id, approvalId));

    let rawOutput = "";

    try {
      for await (const event of executeApprovedCorsairEventStream(userId, approval, signal)) {
        if (event.type === "delta") {
          rawOutput += event.text;
          if (approval.action === corsairAgentExecuteAction) {
            yield { type: "delta", text: event.text };
          }
        } else {
          rawOutput = event.output;
          const chatMessage = formatApprovalExecutionForChat(approval, rawOutput);
          if (approval.action !== corsairAgentExecuteAction) {
            yield { type: "delta", text: chatMessage };
          }
          await db
            .update(corsairApprovalEvents)
            .set({
              status: "completed",
              executedAt: new Date(),
              result: { output: rawOutput },
              error: null,
              updatedAt: new Date(),
            })
            .where(eq(corsairApprovalEvents.id, approvalId));

          yield { type: "done", output: chatMessage, threadId: chatContext.threadId };
          return;
        }
      }
    } catch (e) {
      const normalized = normalizeServiceError(e);
      const message = normalized.message;
      await db
        .update(corsairApprovalEvents)
        .set({
          status: "failed",
          executedAt: new Date(),
          error: message,
          updatedAt: new Date(),
        })
        .where(eq(corsairApprovalEvents.id, approvalId));
      throw normalized;
    }
  }
}

export default CorsairApprovalService;
