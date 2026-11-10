-- A2 W4: at most 4 quick-action categories per family. Families over the cap
-- keep their first 4 by sort order.
UPDATE behavior_categories bc SET is_quick_action = false
FROM (
  SELECT id, row_number() OVER (PARTITION BY family_code ORDER BY sort_order, created_date, id) AS n
  FROM behavior_categories WHERE is_quick_action
) ranked
WHERE bc.id = ranked.id AND ranked.n > 4;
