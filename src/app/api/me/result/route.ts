import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";

/**
 * Whether the signed-in user has a saved current result. Backs the home page's
 * "View your results" entry (#18) without making the static landing page
 * dynamic: `/` stays statically rendered and this is fetched after hydration,
 * mirroring how the nav reads the session client-side (AuthNav). Signed-out
 * callers get `{ hasResult: false }`; no result data is exposed either way.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ hasResult: false });
  }
  const row = await getCurrentResult(session.user.id);
  return NextResponse.json({ hasResult: Boolean(row) });
}
