"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, RotateCcw, ShieldAlert, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import {
  approveCorsairApproval,
  corsairApproval,
  rejectCorsairApproval,
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

export function ApprovalDetail({ approvalId }: { approvalId: string }) {
  const utils = trpc.useUtils();
  const { data: initialApproval, isPending, error } = corsairApproval({ approvalId });
  const [approval, setApproval] = useState(initialApproval);
  const [streamingOutput, setStreamingOutput] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const { mutateAsync: approve } = approveCorsairApproval();
  const { runRetry, isRetrying } = useApprovalRetry(approvalId);

  useEffect(() => {
    if (!initialApproval || isRunning || isRetrying) return;
    setApproval(initialApproval);
  }, [
    initialApproval?.id,
    initialApproval?.status,
    initialApproval?.updatedAt,
    initialApproval?.error,
    isRunning,
    isRetrying,
  ]);

  const { mutateAsync: reject, status: rejectStatus } = rejectCorsairApproval();
  const isRejecting = rejectStatus === "pending";

  const current = approval ?? initialApproval;

  async function consumeExecutionStream(
    stream: AsyncIterable<{ type: string; text?: string; output?: string; threadId?: string }>,
  ) {
    let output = "";
    let threadId: string | undefined;

    for await (const event of stream) {
      if (event.type === "delta" && event.text) {
        output += event.text;
        setStreamingOutput(output);
      } else if (event.type === "done") {
        output = event.output ?? output;
        threadId = event.threadId;
      }
    }

    setApproval((prev) =>
      prev
        ? {
            ...prev,
            status: "completed",
            result: { output },
            error: null,
            executedAt: new Date().toISOString(),
          }
        : prev,
    );
    setStreamingOutput(null);

    await utils.corsairApprovals.get.invalidate({ approvalId });
    if (threadId) {
      await utils.agent.threadMessages.invalidate({ threadId });
      await utils.agent.listThreads.invalidate();
    }
    toast.success("Corsair action completed");
  }

  async function runApproval(mode: "approve" | "retry") {
    if (!current || isRunning || isRetrying) return;

    if (mode === "retry") {
      setStreamingOutput("");
      setApproval((prev) => (prev ? { ...prev, status: "executing", error: null } : prev));
      try {
        const result = await runRetry({
          onDelta: (text) => setStreamingOutput((prev) => (prev ?? "") + text),
        });
        if (result) {
          setApproval((prev) =>
            prev
              ? {
                  ...prev,
                  status: "completed",
                  result: { output: result.output },
                  error: null,
                  executedAt: new Date().toISOString(),
                }
              : prev,
          );
          setStreamingOutput(null);
        }
      } catch {
        setStreamingOutput(null);
        await utils.corsairApprovals.get.invalidate({ approvalId });
      }
      return;
    }

    setIsRunning(true);
    setStreamingOutput("");
    setApproval((prev) => (prev ? { ...prev, status: "executing", error: null } : prev));

    try {
      const stream = await approve({ approvalId });
      await consumeExecutionStream(stream);
    } catch (e) {
      console.error(e);
      const message = getErrorMessage(e);
      setApproval((prev) => (prev ? { ...prev, status: "failed", error: message } : prev));
      setStreamingOutput(null);
      await utils.corsairApprovals.get.invalidate({ approvalId });
      toast.error(message);
    } finally {
      setIsRunning(false);
    }
  }

  async function handleReject() {
    try {
      const updated = await reject({ approvalId });
      setApproval(updated);
      await utils.corsairApprovals.get.invalidate({ approvalId });
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
  const isStuckExecuting = current.status === "executing";
  const canRetry = isFailed || isStuckExecuting;
  const isExecuting = isStuckExecuting || isRunning || isRetrying;

  async function handleRetry() {
    await runApproval("retry");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/inbox">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground">Approval ID: {current.id}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <span className="flex size-10 items-center justify-center rounded-full bg-amber-500/15">
              <ShieldAlert className="size-5 text-amber-600" />
            </span>
            Approval request
            {isFailed && (
              <Button
                type="button"
                className="mt-3"
                variant="outline"
                disabled={isRetrying}
                onClick={handleRetry}
              >
                {isRetrying ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                Retry
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">{current.title}</h2>
            <p className="text-muted-foreground">{current.description}</p>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Service</dt>
              <dd className="font-medium text-foreground">{current.service.replace("_", " ")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Action</dt>
              <dd className="font-medium text-foreground">{current.action}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
              <dd className="font-medium capitalize text-foreground">{current.status}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Risk</dt>
              <dd className={cn("font-medium capitalize", RISK_STYLES[current.riskLevel])}>
                {current.riskLevel}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Expires</dt>
              <dd className="font-medium text-foreground">
                {new Date(current.expiresAt).toLocaleString()}
              </dd>
            </div>
            {current.executedAt && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Executed</dt>
                <dd className="font-medium text-foreground">
                  {new Date(current.executedAt).toLocaleString()}
                </dd>
              </div>
            )}
          </dl>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Parameters</p>
            <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-secondary/40 p-4 text-xs text-foreground">
              {JSON.stringify(current.parameters, null, 2)}
            </pre>
          </div>

          {current.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive">{current.error}</p>
            </div>
          )}

          {isFailed && !current.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive">This approval failed.</p>
              <Button
                type="button"
                className="mt-3"
                variant="outline"
                disabled={isRetrying}
                onClick={handleRetry}
              >
                {isRetrying ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                Retry
              </Button>
            </div>
          )}

          {streamingOutput && (
            <div className="rounded-lg bg-secondary px-4 py-3 text-sm text-foreground">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Live output
              </p>
              <p className="whitespace-pre-wrap leading-relaxed">{streamingOutput}</p>
            </div>
          )}

          {current.status === "completed" && current.result != null ? (
            <div className="rounded-lg bg-secondary px-4 py-3 text-sm text-foreground">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Result
              </p>
              <p className="whitespace-pre-wrap leading-relaxed">
                {typeof current.result === "object" &&
                "output" in current.result &&
                typeof current.result.output === "string"
                  ? current.result.output
                  : JSON.stringify(current.result, null, 2)}
              </p>
            </div>
          ) : null}

          {(isPendingApproval || (canRetry && !isFailed)) && (
            <div className="flex flex-wrap gap-3 border-t border-border pt-4">
              {isPendingApproval && (
                <>
                  <Button
                    type="button"
                    disabled={isExecuting || isRejecting}
                    onClick={() => runApproval("approve")}
                  >
                    {isExecuting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    Approve
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
              {isStuckExecuting && (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
