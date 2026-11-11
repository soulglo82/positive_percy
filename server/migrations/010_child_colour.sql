-- Batch D v0.5: each child keeps one colour (0-5). Stored, so deleting a child
-- never changes another child's colour. Existing children get the order they
-- were added in, per family. New children get the smallest unused colour
-- (server/routes.js::createChild). Only the server writes it.
ALTER TABLE children ADD COLUMN IF NOT EXISTS colour_index SMALLINT;

UPDATE children c SET colour_index = o.idx
FROM (
  SELECT id, ((ROW_NUMBER() OVER (PARTITION BY family_code ORDER BY created_date, id)) - 1) % 6 AS idx
  FROM children
) o
WHERE c.id = o.id AND c.colour_index IS NULL;

ALTER TABLE children DROP CONSTRAINT IF EXISTS children_colour_index_range;
ALTER TABLE children ADD CONSTRAINT children_colour_index_range CHECK (colour_index IS NULL OR colour_index BETWEEN 0 AND 5);
