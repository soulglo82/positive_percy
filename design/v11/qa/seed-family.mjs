// Seeds a fictional review family into a LOCAL Percy server (never production)
// and prints {code, token, ids} as JSON. Used by design/v11/qa/run-app-qa.mjs.
//   node design/v11/qa/seed-family.mjs http://localhost:3301 [variant]
// variant: "full" (default): three children, goals, a bigger goal with savings,
//          a chosen reward; "six": six children incl. a long name; "empty": one
//          child with nothing set up.
import crypto from 'node:crypto';

export async function seed(base, variant = 'full') {
  const host = new URL(base).hostname;
  if (!['localhost', '127.0.0.1'].includes(host)) throw new Error('seed-family only runs against a local server');
  const api = async (method, path, body, token) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${text}`);
    return text ? JSON.parse(text) : null;
  };
  const fam = await api('POST', '/api/family/create', { family_name: 'The Sample Family', timezone: 'Asia/Singapore' });
  const t = fam.token;
  const kid = (name, age, weekly_target, total_points) => api('POST', '/api/children', { name, age, weekly_target, total_points }, t);
  const award = (c, points, category) => api('POST', `/api/children/${c.id}/award`, { points, category, request_id: crypto.randomUUID() }, t);
  const out = { code: fam.family_code, token: t, children: [] };

  if (variant === 'many-goals') {
    // Codex review of PR #72: one dot per goal must not widen the page.
    const kidA = await kid('Lara', 9, 30, 0);
    out.children.push(kidA);
    const cats0 = await api('GET', '/api/behavior-categories', null, t);
    const day = (await api('GET', '/api/todays-goals', null, t)).date;
    for (let i = 0; i < 20; i++) await api('POST', '/api/todays-goals', { title: `Goal ${i + 1}`, child_id: kidA.id, category_id: cats0[0].id, schedule_kind: 'one_off', scheduled_date: day }, t);
    return out;
  }
  if (variant === 'empty') {
    out.children.push(await kid('Joud', 4, 10, 0));
    return out;
  }
  const lara = await kid('Lara', 9, 30, 120);
  const omar = await kid('Omar', 6, 20, 40);
  const joud = await kid('Joud', 4, 15, 12);
  out.children.push(lara, omar, joud);
  if (variant === 'six') {
    out.children.push(await kid('Alexandra-Josephine Montgomery-Wellington', 11, 20, 1000));
    out.children.push(await kid('Sam', 7, 10, 0));
    out.children.push(await kid('Noor', 2, 5, 3));
  }
  for (const [c, p, cat] of [[lara, 10, 'Kindness'], [lara, 12, 'Homework'], [lara, 12, 'Helpfulness'], [omar, 5, 'Caring']]) await award(c, p, cat);

  const cats = await api('GET', '/api/behavior-categories', null, t);
  const today = (await api('GET', '/api/todays-goals', null, t)).date;
  const goal = (c, title, i) => api('POST', '/api/todays-goals', { title, child_id: c.id, category_id: cats[i % cats.length].id, schedule_kind: 'one_off', scheduled_date: today }, t);
  const g1 = await goal(lara, 'Finish homework', 0);
  await goal(lara, 'Help set the table', 1);
  await goal(lara, 'Read for 15 minutes', 2);
  await goal(omar, 'Tidy toys away', 1);
  await api('POST', `/api/todays-goals/${g1.id}/complete`, { request_id: crypto.randomUUID() }, t).catch(() => {});

  await api('POST', '/api/rewards', { title: 'Screen time, 30 minutes', cost_points: 20, emoji: '📱', visible_to_child: true }, t);
  await api('POST', '/api/rewards', { title: 'Movie night', cost_points: 25, emoji: '🎬', visible_to_child: true }, t);
  const bike = await api('POST', '/api/rewards', { title: 'New bike', cost_points: 300, emoji: '🚲', visible_to_child: true, is_bigger_goal: true }, t);
  await api('POST', '/api/rewards', { title: 'Trip to the aquarium', cost_points: 150, emoji: '🐠', visible_to_child: true, is_bigger_goal: true }, t);
  await api('POST', `/api/children/${lara.id}/savings/save`, { reward_id: bike.id, points: 60, request_id: crypto.randomUUID() }, t);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed(process.argv[2] || 'http://localhost:3301', process.argv[3]).then((r) => console.log(JSON.stringify(r)));
}
