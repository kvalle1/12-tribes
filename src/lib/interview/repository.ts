import type { Session } from "./types";

/**
 * Persistence contract for Interview Sessions (ADR-0011).
 *
 * The Session is written every Turn so a refresh or a closed tab can resume where
 * the participant left off. Implementations must round-trip a Session faithfully
 * and isolate stored state from the caller's references (no shared mutation).
 *
 * Two implementations satisfy this contract: {@link InMemoryInterviewRepository}
 * (used by the unit tests) and the Drizzle/Neon repository used at runtime.
 */
export interface InterviewRepository {
  /** Persist a newly created Session. */
  create(session: Session): Promise<void>;
  /** Load a Session by id, or `null` if none exists. */
  load(id: string): Promise<Session | null>;
  /** Overwrite the stored Session with its latest state (per-Turn write). */
  save(session: Session): Promise<void>;
}

/** Deep copy a Session so stored and caller-held references never alias. */
function clone(session: Session): Session {
  return structuredClone(session);
}

/**
 * In-memory {@link InterviewRepository} for tests and local experimentation.
 * Holds Sessions in a Map; nothing survives process restart.
 */
export class InMemoryInterviewRepository implements InterviewRepository {
  private readonly sessions = new Map<string, Session>();

  async create(session: Session): Promise<void> {
    this.sessions.set(session.id, clone(session));
  }

  async load(id: string): Promise<Session | null> {
    const stored = this.sessions.get(id);
    return stored ? clone(stored) : null;
  }

  async save(session: Session): Promise<void> {
    this.sessions.set(session.id, clone(session));
  }
}
