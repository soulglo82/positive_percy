// A realistic copy of existing family data for the D1 migration proof
// (docs/engineering/D1-SAVINGS-LEDGER-DESIGN.md §11). Built through the real
// API where the API still exists, and by direct SQL for shapes only older
// releases could write. Every kind of record a family can have today is
// present, including the awkward ones:
//   - several children per family; a zero balance; a large balance
//   - awards, an undone award (Undo), a same-week correction
//   - Today's Goals with a completion (its ledger row is an award)
//   - spends: completed, undone (Reversed), and legacy Pending / Denied
//   - pending requests (reward stack), including one for a reward since
//     deleted and one for a reward reassigned to a sibling
//   - rewards with emoji, image_url, a picker icon, hidden, assigned
//   - legacy point_events and redemptions with a NULL family_code
//   - legacy family_goals with contributions (active and completed)
//   - a family that only ever used family goals
import crypto from 'node:crypto';
import { api, makeFamily } from '../harness.js';

const rid = () => crypto.randomUUID();

export async function seedLegacyFamilies(ctx) {
  const call = (F, method, path, body) => api(ctx.base, method, path, { token: F.token, body: body ?? undefined });
  const must = async (p, what) => { const r = await p; if (r.status >= 300) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.json)}`); return r.json; };

  // ── Family A: the busy household ─────────────────────────────────────────
  const A = await makeFamily(ctx.base, 'Legacy A');
  const lara = await must(call(A, 'POST', '/api/children', { name: 'Lara', age: 9, weekly_target: 25 }), 'lara');
  const omar = await must(call(A, 'POST', '/api/children', { name: 'Omar', age: 7, weekly_target: 20 }), 'omar');
  const joud = await must(call(A, 'POST', '/api/children', { name: 'Joud', age: 5, weekly_target: 20 }), 'joud'); // stays at 0
  const award = (F, c, points, category = 'Kindness') => must(call(F, 'POST', `/api/children/${c.id}/award`, { points, category, request_id: rid() }), 'award');
  for (let i = 0; i < 6; i++) await award(A, lara, 10, i % 2 ? 'Helpfulness' : 'Kindness');
  for (let i = 0; i < 3; i++) await award(A, omar, 5, 'Homework');
  const mistake = await award(A, omar, 7, 'Bravery');
  await must(call(A, 'POST', `/api/point-events/${mistake.event.id}/undo`, { request_id: rid() }), 'undo award');
  const toCorrect = await award(A, lara, 4, 'Caring');
  await must(call(A, 'POST', `/api/point-events/${toCorrect.event.id}/correct`, { request_id: rid() }), 'correct award');

  const reward = (F, body) => must(call(F, 'POST', '/api/rewards', { visible_to_child: true, emoji: '🎁', ...body }), 'reward');
  const movie = await reward(A, { title: 'Movie night', cost_points: 25, emoji: '🎬', icon_key: 'phosphor:film-slate:duotone' });
  const icecream = await reward(A, { title: 'Ice cream', cost_points: 15, emoji: '🍦' });
  const bike = await reward(A, { title: 'New bike', cost_points: 300, emoji: '🚲' }); // a future bigger goal; NOT designated by the migration
  const secret = await reward(A, { title: 'Surprise', cost_points: 8, visible_to_child: false, image_url: '/uploads/legacy-surprise.png' });
  const doomed = await reward(A, { title: 'Discontinued', cost_points: 6 });
  const laraOnly = await reward(A, { title: 'Lara only', cost_points: 3, assigned_child_ids: [lara.id] });

  // Spends: one kept, one undone.
  await must(call(A, 'POST', `/api/children/${lara.id}/redeem`, { reward_id: icecream.id, request_id: rid() }), 'spend');
  const undone = await must(call(A, 'POST', `/api/children/${omar.id}/redeem`, { reward_id: secret.id, request_id: rid() }), 'spend 2');
  await must(call(A, 'POST', `/api/redemptions/${undone.redemption.id}/undo`, { request_id: rid() }), 'undo spend');

  // Requests (reward stack): one live, one for a reward then deleted, one
  // for a reward then reassigned away from the child.
  await must(call(A, 'POST', `/api/children/${lara.id}/stack/add`, { reward_id: movie.id }), 'stack movie');
  await must(call(A, 'POST', `/api/children/${lara.id}/stack/add`, { reward_id: doomed.id }), 'stack doomed');
  await must(call(A, 'POST', `/api/children/${lara.id}/stack/add`, { reward_id: laraOnly.id }), 'stack lara-only');
  await must(call(A, 'DELETE', `/api/rewards/${doomed.id}`), 'delete reward');
  await must(call(A, 'PUT', `/api/rewards/${laraOnly.id}`, { assigned_child_ids: [omar.id] }), 'reassign reward');

  // Today's Goals: a goal and a completion (an award row in the ledger).
  const cats = await must(call(A, 'GET', '/api/behavior-categories'), 'categories');
  const { date } = await must(call(A, 'GET', '/api/todays-goals'), 'goals day');
  const goal = await must(call(A, 'POST', '/api/todays-goals', { title: 'Read', child_id: omar.id, category_id: cats[0].id, schedule_kind: 'one_off', scheduled_date: date }), 'goal');
  await must(call(A, 'POST', `/api/todays-goals/${goal.id}/complete`, { request_id: rid() }), 'complete goal');

  // Legacy family goals with contributions (the old screen's free counter).
  const holiday = await must(call(A, 'POST', '/api/family_goals', { title: 'Family holiday', target_points: 500, emoji: '🏖️' }), 'family goal');
  await must(call(A, 'POST', `/api/family-goals/${holiday.id}/contribute`, { points: 120 }), 'contribute');
  const zoo = await must(call(A, 'POST', '/api/family_goals', { title: 'Zoo trip', target_points: 50 }), 'family goal 2');
  await must(call(A, 'POST', `/api/family-goals/${zoo.id}/contribute`, { points: 80 }), 'contribute to completion');

  // ── Family B: older data, written before family_code was stamped ─────────
  const B = await makeFamily(ctx.base, 'Legacy B');
  const sam = await must(call(B, 'POST', '/api/children', { name: 'Sam', age: 11, weekly_target: 40 }), 'sam');
  for (let i = 0; i < 4; i++) await award(B, sam, 25, 'Chores');
  // A legacy award with no family_code, kept in step with the balance (A2 C4).
  await ctx.pool.query("INSERT INTO point_events (child_id, points, category, child_name, family_code, kind) VALUES ($1, 900, 'Starting points', 'Sam', NULL, 'award')", [sam.id]);
  await ctx.pool.query('UPDATE children SET total_points = total_points + 900 WHERE id = $1', [sam.id]);
  const book = await reward(B, { title: 'Book', cost_points: 40 });
  const mountainBike = await reward(B, { title: 'Mountain bike', cost_points: 300, emoji: '🚵' }); // not designated by the migration
  // Legacy redemptions: Pending and Denied never touched the balance.
  for (const status of ['Pending', 'Denied']) {
    await ctx.pool.query(
      'INSERT INTO redemptions (child_id, child_name, reward_id, reward_title, reward_cost, status, family_code) VALUES ($1, $2, $3, $4, $5, $6, NULL)',
      [sam.id, 'Sam', book.id, 'Book', 40, status]);
  }
  await must(call(B, 'POST', `/api/children/${sam.id}/redeem`, { reward_id: book.id, request_id: rid() }), 'spend B');

  // ── Family C: only ever used the old family goals screen ─────────────────
  const C = await makeFamily(ctx.base, 'Legacy C');
  const fg = await must(call(C, 'POST', '/api/family_goals', { title: 'Camping', target_points: 200 }), 'family goal C');
  await must(call(C, 'POST', `/api/family-goals/${fg.id}/contribute`, { points: 60 }), 'contribute C');

  // ── Shapes only older releases could write (reward_stack was once
  // client-writable; family_code was once unstamped) ────────────────────────
  const { rows: [ghost] } = await ctx.pool.query(
    "INSERT INTO children (name, total_points, weekly_target, family_code, reward_stack, points_spent) VALUES ('Legacy NULL stack', 12, 20, $1, NULL, NULL) RETURNING id", [B.code]);
  await ctx.pool.query("INSERT INTO point_events (child_id, points, category, child_name, family_code, kind) VALUES ($1, 12, 'Starting points', 'Legacy NULL stack', $2, 'award')", [ghost.id, B.code]);
  const { rows: [odd] } = await ctx.pool.query(
    `INSERT INTO children (name, total_points, weekly_target, family_code, reward_stack) VALUES ('Legacy odd stack', 9, 20, $1, $2::jsonb) RETURNING id`,
    [B.code, JSON.stringify({ rewardId: book.id, cost: 1 })]); // an object, not an array
  await ctx.pool.query("INSERT INTO point_events (child_id, points, category, child_name, family_code, kind) VALUES ($1, 9, 'Starting points', 'Legacy odd stack', $2, 'award')", [odd.id, B.code]);
  // Stack items naming a non-UUID id, an upper-case id, and another family's reward.
  await ctx.pool.query("UPDATE children SET reward_stack = reward_stack || $2::jsonb WHERE id = $1",
    [sam.id, JSON.stringify([{ rewardId: 'not-a-uuid', name: 'X', cost: 1 }, { rewardId: book.id.toUpperCase(), name: 'Book', cost: 40 }, { rewardId: movie.id, name: 'Movie night', cost: 25 }])]);
  // A reward with no family_code, an upload and a user row.
  await ctx.pool.query("INSERT INTO rewards (title, cost_points, emoji, family_code) VALUES ('Orphan reward', 5, '🎈', NULL)");
  await ctx.pool.query("INSERT INTO uploads (data, content_type) VALUES ($1, 'image/png')", ['iVBORw0KGgo' + 'A'.repeat(4000)]);
  await ctx.pool.query("INSERT INTO users (email, full_name, family_code) VALUES ('legacy-parent@example.invalid', 'Legacy Parent', $1)", [A.code]);

  return { A, B, C, children: { lara, omar, joud, sam }, rewards: { movie, icecream, bike, secret, laraOnly, book, mountainBike } };
}
