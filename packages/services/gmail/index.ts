import { corsair } from "../corsair";
import type {
  ContactSuggestionModelType,
  GetMessageInputModelType,
  GmailMessageDetailType,
  GmailMessageSummaryType,
  ListInboxInputModelType,
  ListInboxOutputModelType,
  ListSentContactsInputModelType,
  ListSentContactsOutputModelType,
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

  async listInbox(
    tenantId: string,
    input: ListInboxInputModelType,
  ): Promise<ListInboxOutputModelType> {
    const gmail = this.gmail(tenantId);

    const list = await gmail.messages.list({
      labelIds: ["INBOX"],
      maxResults: input.maxResults,
      pageToken: input.pageToken,
      q: input.q,
    });

    const ids = (list.messages ?? []).map((m) => m.id).filter((id): id is string => !!id);

    // messages.list only returns ids — fetch metadata for each to get headers.
    const messages = await Promise.all(
      ids.map(async (id) => {
        const msg = (await gmail.messages.get({
          id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        })) as GmailMessage;
        return this.toSummary(msg);
      }),
    );

    return { messages, nextPageToken: list.nextPageToken };
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
      subject: this.header(msg, "Subject"),
      date: this.header(msg, "Date"),
      unread: labelIds.includes("UNREAD"),
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
            format: "metadata",
            metadataHeaders: ["To", "Cc", "Bcc"],
          }) as Promise<GmailMessage>,
      ),
    );

    const byEmail = new Map<string, ContactSuggestionModelType>();

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
}

export default GmailService;
