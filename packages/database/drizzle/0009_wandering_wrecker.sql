-- Convert image_url from a single text value to text[] for multi-file chat attachments.
ALTER TABLE "chat_messages"
  ALTER COLUMN "image_url" TYPE text[]
  USING CASE
    WHEN "image_url" IS NULL THEN NULL
    ELSE ARRAY["image_url"]
  END;
