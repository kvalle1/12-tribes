ALTER TABLE "interview_session" ADD COLUMN "traces" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_session" ADD COLUMN "pendingQuestion" text;