-- A2 M2: history adds up to every balance (C4), and balances can't go below
-- zero (C6). No balance moves except a negative one clamped to 0; history is
-- aligned to the balance with one visible correction row per child.

-- 1. Nothing writes 'Approved'. The old approve flow set it and then took the
--    cost off the balance, so these are spends.
UPDATE redemptions SET status = 'Completed' WHERE status = 'Approved';

-- 2. A balance below zero becomes zero.
UPDATE children SET total_points = 0 WHERE total_points < 0;

-- 3. One correction row per child whose balance differs from history.
--    Grouped by child_id only: legacy rows may have a NULL family_code.
INSERT INTO point_events (child_id, points, category, note, child_name, family_code, kind)
SELECT c.id,
       c.total_points - (COALESCE(e.s, 0) - COALESCE(r.s, 0)),
       'Balance correction',
       'History aligned to the balance (one-time fix, Nov 2026)',
       c.name, c.family_code, 'correction'
FROM children c
LEFT JOIN (SELECT child_id, SUM(points) s FROM point_events GROUP BY child_id) e ON e.child_id = c.id
LEFT JOIN (SELECT child_id, SUM(reward_cost) s FROM redemptions WHERE status = 'Completed' GROUP BY child_id) r ON r.child_id = c.id
WHERE c.total_points IS DISTINCT FROM COALESCE(e.s, 0) - COALESCE(r.s, 0);

-- 4. Balances never go below zero from here on.
ALTER TABLE children DROP CONSTRAINT IF EXISTS total_points_nonneg;
ALTER TABLE children ADD CONSTRAINT total_points_nonneg CHECK (total_points >= 0) NOT VALID;
ALTER TABLE children VALIDATE CONSTRAINT total_points_nonneg;

-- 5. Post-check: no child's history differs from its balance.
DO $$
DECLARE drift INT;
BEGIN
  SELECT count(*) INTO drift FROM children c
  LEFT JOIN (SELECT child_id, SUM(points) s FROM point_events GROUP BY child_id) e ON e.child_id = c.id
  LEFT JOIN (SELECT child_id, SUM(reward_cost) s FROM redemptions WHERE status = 'Completed' GROUP BY child_id) r ON r.child_id = c.id
  WHERE c.total_points IS DISTINCT FROM COALESCE(e.s, 0) - COALESCE(r.s, 0);
  IF drift > 0 THEN RAISE EXCEPTION 'reconciliation left % children drifting', drift; END IF;
END $$;
