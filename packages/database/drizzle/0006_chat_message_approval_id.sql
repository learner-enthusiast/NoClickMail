ALTER TABLE "chat_messages" ADD COLUMN "approval_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_approval_id_corsair_approval_events_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."corsair_approval_events"("id") ON DELETE set null ON UPDATE no action;
