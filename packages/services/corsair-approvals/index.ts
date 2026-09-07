import db, { and, count, desc, eq, gt } from "@repo/database";
import {
  corsairApprovalEvents,
  corsairAgentExecuteAction,
  type CorsairAgentExecutionParameters,
  type CorsairEvent,
  type CorsairEventStatus,
} from "@repo/database/schema";
import type { RagRunResultModelType } from "../rag/pipeline.model";
import { badRequest, notFound, normalizeServiceError } from "../error";
import {
  planCorsairActionFromRag,
  compactPlannedParameters,
  ensureExecutablePlannedAction,
  requiresCorsairApproval,
  type PlannedCorsairAction,
} from "./planner";

export { requiresCorsairApproval } from "./planner";
import { formatApprovalExecutionForChat } from "./format-chat";
import { executeApprovedCorsairEventStream } from "./execute";
import type {
  CorsairApprovalListPaginationInputModelType,
  CorsairApprovalPaginatedListOutputModelType,
} from "./model";

const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

export function formatApprovalCreatedMessage(approvalId: string): string {
  return (
    "I've created an approval request for your requested action.\n\n" +
    `Approval ID: ${approvalId}\n\n` +
    "Review the details and approve or reject using the link below."
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
