CREATE TABLE "observer_response" (
	"id" text PRIMARY KEY NOT NULL,
	"subjectId" text NOT NULL,
	"words" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "observer_response" ADD CONSTRAINT "observer_response_subjectId_user_id_fk" FOREIGN KEY ("subjectId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;