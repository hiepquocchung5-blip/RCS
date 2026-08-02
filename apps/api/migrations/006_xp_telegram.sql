-- Migration 006: Add XP and Telegram Username columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username TEXT;

ALTER TABLE project_proposals ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE client_orders ADD COLUMN IF NOT EXISTS telegram_username TEXT;
