-- Batch D PR2: behaviours get a line icon chosen from a fixed list. Additive:
-- the old emoji column `icon` is left as it is. Emoji are matched with and
-- without the U+FE0F variation selector; anything else gets 'circle'.
ALTER TABLE behavior_categories ADD COLUMN IF NOT EXISTS icon_key TEXT NOT NULL DEFAULT 'circle';

UPDATE behavior_categories bc SET icon_key = m.key
FROM (VALUES
  ('⭐', 'star'), ('💛', 'heart'), ('🤝', 'handshake'), ('🦁', 'shield'), ('💪', 'mountain'),
  ('🫶', 'hand-heart'), ('🧹', 'brush'), ('📖', 'book-open'), ('📚', 'book-open'),
  ('🎨', 'palette'), ('🏃', 'footprints'), ('🎵', 'music'), ('🧠', 'brain'), ('💤', 'bed'),
  ('✅', 'check'), ('🌟', 'sparkles')
) AS m(emoji, key)
WHERE replace(trim(bc.icon), U&'\FE0F', '') = m.emoji AND bc.icon_key = 'circle';

-- Any child that slipped through without a colour during the PR1 deploy.
UPDATE children c SET colour_index = sub.idx
FROM (
  SELECT id, ((ROW_NUMBER() OVER (PARTITION BY family_code ORDER BY created_date, id)) - 1) % 6 AS idx
  FROM children
) sub
WHERE c.id = sub.id AND c.colour_index IS NULL;
