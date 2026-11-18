CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"image_url" text,
	"kind" text DEFAULT 'product' NOT NULL,
	"stage" text DEFAULT 'building' NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"year" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Carry the old single "project card" from Settings over as the first published project.
-- Falls back to the built-in default (Sakina) when Settings never stored one.
INSERT INTO "projects" ("name", "tagline", "url", "image_url", "kind", "stage", "role", "published", "position")
SELECT
	COALESCE(NULLIF(s.data->'project'->>'name', ''), 'Sakina'),
	COALESCE(NULLIF(s.data->'project'->>'tagline', ''), 'PLACEHOLDER — one sentence about Sakina, an app for Muslims.'),
	COALESCE(s.data->'project'->>'url', ''),
	'/placeholders/project-1200x800.jpg',
	'startup',
	'building',
	'Founder',
	true,
	0
FROM (SELECT 1) AS one
LEFT JOIN "settings" s ON s.id = 1
WHERE COALESCE(s.data->'project'->>'name', 'Sakina') <> '';
