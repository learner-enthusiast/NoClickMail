import { corsair } from "../corsair";
import type {
  ContactSuggestionModelType,
  DeleteMessageInputModelType,
  DeleteMessageOutputModelType,
  GetMessageInputModelType,
  GmailMessageDetailType,
  GmailMessageSummaryType,
  ListDraftsInputModelType,
  ListInboxInputModelType,
  ListInboxOutputModelType,
  ListMessagesOutputModelType,
  ListMessagesPaginationModelType,
  ListSentContactsInputModelType,
  ListSentContactsOutputModelType,
  ListSentInputModelType,
  ListTrashInputModelType,
  MarkMessageReadInputModelType,
  MarkMessageReadOutputModelType,
  RestoreMessageInputModelType,
  RestoreMessageOutputModelType,
  SendMessageInputModelType,
  SendMessageOutputModelType,
} from "./model";

type GmailMessage = {
  id?: string;
  threadId?: string;
  snippet?: string;
  labelIds?: string[];
  payload?: MessagePart;
};
type MessagePart = {
  mimeType?: string;
  headers?: { name?: string; value?: string }[];
  body?: { data?: string };
  parts?: MessagePart[];
};

class GmailService {
  private gmail(tenantId: string) {
    return corsair.withTenant(tenantId).gmail.api;
  }
  private async listByLabels(
    tenantId: string,
    input: ListMessagesPaginationModelType,
    labelIds: string[],
  ): Promise<ListMessagesOutputModelType> {
    const gmail = this.gmail(tenantId);
    const list = await gmail.messages.list({
      labelIds,
      maxResults: input.maxResults,
      pageToken: input.pageToken,
      q: input.q,
    });
    const ids = (list.messages ?? []).map((m) => m.id).filter(Boolean) as string[];
    const messages = await Promise.all(
      ids.map(async (id) => {
        const msg = (await gmail.messages.get({
          id,
          format: "full",
          metadataHeaders: ["From", "To", "Subject", "Date"],
        })) as GmailMessage;
        return this.toSummary(msg);
      }),
    );
    return { messages, nextPageToken: list.nextPageToken };
  }

  async listInbox(
    tenantId: string,
    input: ListInboxInputModelType,
  ): Promise<ListInboxOutputModelType> {
    return this.listByLabels(tenantId, input, ["INBOX"]);
  }
  async listSent(
    tenantId: string,
    input: ListSentInputModelType,
  ): Promise<ListMessagesOutputModelType> {
    return this.listByLabels(tenantId, input, ["SENT"]);
  }
  async getMessage(
    tenantId: string,
    input: GetMessageInputModelType,
  ): Promise<GmailMessageDetailType> {
    const msg = (await this.gmail(tenantId).messages.get({
      id: input.id,
      format: "full",
    })) as GmailMessage;

    const { text, html } = this.extractBody(msg.payload);
    return {
      ...this.toSummary(msg),
      to: this.header(msg, "To"),
      cc: this.header(msg, "Cc"),
      bodyText: text,
      bodyHtml: html,
    };
  }

  async sendMessage(
    tenantId: string,
    input: SendMessageInputModelType,
  ): Promise<SendMessageOutputModelType> {
    const raw = this.buildRawMessage(input);
    const sent = (await this.gmail(tenantId).messages.send({ raw })) as GmailMessage;
    return { id: sent.id ?? "", threadId: sent.threadId ?? "" };
  }

  private toSummary(msg: GmailMessage): GmailMessageSummaryType {
    const labelIds = msg.labelIds ?? [];
    return {
      id: msg.id ?? "",
      threadId: msg.threadId ?? "",
      snippet: msg.snippet ?? "",
      from: this.header(msg, "From"),
      to: this.header(msg, "To"),
      subject: this.header(msg, "Subject"),
      date: this.header(msg, "Date"),
      unread: labelIds.includes("UNREAD"),
      starred: labelIds.includes("STARRED"),
      important: labelIds.includes("IMPORTANT"),
      draft: labelIds.includes("DRAFT"),
      sent: labelIds.includes("SENT"),
      inInbox: labelIds.includes("INBOX"),
      trashed: labelIds.includes("TRASH"),
      labelIds,
    };
  }

  private header(msg: GmailMessage, name: string): string | null {
    const found = msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
    return found?.value ?? null;
  }

  private extractBody(part?: MessagePart): { text: string | null; html: string | null } {
    let text: string | null = null;
    let html: string | null = null;

    const walk = (p?: MessagePart) => {
      if (!p) return;
      if (p.mimeType === "text/plain" && p.body?.data) {
        text ??= this.decodeBase64Url(p.body.data);
      } else if (p.mimeType === "text/html" && p.body?.data) {
        html ??= this.decodeBase64Url(p.body.data);
      }
      p.parts?.forEach(walk);
    };
    walk(part);
    return { text, html };
  }

  private decodeBase64Url(data: string): string {
    return Buffer.from(data, "base64url").toString("utf8");
  }

