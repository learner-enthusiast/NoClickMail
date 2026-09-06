"use client";

import { useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Hourglass,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import {
  corsairCompletedApprovals,
  corsairExpiredApprovals,
  corsairFailedApprovals,
  corsairPendingApprovals,
  corsairRejectedApprovals,
} from "~/hooks/corsair-approvals.ts";
import { useApprovalRetry } from "~/hooks/corsair-approvals.ts/use-approval-execution";
import type { RouterOutputs } from "@repo/trpc/client";

const PAGE_SIZE = 20;

type ApprovalStatusTab = "pending" | "completed" | "rejected" | "expired" | "failed";

type ApprovalItem = RouterOutputs["corsairApprovals"]["listCompleted"]["items"][number];

const STATUS_TABS: {
  id: ApprovalStatusTab;
  label: string;
  icon: typeof CheckCircle2;
}[] = [
  { id: "pending", label: "Pending", icon: Hourglass },
  { id: "completed", label: "Completed", icon: CheckCircle2 },
  { id: "rejected", label: "Rejected", icon: Ban },
  { id: "expired", label: "Expired", icon: Clock },
  { id: "failed", label: "Failed", icon: AlertCircle },
];

const RISK_STYLES = {
  low: "text-emerald-600",
  medium: "text-amber-600",
  high: "text-destructive",
} as const;

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function useApprovalsForStatus(status: ApprovalStatusTab, page: number) {
  const input = { page, pageSize: PAGE_SIZE };
  const pending = corsairPendingApprovals(input, status === "pending");
  const completed = corsairCompletedApprovals(input, status === "completed");
  const rejected = corsairRejectedApprovals(input, status === "rejected");
  const expired = corsairExpiredApprovals(input, status === "expired");
  const failed = corsairFailedApprovals(input, status === "failed");

  return useMemo(() => {
    switch (status) {
      case "pending":
        return pending;
      case "completed":
        return completed;
      case "rejected":
        return rejected;
      case "expired":
        return expired;
      case "failed":
        return failed;
    }
  }, [status, pending, completed, rejected, expired, failed]);
}

function FailedApprovalRow({ approval }: { approval: ApprovalItem }) {
  const { runRetry, isRetrying } = useApprovalRetry(approval.id);

  async function handleRetry(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await runRetry();
    } catch {
      // toast handled in hook
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Link
        href={`/approval/${approval.id}`}
        className="group block transition-colors hover:opacity-90"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-label-md text-foreground group-hover:text-primary">{approval.title}</p>
            <p className="line-clamp-2 text-body-sm text-muted-foreground">{approval.description}</p>
          </div>
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-ai-accent opacity-70" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-label-sm text-muted-foreground">
          <span className="rounded-full bg-secondary px-2 py-0.5 uppercase tracking-wide">
            {approval.service.replace("_", " ")}
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5">{approval.action}</span>
          <span
            className={cn(
              "rounded-full bg-secondary px-2 py-0.5 capitalize",
              RISK_STYLES[approval.riskLevel],
            )}
          >
            {approval.riskLevel} risk
          </span>
          <span className="ml-auto text-body-sm">{formatWhen(approval.updatedAt)}</span>
        </div>

        {approval.error && (
          <p className="mt-2 line-clamp-2 text-body-sm text-destructive">{approval.error}</p>
        )}
      </Link>

      <div className="mt-3 flex gap-2 border-t border-border pt-3">
        <Button type="button" size="sm" variant="outline" disabled={isRetrying} onClick={handleRetry}>
          {isRetrying ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
          Retry
        </Button>
        <Button type="button" size="sm" variant="ghost" asChild>
          <Link href={`/approval/${approval.id}`}>View details</Link>
        </Button>
      </div>
    </div>
  );
}

function ApprovalRow({ approval }: { approval: ApprovalItem }) {
  return (
    <Link
      href={`/approval/${approval.id}`}
      className="group block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-secondary/40"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-label-md text-foreground group-hover:text-primary">{approval.title}</p>
          <p className="line-clamp-2 text-body-sm text-muted-foreground">{approval.description}</p>
        </div>
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-ai-accent opacity-70" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-label-sm text-muted-foreground">
        <span className="rounded-full bg-secondary px-2 py-0.5 uppercase tracking-wide">
          {approval.service.replace("_", " ")}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5">{approval.action}</span>
        <span className={cn("rounded-full bg-secondary px-2 py-0.5 capitalize", RISK_STYLES[approval.riskLevel])}>
          {approval.riskLevel} risk
        </span>
        <span className="ml-auto text-body-sm">{formatWhen(approval.updatedAt)}</span>
      </div>

      {approval.error && (
        <p className="mt-2 line-clamp-2 text-body-sm text-destructive">{approval.error}</p>
      )}
    </Link>
  );
}

export function ApprovalsList() {
  const [status, setStatus] = useState<ApprovalStatusTab>("pending");
  const [page, setPage] = useState(1);

  const { data, isPending, isError, error } = useApprovalsForStatus(status, page);

  function selectStatus(next: ApprovalStatusTab) {
    setStatus(next);
    setPage(1);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-4xl flex-col px-4 py-8 md:px-6">
      <div className="shrink-0 space-y-2">
        <h1 className="text-headline-sm text-foreground">Approval history</h1>
        <p className="text-body-md text-muted-foreground">
          Review Corsair approval events awaiting action or already resolved. Open any item for
          full details.
        </p>
      </div>

      <div className="mt-6 flex shrink-0 flex-wrap gap-2">
        {STATUS_TABS.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={status === id ? "default" : "outline"}
            onClick={() => selectStatus(id)}
            className="gap-1.5"
          >
            <Icon className="size-4" />
            {label}
          </Button>
        ))}
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
        {isPending && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 size-5 animate-spin" />
            <span className="text-body-md">Loading approvals…</span>
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-body-md text-destructive">
            {error?.message ?? "Failed to load approvals."}
          </div>
        )}

        {!isPending && !isError && data?.items.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <p className="text-label-md text-foreground">No {status} approvals</p>
            <p className="mt-1 text-body-sm text-muted-foreground">
              Approvals from Orion chat will appear here once they reach this status.
            </p>
          </div>
        )}

        {!isPending && !isError && data && data.items.length > 0 && (
          <ul className="space-y-3 pb-4">
            {data.items.map((approval) => (
              <li key={approval.id}>
                {status === "failed" ? (
                  <FailedApprovalRow approval={approval} />
                ) : (
                  <ApprovalRow approval={approval} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {data && data.pagination.totalPages > 0 && (
        <div className="mt-4 flex shrink-0 items-center justify-between border-t border-border pt-4">
          <p className="text-body-sm text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.totalCount}{" "}
            total
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!data.pagination.hasPreviousPage}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!data.pagination.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
