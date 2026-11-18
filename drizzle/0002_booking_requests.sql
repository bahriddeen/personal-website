CREATE TABLE "booking_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"visitor_time_zone" text DEFAULT '' NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
