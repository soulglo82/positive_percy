-- savings-check.sql
--
-- WHAT IT DOES
--   Checks every child's balance and savings before writes resume after a
--   rollback (docs/engineering/V1-ROLLBACK-FREEZE-DESIGN.md §3, the table of
--   five conditions, and §4 step 5). READ-ONLY: it is one SELECT statement, so
--   it cannot change anything and all five conditions see the same moment.
--   It prints counts and child ids only, never a name.
--   It needs a database at migration 017 (the savings ledger). On an earlier
--   database (for example one at migration 012) it changes nothing and stops
--   with an error such as "column r.is_bigger_goal does not exist".
--
-- WHO RUNS IT
--   The owner only. It may be run at any time (it is read-only). In a
--   rollback it is step 5: it must say PASS before write-freeze-off.sql is run.
--
-- HOW TO CHECK THE RESULT
--   Six rows. Rows 1 to 5 are the conditions: offending_rows must be 0;
--   child_ids lists up to 20 of the children concerned.
--   The last row says SAVINGS CHECK: PASS (every count is 0) or
--   SAVINGS CHECK: FAIL. On FAIL, stop: writes stay off (design §4 step 5).
--
-- THE RULES ARE THE APP'S OWN (nothing is decided here)
--   "spendable", "counted_rows", "saved", "goals" and "facts" below are the
--   balance rule of server/routes.js (spendableFrom, savingsSums,
--   goalGeneration, balanceOf) as server/reconcile.js writes it in SQL
--   (childFacts): a reward counts for a child when it is in the child's family
--   and is for every child or names this child; savings count only towards a
--   reward that is still a bigger goal for the child, only in the goal's
--   current generation for that child, and only when their sum is above zero;
--   a goal that is also requested counts once (the larger of the two);
--   committed = points held for requested rewards + savings counted.
--
--   1  No (child, goal, generation) ledger sum is below zero, and no child's
--      sum over the rows that count is below zero. (The app ignores a negative
--      sum; no endpoint can write one.)
--   2  committed > total_points (reconcile.js overCommitted).
--   3  A (child, goal, generation) whose ledger sum is above zero but which the
--      rule above does not count: the goal is gone, is no longer a bigger goal
--      for the child, or its generation has moved on. When V1 ends savings it
--      writes a 'reward_removed' ("savings ended") row for minus the amount in
--      that same generation (routes.js recordEndedSavings), which brings the
--      sum to zero; so a sum still above zero has no such row closing it.
--   4  A redemption that was paid from savings ('spend' row) is 'Reversed',
--      no row undoes that 'spend', and the goal is still the child's bigger
--      goal in the generation of the 'spend'. That is exactly when V1's undo
--      (routes.js POST /api/redemptions/:id/undo, isCurrentGoal) puts the
--      savings back. V1 itself writes no undo row when the goal has ended
--      since, so those are not counted here.
--   5  total_points differs from history: the sum of point_events minus
--      completed redemptions (reconcile.js childFacts "history";
--      scripts/d1-reconcile.mjs history_drift).

