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
  const ageNum = Number(form.age);

  return {
    name: typeof form.name === 'string' ? form.name.trim() : form.name,
    avatar_url: form.avatar_url || '',
    weekly_target: Number(form.weeklyTarget) || 50,
    total_points: startingPoints,
    weekly_points: startingPoints,
    age: Number.isFinite(ageNum) && ageNum > 0 ? ageNum : null,
    last_reset_date: new Date().toISOString().split('T')[0],
  };
}
