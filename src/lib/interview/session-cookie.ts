import { cookies } from "next/headers";

/**
 * The Interview Session cookie holds only the **id** of the server-side Session —
 * an opaque pointer, never scoring state (ADR-0009). The server reads it to
 * resume an in-progress run after a refresh or a reopened tab. It is `httpOnly`
 * so client scripts cannot read or forge it.
 */
export const INTERVIEW_COOKIE = "tribe_interview_sid";

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

/** Read the current Session id from the request cookies, if any. */
export async function readSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(INTERVIEW_COOKIE)?.value ?? null;
}

/** Point the cookie at a Session id (must be called from an Action/Route). */
export async function writeSessionId(id: string): Promise<void> {
  const store = await cookies();
  store.set(INTERVIEW_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_WEEK_SECONDS,
  });
}
