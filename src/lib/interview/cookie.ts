import { cookies } from "next/headers";

/**
 * The Interview resume handle. The client holds only this opaque session id in
 * an httpOnly cookie — never any scoring state (ADR-0009). The server reads it to
 * reload the Session, so a refresh or reopened tab resumes mid-flight (ADR-0011).
 */
export const INTERVIEW_COOKIE = "interview_session_id";

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

/** The current Session id, or `undefined` if no Interview is in progress. */
export async function getSessionIdCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(INTERVIEW_COOKIE)?.value;
}

/** Bind the browser to a Session. Call only from a Server Action / route handler. */
export async function setSessionIdCookie(id: string): Promise<void> {
  const store = await cookies();
  store.set(INTERVIEW_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_WEEK_SECONDS,
  });
}

/** Forget the current Session. Call only from a Server Action / route handler. */
export async function clearSessionIdCookie(): Promise<void> {
  const store = await cookies();
  store.delete(INTERVIEW_COOKIE);
}
