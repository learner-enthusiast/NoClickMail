import type { RouterInputs } from "@repo/trpc/client";
import { pickMutationState, pickQueryState } from "~/lib/constants";
import { trpc } from "~/trpc/client";

export const gmailInbox = (input?: RouterInputs["gmail"]["inbox"]) =>
  pickQueryState(trpc.gmail.inbox.useQuery(input ?? {}));

export const gmailMessage = (input: RouterInputs["gmail"]["message"]) =>
  pickQueryState(trpc.gmail.message.useQuery(input));

export const sendGmailMessage = () => pickMutationState(trpc.gmail.send.useMutation());
