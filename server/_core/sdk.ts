import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

type SessionPayload = { openId: string; name: string };

function sessionKey() {
  if (ENV.cookieSecret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
  return new TextEncoder().encode(ENV.cookieSecret);
}

export class SDKServer {
  async createSessionToken(openId: string, options: { expiresInMs?: number; name?: string } = {}) {
    return this.signSession({ openId, name: options.name ?? "" }, options);
  }

  async signSession(payload: SessionPayload, options: { expiresInMs?: number } = {}) {
    const expiresAt = Math.floor((Date.now() + (options.expiresInMs ?? ONE_YEAR_MS)) / 1000);
    return new SignJWT({ name: payload.name })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(payload.openId)
      .setExpirationTime(expiresAt)
      .sign(sessionKey());
  }

  async verifySession(cookieValue: string | undefined | null): Promise<SessionPayload | null> {
    if (!cookieValue) return null;
    try {
      const { payload } = await jwtVerify(cookieValue, sessionKey(), { algorithms: ["HS256"] });
      if (typeof payload.sub !== "string" || !payload.sub) return null;
      return { openId: payload.sub, name: typeof payload.name === "string" ? payload.name : "" };
    } catch {
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const token = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
    const session = await this.verifySession(token);
    if (!session) throw new Error("Invalid session cookie");
    const user = await db.getUserByOpenId(session.openId);
    if (!user) throw new Error("Account not found");
    return user;
  }
}

export const sdk = new SDKServer();
