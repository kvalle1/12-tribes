import { DrizzleInterviewRepository } from "./drizzle-repository";
import type { InterviewRepository } from "./repository";

/**
 * The runtime Interview repository (Drizzle/Neon). Imported by the
 * server-authoritative loop — route handlers, Server Actions, and Server
 * Components. Server-only by virtue of pulling in the database client.
 */
export const interviewRepository: InterviewRepository =
  new DrizzleInterviewRepository();
