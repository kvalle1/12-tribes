import "server-only";
import { cookies } from "next/headers";

/**
 * The Interview Session is identified across requests by an opaque id stored in
 * an httpOnly cookie. Only the id lives client-side — never any scoring state
 * (ADR-0009) — so the server can load the authoritative Session on each request
 * and resume it after a refresh or tab reopen (ADR-0011).
 */
const COOKIE_NAME = "interview_session";

export async function getSessionCookie(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_NAME)?.value;
}

export async function setSessionCookie(id: string): Promise<void> {
  (await cookies()).set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // A multi-minute interview that survives reloads; expire after a day.
    maxAge: 60 * 60 * 24,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
