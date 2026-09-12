import { RouterInputs } from "@repo/trpc/client";
import { pickMutationState, pickQueryState } from "~/lib/constants";
import { trpc } from "~/trpc/client";

/** Approval lists change often — always refetch when a list view mounts. */
const APPROVAL_LIST_QUERY_OPTIONS = {
  staleTime: 0,
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: true,
};

export const corsairApprovals = (
  input?: RouterInputs["corsairApprovals"]["list"],
  enabled = true,
) => pickQueryState(trpc.corsairApprovals.list.useQuery(input, { enabled, ...APPROVAL_LIST_QUERY_OPTIONS }));

export const corsairApproval = (
  input: RouterInputs["corsairApprovals"]["get"],
  enabled = true,
) =>
  pickQueryState(
    trpc.corsairApprovals.get.useQuery(input, {
      enabled,
      staleTime: 0,
      refetchOnMount: "always",
    }),
  );

export const corsairCompletedApprovals = (
  input: RouterInputs["corsairApprovals"]["listCompleted"],
  enabled = true,
) =>
  pickQueryState(
    trpc.corsairApprovals.listCompleted.useQuery(input, {
      enabled,
      ...APPROVAL_LIST_QUERY_OPTIONS,
    }),
  );

export const corsairPendingApprovals = (
  input: RouterInputs["corsairApprovals"]["listPending"],
  enabled = true,
) =>
  pickQueryState(
    trpc.corsairApprovals.listPending.useQuery(input, {
      enabled,
      ...APPROVAL_LIST_QUERY_OPTIONS,
    }),
  );

export const corsairRejectedApprovals = (
  input: RouterInputs["corsairApprovals"]["listRejected"],
  enabled = true,
) =>
  pickQueryState(
    trpc.corsairApprovals.listRejected.useQuery(input, {
      enabled,
      ...APPROVAL_LIST_QUERY_OPTIONS,
    }),
  );

export const corsairExpiredApprovals = (
  input: RouterInputs["corsairApprovals"]["listExpired"],
  enabled = true,
) =>
  pickQueryState(
    trpc.corsairApprovals.listExpired.useQuery(input, {
      enabled,
      ...APPROVAL_LIST_QUERY_OPTIONS,
    }),
  );

export const corsairFailedApprovals = (
  input: RouterInputs["corsairApprovals"]["listFailed"],
  enabled = true,
) =>
  pickQueryState(
    trpc.corsairApprovals.listFailed.useQuery(input, {
      enabled,
      ...APPROVAL_LIST_QUERY_OPTIONS,
    }),
  );

export const approveCorsairApproval = () =>
  pickMutationState(trpc.corsairApprovals.approve.useMutation());

export const retryCorsairApproval = () =>
  pickMutationState(trpc.corsairApprovals.retry.useMutation());

export const rejectCorsairApproval = () =>
  pickMutationState(trpc.corsairApprovals.reject.useMutation());

export const updateCorsairApprovalDraft = () =>
  pickMutationState(trpc.corsairApprovals.updateDraft.useMutation());

export const uploadCorsairApprovalAttachment = () =>
  pickMutationState(trpc.corsairApprovals.uploadAttachment.useMutation());
