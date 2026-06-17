import type { Response } from "express";

export type RealtimeEvent =
  | { type: "gmail.inbox.changed"; historyId?: string }
  | { type: "calendar.events.changed"; calendarId?: string };

type Client = { res: Response; heartbeat: NodeJS.Timeout };

class SseHub {
  // userId → open SSE connections for THAT user only
  private clients = new Map<string, Set<Client>>();

  subscribe(userId: string, res: Response) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx
    });
    res.write(": connected\n\n"); // comment line keeps connection alive

    const heartbeat = setInterval(() => {
      res.write(": ping\n\n");
    }, 25_000);

    const client = { res, heartbeat };
    const set = this.clients.get(userId) ?? new Set();
    set.add(client);
    this.clients.set(userId, set);

    res.on("close", () => {
      clearInterval(heartbeat);
      set.delete(client);
      if (set.size === 0) this.clients.delete(userId);
    });
  }

  notify(userId: string, event: RealtimeEvent) {
    const set = this.clients.get(userId);
    if (!set) return; // user not online — fine

    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const { res } of set) {
      res.write(payload);
    }
  }
}

export const sseHub = new SseHub();
