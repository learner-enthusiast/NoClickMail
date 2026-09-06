"use client";

import { useState } from "react";
import { toast } from "sonner";
import { retryCorsairApproval } from "~/hooks/corsair-approvals.ts";
import { trpc } from "~/trpc/client";

function getErrorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && typeof e.message === "string") {
    return e.message;
  }
  return "Something went wrong. Please try again.";
}

type StreamEvent = {
  type: string;
  text?: string;
  output?: string;
  threadId?: string;
};

async function consumeRetryStream(
  stream: AsyncIterable<StreamEvent>,
  onDelta?: (text: string) => void,
): Promise<{ output: string; threadId?: string }> {
  let output = "";
  let threadId: string | undefined;

  for await (const event of stream) {
    if (event.type === "delta" && event.text) {
      output += event.text;
      onDelta?.(event.text);
    } else if (event.type === "done") {
      output = event.output ?? output;
      threadId = event.threadId;
    }
  }

  return { output, threadId };
}

export function useApprovalRetry(approvalId: string) {
  const utils = trpc.useUtils();
  const { mutateAsync: retry } = retryCorsairApproval();
  const [isRetrying, setIsRetrying] = useState(false);

  async function invalidateApprovalQueries(threadId?: string) {
    await Promise.all([
      utils.corsairApprovals.get.invalidate({ approvalId }),
      utils.corsairApprovals.listFailed.invalidate(),
      utils.corsairApprovals.listPending.invalidate(),
      utils.corsairApprovals.listCompleted.invalidate(),
    ]);
    if (threadId) {
      await utils.agent.threadMessages.invalidate({ threadId });
      await utils.agent.listThreads.invalidate();
    }
  }

  async function runRetry(options?: { onDelta?: (text: string) => void }) {
    if (isRetrying) return null;
    setIsRetrying(true);

    try {
      const stream = await retry({ approvalId });
      const { output, threadId } = await consumeRetryStream(stream, options?.onDelta);
      await invalidateApprovalQueries(threadId);
      toast.success("Corsair action completed");
      return { output, threadId };
    } catch (e) {
      console.error(e);
      const message = getErrorMessage(e);
      await utils.corsairApprovals.get.invalidate({ approvalId });
      await utils.corsairApprovals.listFailed.invalidate();
      toast.error(message);
      throw e;
    } finally {
      setIsRetrying(false);
    }
  }

  return { runRetry, isRetrying };
}
