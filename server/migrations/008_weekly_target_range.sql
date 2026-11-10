-- A2 E3: weekly targets are whole numbers from 1 to 10,000. Bring any stored
-- value outside that range inside it, so editing such a child never fails.
UPDATE children SET weekly_target = LEAST(10000, GREATEST(1, weekly_target))
WHERE weekly_target IS NOT NULL AND (weekly_target < 1 OR weekly_target > 10000);