  private buildRawMessage(input: SendMessageInputModelType): string {
    const message = [
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      input.body,
    ].join("\r\n");
    return Buffer.from(message).toString("base64url");
  }
  async listSentContacts(
    tenantId: string,
    input: ListSentContactsInputModelType,
  ): Promise<ListSentContactsOutputModelType> {
    const gmail = this.gmail(tenantId);

    const list = await gmail.messages.list({
      labelIds: ["SENT"],
      maxResults: input.maxMessages,
    });

    const ids = (list.messages ?? []).map((m) => m.id).filter((id): id is string => !!id);

    const messages = await Promise.all(
      ids.map(
        (id) =>
          gmail.messages.get({
            id,
            format: "full",
            metadataHeaders: ["To", "Cc", "Bcc"],
          }) as Promise<GmailMessage>,
      ),
    );

    const byEmail = new Map<string, ContactSuggestionModelType>();
    const to = JSON.stringify(messages[0]?.payload);

    for (const msg of messages) {
      for (const headerName of ["To", "Cc", "Bcc"] as const) {
        const value = this.header(msg, headerName);
        if (!value) continue;

        for (const { email, name } of this.parseAddresses(value)) {
          const key = email.toLowerCase();
          const existing = byEmail.get(key);
          if (existing) {
            existing.frequency += 1;
            if (!existing.name && name) existing.name = name;
          } else {
            byEmail.set(key, { email, name: name ?? null, frequency: 1 });
          }
        }
      }
    }

    let contacts = [...byEmail.values()];

    if (input.q) {
      const q = input.q.toLowerCase();
      contacts = contacts.filter(
        (c) => c.email.toLowerCase().includes(q) || (c.name?.toLowerCase().includes(q) ?? false),
      );
    }

    contacts.sort((a, b) => b.frequency - a.frequency);

    return { contacts: contacts.slice(0, input.limit) };
  }

  private parseAddresses(headerValue: string): { email: string; name: string | null }[] {
    const results: { email: string; name: string | null }[] = [];

    // Good enough for typical headers: split on commas, then pull "Name <email>".
    for (const part of headerValue.split(",")) {
      const segment = part.trim();
      if (!segment) continue;

      const angle = segment.match(/^(.*)<([^>]+)>$/);
      if (angle) {
        const name = angle[1]?.trim().replace(/^"|"$/g, "") || null;
        results.push({ email: angle[2]?.trim() ?? "", name });
      } else if (segment.includes("@")) {
        results.push({ email: segment, name: null });
      }
    }

    return results;
  }
  async listDrafts(
    tenantId: string,
    input: ListDraftsInputModelType,
  ): Promise<ListMessagesOutputModelType> {
    const gmail = this.gmail(tenantId);

    const list = await gmail.drafts.list({
      maxResults: input.maxResults,
      pageToken: input.pageToken,
      q: input.q,
    });

    const drafts = list.drafts ?? [];
    const messages = await Promise.all(
      drafts.map(async (d) => {
        const full = await gmail.drafts.get({ id: d.id!, format: "metadata" });
        const msg = full.message as GmailMessage;
        return this.toSummary({ ...msg, id: d.id! }); // draft id for delete/update
      }),
    );

    return { messages, nextPageToken: list.nextPageToken };
  }
  async deleteMessage(
    tenantId: string,
    input: DeleteMessageInputModelType,
  ): Promise<DeleteMessageOutputModelType> {
    const gmail = this.gmail(tenantId);

    if (input.isDraft) {
      await gmail.drafts.delete({ id: input.id });
      return { success: true };
    }

    if (input.permanent) {
      await gmail.messages.delete({ id: input.id });
    } else {
      await gmail.messages.trash({ id: input.id });
    }

    return { success: true };
  }

  async markMessageRead(
    tenantId: string,
    input: MarkMessageReadInputModelType,
  ): Promise<MarkMessageReadOutputModelType> {
    const gmail = this.gmail(tenantId);

    await gmail.messages.modify({
      id: input.id,
      addLabelIds: input.read ? [] : ["UNREAD"],
      removeLabelIds: input.read ? ["UNREAD"] : [],
    });

    return { success: true };
  }
  async listTrash(
    tenantId: string,
    input: ListTrashInputModelType,
  ): Promise<ListMessagesOutputModelType> {
    return this.listByLabels(tenantId, input, ["TRASH"]);
  }
  private restoredLocation(summary: GmailMessageSummaryType): "inbox" | "sent" | "draft" | "other" {
    if (summary.draft) return "draft";
    if (summary.inInbox) return "inbox";
    if (summary.sent) return "sent";
    return "other";
  }

  async restoreMessage(
    tenantId: string,
    input: RestoreMessageInputModelType,
  ): Promise<RestoreMessageOutputModelType> {
    const gmail = this.gmail(tenantId);

    // Removes TRASH; Gmail restores to original folder from remaining labels
    await gmail.messages.untrash({ id: input.id });

    const msg = (await gmail.messages.get({
      id: input.id,
      format: "metadata",
      metadataHeaders: ["From", "To", "Subject", "Date"],
    })) as GmailMessage;

    const summary = this.toSummary(msg);

    return {
      success: true,
      restoredTo: this.restoredLocation(summary),
    };
  }
}

export default GmailService;
