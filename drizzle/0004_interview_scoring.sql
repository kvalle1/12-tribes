ALTER TABLE "interview_session" ADD COLUMN "trace" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_session" ADD COLUMN "currentQuestion" text;