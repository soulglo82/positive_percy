// Single mapping layer between the Add Child form (camelCase) and the children
// table columns (snake_case). Every Add Child entry point (Home dashboard and
// Parent profile) builds its create payload through this helper so that every
// field the form collects round-trips consistently — instead of one call site
// mapping correctly while another sends raw camelCase and trips the server's
// column guard.

export function buildChildCreatePayload(form = {}) {
  // startingPoints seeds the child's spendable balance (total_points, shown on
  // the child card) and their weekly progress. Applied once, here, at creation.
  const startingPoints = Number(form.startingPoints) || 0;
  // children.age is an INTEGER column: truncate to a whole number so values
  // like 7.5 don't fail the insert or store an unintended coerced value.
  const ageNum = Number(form.age);
  const age = Number.isFinite(ageNum) && ageNum > 0 ? Math.trunc(ageNum) : null;

  return {
    name: typeof form.name === 'string' ? form.name.trim() : form.name,
    avatar_url: form.avatar_url || '',
    weekly_target: Number(form.weeklyTarget) || 50,
    total_points: startingPoints,
    weekly_points: startingPoints,
    age,
    last_reset_date: new Date().toISOString().split('T')[0],
  };
}
