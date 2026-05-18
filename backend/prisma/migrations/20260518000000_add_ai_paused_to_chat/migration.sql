-- Add aiPaused field to chats table
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "aiPaused" BOOLEAN NOT NULL DEFAULT false;
