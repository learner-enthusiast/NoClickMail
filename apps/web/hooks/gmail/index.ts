import type { RouterInputs } from "@repo/trpc/client";
import { pickMutationState, pickQueryState } from "~/lib/constants";
import { trpc } from "~/trpc/client";

export const gmailInbox = (input?: RouterInputs["gmail"]["inbox"]) =>
  pickQueryState(trpc.gmail.inbox.useQuery(input ?? {}));

export const gmailMessage = (input: RouterInputs["gmail"]["message"]) =>
  pickQueryState(trpc.gmail.message.useQuery(input));

export const sendGmailMessage = () => pickMutationState(trpc.gmail.send.useMutation());
// apps/web/hooks/gmail/index.ts
export const gmailSentContacts = (input?: RouterInputs["gmail"]["sentContacts"], enabled = true) =>
  pickQueryState(trpc.gmail.sentContacts.useQuery(input ?? {}, { enabled }));
export const gmailListSentMessages = (input?: RouterInputs["gmail"]["listSentMessages"]) =>
  pickQueryState(trpc.gmail.listSentMessages.useQuery(input ?? {}));

export const gmailListDraftMessages = (input?: RouterInputs["gmail"]["listDraftMessages"]) =>
  pickQueryState(trpc.gmail.listDraftMessages.useQuery(input ?? {}));

export const deleteGmailMessage = () => pickMutationState(trpc.gmail.deleteMessage.useMutation());

export const markGmailMessageRead = () =>
  pickMutationState(trpc.gmail.markMessageRead.useMutation());
