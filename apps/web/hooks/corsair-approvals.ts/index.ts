import { RouterInputs } from "@repo/trpc/client";
import { pickMutationState, pickQueryState } from "~/lib/constants";
import { trpc } from "~/trpc/client";

export const corsairApprovals = (
  input?: RouterInputs["corsairApprovals"]["list"],
  enabled = true,
) => pickQueryState(trpc.corsairApprovals.list.useQuery(input, { enabled }));

export const corsairApproval = (
  input: RouterInputs["corsairApprovals"]["get"],
  enabled = true,
) => pickQueryState(trpc.corsairApprovals.get.useQuery(input, { enabled }));

export const corsairCompletedApprovals = (
  input: RouterInputs["corsairApprovals"]["listCompleted"],
  enabled = true,
) => pickQueryState(trpc.corsairApprovals.listCompleted.useQuery(input, { enabled }));

export const corsairPendingApprovals = (
  input: RouterInputs["corsairApprovals"]["listPending"],
  enabled = true,
) => pickQueryState(trpc.corsairApprovals.listPending.useQuery(input, { enabled }));

export const corsairRejectedApprovals = (
  input: RouterInputs["corsairApprovals"]["listRejected"],
  enabled = true,
) => pickQueryState(trpc.corsairApprovals.listRejected.useQuery(input, { enabled }));

export const corsairExpiredApprovals = (
  input: RouterInputs["corsairApprovals"]["listExpired"],
  enabled = true,
) => pickQueryState(trpc.corsairApprovals.listExpired.useQuery(input, { enabled }));

export const corsairFailedApprovals = (
  input: RouterInputs["corsairApprovals"]["listFailed"],
  enabled = true,
) => pickQueryState(trpc.corsairApprovals.listFailed.useQuery(input, { enabled }));

export const approveCorsairApproval = () =>
  pickMutationState(trpc.corsairApprovals.approve.useMutation());

export const retryCorsairApproval = () =>
  pickMutationState(trpc.corsairApprovals.retry.useMutation());

export const rejectCorsairApproval = () =>
  pickMutationState(trpc.corsairApprovals.reject.useMutation());
