import { clearCookieFactory, createCookieFactory, getCookieFactory } from "./cookie";
import { CreateExpressContextOptions } from "@trpc/server/adapters/express";

export interface TRPCContext {
  createCookie: ReturnType<typeof createCookieFactory>;
  getCookie: ReturnType<typeof getCookieFactory>;
  clearCookie: ReturnType<typeof clearCookieFactory>;
  getHeader: (name: string) => string | undefined;
  ip: string;
}

export async function createContext({
  req,
  res,
}: CreateExpressContextOptions): Promise<TRPCContext> {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const ctx: TRPCContext = {
    createCookie: createCookieFactory(res),
    getCookie: getCookieFactory(req),
    clearCookie: clearCookieFactory(res),
    getHeader: (name: string) => {
      const value = req.headers[name.toLowerCase()];
      return Array.isArray(value) ? value[0] : value;
    },
    ip,
  };
  return ctx;
}
export type Context = Awaited<ReturnType<typeof createContext>>;
