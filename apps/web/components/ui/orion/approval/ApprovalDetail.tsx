"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Paperclip, RotateCcw, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import {
  formatAttachmentSize,
  isEmailApproval,
  parseAttachments,
  parseEmailDraft,
  type EmailDraftFields,
} from "~/lib/approval-email";
import type { RouterOutputs } from "@repo/trpc/client";
import { AGENT_FILE_ACCEPT, readFileAsBase64 } from "~/lib/agent-file";
import {
  approveCorsairApproval,
  rejectCorsairApproval,
  updateCorsairApprovalDraft,
  uploadCorsairApprovalAttachment,
} from "~/hooks/corsair-approvals.ts";
import { useApprovalRetry } from "~/hooks/corsair-approvals.ts/use-approval-execution";
import { trpc } from "~/trpc/client";
import { toast } from "sonner";

const RISK_STYLES = {
  low: "text-emerald-600",
  medium: "text-amber-600",
  high: "text-destructive",
} as const;

function getErrorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && typeof e.message === "string") {
    return e.message;
  }
  return "Something went wrong. Please try again.";
}

const composeInputClassName =
  "rounded-none border-0 border-b border-border bg-transparent px-0 shadow-none focus-visible:ring-0";

const composeTextareaClassName =
  "min-h-[280px] max-h-[min(60vh,720px)] w-full resize-y overflow-y-auto rounded-none border-0 bg-transparent px-0 py-3 text-sm leading-relaxed shadow-none focus-visible:outline-none focus-visible:ring-0";

type ApprovalDetailData = RouterOutputs["corsairApprovals"]["get"];

