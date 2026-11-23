// Whether a reward is for a child: no assignment means every child. Ids are
// compared in lower case: rewards saved before the server lower-cased
// assignments may hold capitals (code review of PR #60, C1).
export function isAssignedTo(reward, childId) {
  const ids = reward?.assigned_child_ids;
  if (!ids || ids.length === 0) return true;
  if (!childId) return false;
  const want = String(childId).toLowerCase();
  return ids.some((x) => String(x).toLowerCase() === want);
}
