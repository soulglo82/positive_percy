// Review-pack capture (docs/engineering/evidence/v1-integrated/README.md).
// Seeds a SYNTHETIC family through the public API of a locally started app
// and photographs every main screen at 320, 390, 834 and 1280 px.
//   node capture.cjs <out dir> [base url]
// Start the app first on a NEW throwaway database (see run.sh). Never point
// this at a real deployment: it creates families.
const { chromium } = require('playwright');
const crypto = require('crypto');
const out = process.argv[2];
const base = process.argv[3] || 'http://localhost:3311';
const WIDTHS = [[320, 568], [390, 844], [834, 1194], [1280, 900]];
(async () => {
  const api = async (m, p, b, t) => {
    const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined });
    if (!r.ok) throw new Error(`${m} ${p} ${r.status} ${await r.text()}`);
    return r.json();
  };
  const rid = () => crypto.randomUUID();
  const fam = await api('POST', '/api/family/create', { family_name: 'The Evidence Family', timezone: 'Europe/London' });
  const t = fam.token;
  // Lara ends as the approved design shows her: 90 ready to use, 120 saved
  // towards the bigger goal, one reward asked for.
  const lara = await api('POST', '/api/children', { name: 'Lara', age: 9, weekly_target: 25, total_points: 232 }, t);
  const omar = await api('POST', '/api/children', { name: 'Omar', age: 7, weekly_target: 20, total_points: 40 }, t);
  await api('POST', '/api/children', { name: 'Joud', age: 5, weekly_target: 20, total_points: 8 }, t);
  await api('POST', `/api/children/${lara.id}/award`, { points: 16, category: 'Helping', request_id: rid() }, t);
  const R = (b) => api('POST', '/api/rewards', { visible_to_child: true, ...b }, t);
  const movie = await R({ title: 'Movie night', cost_points: 25, emoji: '🎬', icon_key: 'streamline:plump:duo:images-photography:film-slate' });
  const ice = await R({ title: 'Ice cream treat', cost_points: 15, emoji: '🍦', icon_key: 'streamline:plump:duo:food-drink:ice-cream-2' });
  await R({ title: 'Gaming time', cost_points: 20, emoji: '🎮', icon_key: 'streamline:plump:duo:computer-devices:controller-1' });
  const bike = await R({ title: 'New bike', cost_points: 300, emoji: '🚲', icon_key: 'streamline:plump:duo:map-travel:bicycle-bike', is_bigger_goal: true });
  await api('POST', `/api/children/${lara.id}/stack/add`, { reward_id: movie.id }, t);
  for (const n of ['Learning', 'Helping', 'Reading']) await api('POST', '/api/behavior-categories', { name: n, icon: '⭐', icon_key: n.toLowerCase(), points: 1 }, t).catch((e) => console.error('category', e.message));
  const cats = await api('GET', '/api/behavior-categories', null, t);
  const cat = (n) => (cats.find((c) => c.name === n) || cats[0]).id;
  const today = (await api('GET', '/api/todays-goals', null, t)).date;
  const G = (b) => api('POST', '/api/todays-goals', { child_id: lara.id, ...b }, t);
  const g1 = await G({ title: 'Finish homework', category_id: cat('Learning'), schedule_kind: 'one_off', scheduled_date: today });
  const g2 = await G({ title: 'Help set the table', category_id: cat('Helping'), schedule_kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6, 7] });
  // Every day, so one goal is still to do whatever day the pack is made.
  await G({ title: 'Read for 15 minutes', category_id: cat('Reading'), schedule_kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6, 7] });
  for (const g of [g1, g2]) await api('POST', `/api/todays-goals/${(g.goal || g).id}/complete`, { request_id: rid() }, t);
  await api('POST', `/api/children/${omar.id}/award`, { points: 1, category: 'Kindness', note: 'Helped a friend', request_id: rid() }, t);
  await api('POST', `/api/children/${lara.id}/redeem`, { reward_id: ice.id, request_id: rid() }, t);
  await api('POST', `/api/children/${lara.id}/savings/save`, { reward_id: bike.id, points: 120, request_id: rid() }, t);
  const now = (await api('GET', '/api/children', null, t)).find((c) => c.id === lara.id);
  console.log(`Lara: total ${now.total_points}, available ${now.available_points}, saved ${now.saved_total}, week ${now.week_points}`);
  const empty = await api('POST', '/api/family/create', { family_name: 'The Empty Family', timezone: 'Europe/London' });

  const b = await chromium.launch();
  const login = async (p, f) => {
    await p.goto(base + '/');
    await p.evaluate(([c, tk]) => { localStorage.setItem('positive_percy_family_code', c); localStorage.setItem('positive_percy_token', tk); localStorage.setItem('percy_onboarding_done', 'true'); }, [f.family_code, f.token]);
  };
  // A whole page is photographed by growing the window to the page's height,
  // so the fixed bottom navigation sits at the bottom, not across the middle.
  const snap = async (p, n, w, full = false) => {
    await p.waitForTimeout(450);
    const size = p.viewportSize();
    if (full) {
      const height = await p.evaluate(() => document.documentElement.scrollHeight);
      await p.setViewportSize({ width: size.width, height: Math.max(size.height, height) });
      await p.waitForTimeout(150);
    }
    await p.screenshot({ path: `${out}/${n}-${w}.png` });
    if (full) await p.setViewportSize(size);
  };
  const pages = [['home', '/'], ['children', '/children?child=' + lara.id], ['childview', '/childview?child=' + lara.id], ['activity', '/activity'], ['rewards', '/rewards'], ['settings', '/parentprofile']];
  for (const [w, h] of WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await login(p, fam);
    for (const [n, path] of pages) { await p.goto(base + path); await p.waitForLoadState('networkidle'); await snap(p, n, w, true); }
    await p.goto(base + '/'); await p.waitForLoadState('networkidle');
    await p.getByRole('button', { name: /^Rewards$/ }).click(); await snap(p, 'home-rewards-dialog', w);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.getByRole('button', { name: /^Award points/ }).first().click(); await snap(p, 'award', w);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.getByRole('button', { name: 'Manage goals for Lara' }).click(); await snap(p, 'goalsmanage', w);
    await p.getByRole('dialog').getByRole('button', { name: 'Add goal' }).click(); await snap(p, 'goalform', w);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.goto(base + '/rewards'); await p.waitForLoadState('networkidle');
    await p.getByRole('button', { name: /New reward/ }).click(); await snap(p, 'rewardform', w);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.goto(base + '/children?child=' + lara.id); await p.waitForLoadState('networkidle');
    await p.getByRole('button', { name: 'Edit saving for something bigger for Lara' }).click(); await snap(p, 'savings-dialog', w);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.evaluate(() => { sessionStorage.setItem('percy_e2e_show_onboarding', '1'); localStorage.removeItem('percy_onboarding_done'); });
    await p.goto(base + '/'); await p.waitForLoadState('networkidle'); await snap(p, 'onboarding', w);
    await ctx.close();
    const ctx2 = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const p2 = await ctx2.newPage();
    await login(p2, empty);
    await p2.goto(base + '/'); await p2.waitForLoadState('networkidle'); await snap(p2, 'welcome', w, true);
    await ctx2.close();
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
