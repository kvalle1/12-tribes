CREATE TABLE "interview_session" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"turns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"turnCount" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interview_session" ADD CONSTRAINT "interview_session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;