CREATE TABLE IF NOT EXISTS pet_characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  rarity TEXT NOT NULL,
  unlocked INTEGER NOT NULL DEFAULT 1,
  favorite INTEGER NOT NULL DEFAULT 0,
  first_selected_at TEXT,
  last_selected_at TEXT,
  selection_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE pet_profile ADD COLUMN active_pet_id TEXT NOT NULL DEFAULT 'cachewraith';

INSERT OR IGNORE INTO pet_characters (id, name, category, rarity, unlocked) VALUES
  ('cachewraith', 'CacheWraith', 'ghost', 'common', 1),
  ('byte-bunny', 'ByteBunny', 'animal', 'common', 1),
  ('null-cat', 'NullCat', 'animal', 'rare', 0),
  ('ping-pup', 'PingPup', 'animal', 'common', 1),
  ('stack-bot', 'StackBot', 'robot', 'uncommon', 1),
  ('glitch-slime', 'GlitchSlime', 'slime', 'rare', 0),
  ('ember-fox', 'EmberFox', 'elemental', 'epic', 0),
  ('moss-munch', 'MossMunch', 'nature', 'uncommon', 0),
  ('lunar-moth', 'LunarMoth', 'fantasy', 'epic', 0),
  ('orbit-orb', 'OrbitOrb', 'space', 'rare', 0),
  ('frost-fang', 'FrostFang', 'elemental', 'epic', 0),
  ('rune-owl', 'RuneOwl', 'fantasy', 'legendary', 0);
