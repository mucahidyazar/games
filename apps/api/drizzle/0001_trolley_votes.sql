CREATE SCHEMA "absurdtrolley";
--> statement-breakpoint
CREATE TABLE "absurdtrolley"."vote" (
	"dilemma_id" text NOT NULL,
	"voter_id" uuid NOT NULL,
	"choice" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "vote_dilemma_id_voter_id_pk" PRIMARY KEY("dilemma_id","voter_id"),
	CONSTRAINT "vote_choice_check" CHECK ("absurdtrolley"."vote"."choice" in ('pull', 'stay'))
);
