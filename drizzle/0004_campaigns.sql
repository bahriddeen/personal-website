CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"preheader" text DEFAULT '' NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"recipients" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