export function ApprovalDetail({ approvalId }: { approvalId: string }) {
  const utils = trpc.useUtils();
  const [isRunning, setIsRunning] = useState(false);
  const [draft, setDraft] = useState<EmailDraftFields>({ to: "", subject: "", body: "" });

  const {
    data: initialApproval,
    isPending,
    error,
  } = trpc.corsairApprovals.get.useQuery(
    { approvalId },
    {
      refetchInterval: (query) =>
        query.state.data?.status === "executing" && !isRunning ? 2000 : false,
    },
  );

  const [approval, setApproval] = useState<ApprovalDetailData | undefined>(initialApproval);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: approve } = approveCorsairApproval();
  const { runRetry, isRetrying } = useApprovalRetry(approvalId);
  const { mutateAsync: reject, status: rejectStatus } = rejectCorsairApproval();
  const { mutateAsync: updateDraft, status: updateDraftStatus } = updateCorsairApprovalDraft();
  const { mutateAsync: uploadAttachment, status: uploadStatus } = uploadCorsairApprovalAttachment();
  const isRejecting = rejectStatus === "pending";
  const isUploading = uploadStatus === "pending" || updateDraftStatus === "pending";

  useEffect(() => {
    if (!initialApproval || isRunning || isRetrying) return;
    setApproval(initialApproval);
  }, [initialApproval, isRunning, isRetrying]);

  const current = approval ?? initialApproval;

  async function invalidateApprovalLists() {
    await Promise.all([
      utils.corsairApprovals.listPending.invalidate(),
      utils.corsairApprovals.listCompleted.invalidate(),
      utils.corsairApprovals.listRejected.invalidate(),
      utils.corsairApprovals.listFailed.invalidate(),
    ]);
  }

  useEffect(() => {
    if (!current || !isEmailApproval(current)) return;
    setDraft(parseEmailDraft(current.parameters));
  }, [current?.id]);

  async function consumeExecutionStream(
    stream: AsyncIterable<{ type: string; text?: string; output?: string; threadId?: string }>,
  ) {
    let threadId: string | undefined;

    for await (const event of stream) {
      if (event.type === "done") {
        threadId = event.threadId;
      }
    }

    setApproval((prev) =>
      prev
        ? {
            ...prev,
            status: "completed",
            error: null,
            executedAt: new Date().toISOString(),
          }
        : prev,
    );

    await utils.corsairApprovals.get.invalidate({ approvalId });
    await invalidateApprovalLists();
    if (threadId) {
      await utils.agent.threadMessages.invalidate({ threadId });
      await utils.agent.listThreads.invalidate();
    }
    toast.success("Action completed");
  }

  async function handleApprove() {
    if (!current || isRunning || isRetrying) return;

    setIsRunning(true);
    setApproval((prev) => (prev ? { ...prev, status: "executing", error: null } : prev));

    try {
      const draftPayload =
        isEmailApproval(current) && current.status === "pending"
          ? {
              to: draft.to,
              subject: draft.subject,
              body: draft.body,
            }
          : undefined;

      const stream = await approve({ approvalId, draft: draftPayload });
      await consumeExecutionStream(stream);
    } catch (e) {
      console.error(e);
      const message = getErrorMessage(e);
      setApproval((prev) => (prev ? { ...prev, status: "failed", error: message } : prev));
      await utils.corsairApprovals.get.invalidate({ approvalId });
      await invalidateApprovalLists();
      toast.error(message);
    } finally {
      setIsRunning(false);
    }
  }

  async function handleRetry() {
    if (!current || isRunning || isRetrying) return;

    setApproval((prev) => (prev ? { ...prev, status: "executing", error: null } : prev));
    try {
      await runRetry();
      await utils.corsairApprovals.get.invalidate({ approvalId });
      await invalidateApprovalLists();
    } catch {
      await utils.corsairApprovals.get.invalidate({ approvalId });
      await invalidateApprovalLists();
    }
  }

  async function handleReject() {
    try {
      const updated = await reject({ approvalId });
      setApproval(updated);
      await utils.corsairApprovals.get.invalidate({ approvalId });
      await invalidateApprovalLists();
      toast.message("Action rejected");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading approval…</p>;
  }

  if (error || !current) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">Approval not found or you do not have access.</p>
          <Button className="mt-4" variant="outline" asChild>
            <Link href="/dashboard/inbox">
              <ArrowLeft className="size-4" />
              Back to dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isFailed = current.status === "failed";
  const isPendingApproval = current.status === "pending";
  const isExecuting = current.status === "executing" || isRunning || isRetrying;
  const showEmailCompose = isEmailApproval(current);
  const readOnlyDraft = !isPendingApproval;
  const displayDraft = readOnlyDraft ? parseEmailDraft(current.parameters) : draft;
  const attachments = parseAttachments(current.parameters);

  async function handleAddAttachments(fileList: FileList | null) {
    if (!fileList?.length || !isPendingApproval || isExecuting || isRejecting) return;

    try {
      for (const file of Array.from(fileList)) {
        const attached = await readFileAsBase64(file);
        const updated = await uploadAttachment({
          approvalId,
          filename: attached.filename,
          mimeType: attached.mimeType,
          data: attached.data,
          size: attached.size,
        });
        setApproval(updated);
      }
      await utils.corsairApprovals.get.invalidate({ approvalId });
      toast.success(fileList.length === 1 ? "File attached" : `${fileList.length} files attached`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAttachment(attachmentId: string) {
    if (!isPendingApproval || isExecuting || isRejecting) return;

    try {
      const updated = await updateDraft({
        approvalId,
        draft: { removeAttachmentIds: [attachmentId] },
      });
      setApproval(updated);
      await utils.corsairApprovals.get.invalidate({ approvalId });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pb-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/inbox">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
      </div>

      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Service</dt>
          <dd className="font-medium capitalize">{current.service.replace("_", " ")}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Action</dt>
          <dd className="font-medium">{current.action}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
          <dd className="font-medium capitalize">{current.status}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Risk</dt>
          <dd className={cn("font-medium capitalize", RISK_STYLES[current.riskLevel])}>
            {current.riskLevel}
          </dd>
        </div>
      </dl>

      {current.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{current.error}</p>
        </div>
      )}

      {showEmailCompose ? (
        <Card className="overflow-hidden py-0">
          <CardContent className="p-0">
            <div className="divide-y divide-border px-4">
              <div className="flex items-center gap-3 py-2">
                <Label htmlFor="approval-to" className="w-14 shrink-0 text-muted-foreground">
                  To
                </Label>
                {readOnlyDraft ? (
                  <p className="min-h-9 flex-1 py-2 text-sm">{displayDraft.to || "—"}</p>
                ) : (
                  <Input
                    id="approval-to"
                    type="email"
                    value={draft.to}
                    disabled={isExecuting || isRejecting}
                    className={composeInputClassName}
                    placeholder="recipient@example.com"
                    onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
                  />
                )}
              </div>

              <div className="flex items-center gap-3 py-2">
                <Label htmlFor="approval-subject" className="w-14 shrink-0 text-muted-foreground">
                  Subject
                </Label>
                {readOnlyDraft ? (
                  <p className="min-h-9 flex-1 py-2 text-sm font-medium">
                    {displayDraft.subject || "—"}
                  </p>
                ) : (
                  <Input
                    id="approval-subject"
                    value={draft.subject}
                    disabled={isExecuting || isRejecting}
                    className={composeInputClassName}
                    placeholder="Subject"
                    onChange={(e) => setDraft((prev) => ({ ...prev, subject: e.target.value }))}
                  />
                )}
              </div>

              {(attachments.length > 0 || !readOnlyDraft) && (
                <div className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs"
                      >
                        <Paperclip className="size-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{attachment.filename}</span>
                        <span className="shrink-0 text-muted-foreground">
                          ({formatAttachmentSize(attachment.size)})
                        </span>
                        {!readOnlyDraft && (
                          <button
                            type="button"
                            className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                            disabled={isExecuting || isRejecting || isUploading}
                            aria-label={`Remove ${attachment.filename}`}
                            onClick={() => handleRemoveAttachment(attachment.id)}
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </div>
                    ))}

                    {!readOnlyDraft && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept={AGENT_FILE_ACCEPT}
                          className="hidden"
                          disabled={isExecuting || isRejecting || isUploading}
                          onChange={(e) => void handleAddAttachments(e.target.files)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={isExecuting || isRejecting || isUploading}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {isUploading ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Paperclip className="size-3" />
                          )}
                          Attach files
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {readOnlyDraft ? (
              <div className="max-h-[min(60vh,720px)] overflow-y-auto whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed">
                {displayDraft.body || "—"}
              </div>
            ) : (
              <textarea
                id="approval-body"
                value={draft.body}
                disabled={isExecuting || isRejecting}
                className={cn(composeTextareaClassName, "px-4")}
                placeholder="Write your message…"
                onChange={(e) => setDraft((prev) => ({ ...prev, body: e.target.value }))}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Review the action details above, then approve or reject.
          </CardContent>
        </Card>
      )}

      {current.status === "completed" && (
        <p className="text-sm text-emerald-600">This action completed successfully.</p>
      )}

      {isExecuting && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {showEmailCompose ? "Sending email…" : "Running action…"}
        </div>
      )}

      <div className="flex shrink-0 flex-wrap gap-3 pt-2">
        {isPendingApproval && (
          <>
            <Button type="button" disabled={isExecuting || isRejecting} onClick={handleApprove}>
              {isExecuting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {showEmailCompose ? "Send" : "Approve"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isExecuting || isRejecting}
              onClick={handleReject}
            >
              <X className="size-4" />
              Reject
            </Button>
          </>
        )}

        {isFailed && !isExecuting && (
          <Button type="button" variant="outline" disabled={isRetrying} onClick={handleRetry}>
            {isRetrying ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
