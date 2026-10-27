import { handlers } from "@/auth";

// Auth.js mounts all of its endpoints (sign-in, callback, session, sign-out,
// CSRF, etc.) under this single catch-all route handler.
export const { GET, POST } = handlers;
