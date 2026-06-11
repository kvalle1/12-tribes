CREATE TABLE "interview_session" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"profile" jsonb NOT NULL,
	"posture" jsonb NOT NULL,
	"turns" jsonb NOT NULL,
	"turnCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interview_session" ADD CONSTRAINT "interview_session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;