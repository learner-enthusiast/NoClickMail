CREATE TABLE "calendar_watch_channels" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"expires_at" timestamp with time zone
);
