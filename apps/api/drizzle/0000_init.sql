CREATE SCHEMA "core";
--> statement-breakpoint
CREATE SCHEMA "traptheorb";
--> statement-breakpoint
CREATE TABLE "core"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"nickname" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "core"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "core"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traptheorb"."badge" (
	"user_id" text NOT NULL,
	"badge_id" text NOT NULL,
	"tier" smallint NOT NULL,
	"run_id" uuid,
	"earned_at" timestamp with time zone NOT NULL,
	CONSTRAINT "badge_user_id_badge_id_pk" PRIMARY KEY("user_id","badge_id"),
	CONSTRAINT "badge_tier_check" CHECK ("traptheorb"."badge"."tier" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "traptheorb"."record" (
	"board_key" text NOT NULL,
	"user_id" text NOT NULL,
	"value" double precision NOT NULL,
	"level" integer,
	"run_id" uuid,
	"achieved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "record_board_key_user_id_pk" PRIMARY KEY("board_key","user_id")
);
--> statement-breakpoint
CREATE TABLE "traptheorb"."run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"mode" text NOT NULL,
	"field" text NOT NULL,
	"seed" bigint NOT NULL,
	"daily_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"ranked" boolean NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"end_tick" integer,
	"input_count" integer,
	"score" integer,
	"level" integer,
	"levels_cleared" integer,
	"stats" jsonb,
	"client_score" integer,
	"client_level" integer,
	"mismatch" boolean DEFAULT false NOT NULL,
	CONSTRAINT "run_status_check" CHECK ("traptheorb"."run"."status" in ('active', 'finished', 'abandoned')),
	CONSTRAINT "run_field_check" CHECK ("traptheorb"."run"."field" in ('landscape', 'portrait'))
);
--> statement-breakpoint
ALTER TABLE "core"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traptheorb"."badge" ADD CONSTRAINT "badge_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traptheorb"."badge" ADD CONSTRAINT "badge_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "traptheorb"."run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traptheorb"."record" ADD CONSTRAINT "record_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traptheorb"."record" ADD CONSTRAINT "record_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "traptheorb"."run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traptheorb"."run" ADD CONSTRAINT "run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "core"."account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_nickname_lower_uidx" ON "core"."profile" USING btree (lower("nickname"));--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "core"."session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "core"."verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "record_board_value_idx" ON "traptheorb"."record" USING btree ("board_key","value");--> statement-breakpoint
CREATE INDEX "record_user_idx" ON "traptheorb"."record" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "run_user_status_idx" ON "traptheorb"."run" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "run_one_active_per_user_uidx" ON "traptheorb"."run" USING btree ("user_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "run_user_ranked_daily_idx" ON "traptheorb"."run" USING btree ("user_id","daily_date") WHERE mode = 'daily' and status = 'finished' and ranked;