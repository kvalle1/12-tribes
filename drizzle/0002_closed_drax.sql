CREATE TABLE "assessment_result" (
	"userId" text PRIMARY KEY NOT NULL,
	"words" jsonb NOT NULL,
	"primarySlug" text NOT NULL,
	"secondarySlug" text,
	"shareToken" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_result_shareToken_unique" UNIQUE("shareToken")
);
--> statement-breakpoint
ALTER TABLE "assessment_result" ADD CONSTRAINT "assessment_result_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;