WITH
spendable AS (
  -- Every (child, reward) where the reward can be spent on, or saved for by,
  -- the child; with the goal's current generation for that child.
  SELECT c.id AS child_id, c.family_code, r.id AS reward_id, r.cost_points AS cost, r.is_bigger_goal,
         r.goal_epoch::text || ':' || COALESCE(r.goal_child_epochs->>c.id::text, '0') AS generation
  FROM children c
  JOIN rewards r
    ON r.family_code IS NOT DISTINCT FROM c.family_code
   AND (COALESCE(cardinality(r.assigned_child_ids), 0) = 0
        OR c.id::text = ANY (SELECT lower(x) FROM unnest(r.assigned_child_ids::text[]) AS x))
),
items AS (
  -- Requested rewards (the stored stack), priced from the rewards table.
  SELECT c.id AS child_id, p.reward_id, p.cost
  FROM children c
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(c.reward_stack) = 'array' THEN c.reward_stack ELSE '[]'::jsonb END) AS item
  JOIN spendable p ON p.child_id = c.id AND p.reward_id::text = item->>'rewardId'
),
stacked AS (SELECT child_id, reward_id, SUM(cost)::int AS cost FROM items GROUP BY child_id, reward_id),
stack AS (SELECT child_id, SUM(cost)::int AS reserved FROM stacked GROUP BY child_id),
counted_rows AS (
  -- The ledger rows the rule counts: the child's own bigger goal, current generation.
  SELECT v.child_id, v.reward_id, v.generation, v.delta
  FROM savings_events v
  JOIN spendable p ON p.child_id = v.child_id AND p.reward_id = v.reward_id AND p.is_bigger_goal
  WHERE v.family_code IS NOT DISTINCT FROM p.family_code
    AND v.generation = p.generation
),
saved AS (
  SELECT child_id, reward_id, SUM(delta)::int AS saved
  FROM counted_rows GROUP BY child_id, reward_id HAVING SUM(delta) > 0
),
goals AS (
  SELECT s.child_id, SUM(s.saved)::int AS saved,
         SUM(GREATEST(0, s.saved - COALESCE(k.cost, 0)))::int AS counted
  FROM saved s LEFT JOIN stacked k ON k.child_id = s.child_id AND k.reward_id = s.reward_id
  GROUP BY s.child_id
),
facts AS (
  SELECT c.id AS child_id, c.total_points,
         (COALESCE((SELECT SUM(points) FROM point_events e WHERE e.child_id = c.id), 0)
          - COALESCE((SELECT SUM(reward_cost) FROM redemptions d WHERE d.child_id = c.id AND d.status = 'Completed'), 0))::int AS history,
         COALESCE(st.reserved, 0) + COALESCE(g.counted, 0) AS committed
  FROM children c
  LEFT JOIN stack st ON st.child_id = c.id
  LEFT JOIN goals g ON g.child_id = c.id
),
ledger AS (
  -- The raw ledger: every row, per (child, goal, generation).
  SELECT child_id, reward_id, generation, SUM(delta)::int AS total
  FROM savings_events GROUP BY child_id, reward_id, generation
),
c1 AS (
  SELECT child_id FROM ledger WHERE total < 0
  UNION ALL
  SELECT child_id FROM counted_rows GROUP BY child_id HAVING SUM(delta) < 0
),
c2 AS (
  SELECT child_id FROM facts WHERE total_points IS NOT NULL AND committed > total_points
),
c3 AS (
  SELECT l.child_id
  FROM ledger l
  WHERE l.total > 0
    AND NOT EXISTS (
      SELECT 1 FROM counted_rows k
      WHERE k.child_id = l.child_id AND k.reward_id = l.reward_id AND k.generation = l.generation)
),
c4 AS (
  SELECT d.child_id
  FROM redemptions d
  JOIN savings_events s ON s.redemption_id = d.id AND s.kind = 'spend'
  JOIN spendable p ON p.child_id = d.child_id AND p.reward_id = s.reward_id
                  AND p.is_bigger_goal AND p.generation = s.generation
  WHERE d.status = 'Reversed'
    AND NOT EXISTS (SELECT 1 FROM savings_events u WHERE u.undoes = s.id)
),
c5 AS (
  SELECT child_id FROM facts WHERE total_points IS DISTINCT FROM history
),
conditions AS (
  SELECT 1 AS condition_no, 'negative saved amount' AS check_name,
         (SELECT count(*) FROM c1)::int AS offending_rows,
         (SELECT COALESCE(string_agg(id, ', ' ORDER BY id), '')
            FROM (SELECT DISTINCT child_id::text AS id FROM c1 ORDER BY 1 LIMIT 20) q) AS child_ids
  UNION ALL
  SELECT 2, 'committed more than total',
         (SELECT count(*) FROM c2)::int,
         (SELECT COALESCE(string_agg(id, ', ' ORDER BY id), '')
            FROM (SELECT DISTINCT child_id::text AS id FROM c2 ORDER BY 1 LIMIT 20) q)
  UNION ALL
  SELECT 3, 'savings not counted and not ended',
         (SELECT count(*) FROM c3)::int,
         (SELECT COALESCE(string_agg(id, ', ' ORDER BY id), '')
            FROM (SELECT DISTINCT child_id::text AS id FROM c3 ORDER BY 1 LIMIT 20) q)
  UNION ALL
  SELECT 4, 'reversed redemption, savings not put back',
         (SELECT count(*) FROM c4)::int,
         (SELECT COALESCE(string_agg(id, ', ' ORDER BY id), '')
            FROM (SELECT DISTINCT child_id::text AS id FROM c4 ORDER BY 1 LIMIT 20) q)
  UNION ALL
  SELECT 5, 'total differs from history',
         (SELECT count(*) FROM c5)::int,
         (SELECT COALESCE(string_agg(id, ', ' ORDER BY id), '')
            FROM (SELECT DISTINCT child_id::text AS id FROM c5 ORDER BY 1 LIMIT 20) q)
)
SELECT condition_no, check_name, offending_rows, child_ids
FROM (
  SELECT condition_no AS ord, condition_no, check_name, offending_rows, child_ids FROM conditions
  UNION ALL
  SELECT 6, NULL,
         CASE WHEN (SELECT SUM(offending_rows) FROM conditions) = 0
              THEN 'SAVINGS CHECK: PASS' ELSE 'SAVINGS CHECK: FAIL' END,
         (SELECT SUM(offending_rows) FROM conditions)::int,
         ''
) result
ORDER BY ord;
