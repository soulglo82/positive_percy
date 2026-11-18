// @vitest-environment node
// V1-A server contracts (docs/engineering/V1-IMPLEMENTATION-PLAN.md §8.1):
// available_points is total minus the server-priced reward stack, and the
// family streak shown at the top of Home counts goal completions, follows
// the family's local days, and is never reduced by Undo.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApp, stopApp, api, makeFamily } from './harness.js';

const hasDb = !!process.env.TEST_DATABASE_URL;
const rid = () => crypto.randomUUID();

describe.skipIf(!hasDb)('V1-A: Home server contracts', () => {
  let ctx, F;
  const call = (method, path, body, f = F) => api(ctx.base, method, path, { token: f.token, body: body ?? undefined });
  const child = async (id) => (await call('GET', '/api/children')).json.find(c => c.id === id);
  const reset = (code) => ctx.pool.query('UPDATE families SET current_streak = 0, last_active_date = NULL, longest_streak = 0 WHERE family_code = $1', [code]);

  beforeAll(async () => { ctx = await startApp(); F = await makeFamily(ctx.base, 'V1 home'); });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  describe('available_points', () => {
    it('equals total minus the stacked rewards, priced now, on every children response', async () => {
      const c = (await call('POST', '/api/children', { name: 'Avail', total_points: 50 })).json;
      expect(c.available_points).toBeUndefined(); // create returns the raw row
      expect((await child(c.id)).available_points).toBe(50);
      const r = (await call('POST', '/api/rewards', { title: 'Kite', cost_points: 20, emoji: '🪁', visible_to_child: true })).json;
      expect((await call('POST', `/api/children/${c.id}/stack/add`, { reward_id: r.id })).status).toBe(200);
      expect((await child(c.id)).available_points).toBe(30);
      // Repricing the reward changes the reservation (server-priced, not the stored stack cost).
      expect((await call('PUT', `/api/rewards/${r.id}`, { cost_points: 25 })).status).toBe(200);
      expect((await child(c.id)).available_points).toBe(25);
      // A reward hidden from this child no longer reserves points.
      const other = (await call('POST', '/api/children', { name: 'Other' })).json;
      expect((await call('PUT', `/api/rewards/${r.id}`, { assigned_child_ids: [other.id] })).status).toBe(200);
      expect((await child(c.id)).available_points).toBe(50);
    });

    it('is never negative and appears on filter and update responses too', async () => {
      const c = (await call('POST', '/api/children', { name: 'Edge', total_points: 10 })).json;
      const r = (await call('POST', '/api/rewards', { title: 'Small', cost_points: 10, emoji: '⭐', visible_to_child: true })).json;
      await call('POST', `/api/children/${c.id}/stack/add`, { reward_id: r.id });
      await ctx.pool.query('UPDATE children SET total_points = 3 WHERE id = $1', [c.id]);
      expect((await child(c.id)).available_points).toBe(0);
      const upd = await call('PUT', `/api/children/${c.id}`, { name: 'Edge 2' });
      expect(upd.status).toBe(200);
      expect(upd.json.available_points).toBe(0);
    });
  });

  describe('reward_stack_priced (review of PR #57)', () => {
    it('shows the stack at current names and costs and drops deleted rewards, matching available_points', async () => {
      const c = (await call('POST', '/api/children', { name: 'Priced', total_points: 50 })).json;
      const r = (await call('POST', '/api/rewards', { title: 'Kite', cost_points: 20, emoji: '🪁', visible_to_child: true })).json;
      await call('POST', `/api/children/${c.id}/stack/add`, { reward_id: r.id });
      await call('PUT', `/api/rewards/${r.id}`, { cost_points: 25, title: 'Big kite' });
      let got = await child(c.id);
      expect(got.reward_stack_priced).toEqual([{ rewardId: r.id, name: 'Big kite', cost: 25 }]);
      expect(got.available_points).toBe(50 - 25);
      expect((await call('DELETE', `/api/rewards/${r.id}`)).status).toBeLessThan(300);
      got = await child(c.id);
      expect(got.reward_stack_priced).toEqual([]);
      expect(got.available_points).toBe(50);
    });

    it('prices every child with one rewards query, whatever the stack sizes', async () => {
      const G = await makeFamily(ctx.base, 'Query count');
      const rewards = [];
      for (let i = 0; i < 3; i++) rewards.push((await call('POST', '/api/rewards', { title: 'R' + i, cost_points: 1, emoji: '⭐', visible_to_child: true }, G)).json);
      for (let k = 0; k < 4; k++) {
        const c = (await call('POST', '/api/children', { name: 'Q' + k, total_points: 100 }, G)).json;
        for (const r of rewards) await call('POST', `/api/children/${c.id}/stack/add`, { reward_id: r.id }, G);
      }
      const seen = [];
      const orig = ctx.pool.query.bind(ctx.pool);
      ctx.pool.query = (text, ...rest) => { if (typeof text === 'string' && /FROM rewards/.test(text)) seen.push(text); return orig(text, ...rest); };
      try {
        const list = (await call('GET', '/api/children', null, G)).json;
        expect(list.map((c) => c.available_points)).toEqual([97, 97, 97, 97]);
      } finally { ctx.pool.query = orig; }
      expect(seen).toHaveLength(1);
    });

    it('award responses carry available_points and the priced stack', async () => {
      const c = (await call('POST', '/api/children', { name: 'Awarded', total_points: 10 })).json;
      const r = (await call('POST', '/api/rewards', { title: 'Treat', cost_points: 4, emoji: '🍪', visible_to_child: true })).json;
      await call('POST', `/api/children/${c.id}/stack/add`, { reward_id: r.id });
      const id = rid();
      const a = await call('POST', `/api/children/${c.id}/award`, { points: 2, category: 'Kindness', request_id: id });
      expect(a.status).toBe(200);
      expect(a.json.child.available_points).toBe(12 - 4);
      expect(a.json.child.reward_stack_priced).toHaveLength(1);
      // A replay (first reply lost) answers with the child as it is now.
      const again = await call('POST', `/api/children/${c.id}/award`, { points: 2, category: 'Kindness', request_id: id });
      expect(again.json.duplicate).toBe(true);
      expect(again.json.child.available_points).toBe(8);
    });
  });

  describe('family streak', () => {
    it('a Today\'s Goal completion starts the streak like an award', async () => {
      const G = await makeFamily(ctx.base, 'Streak goals');
      await reset(G.code);
      const c = (await call('POST', '/api/children', { name: 'S' }, G)).json;
      const cat = (await call('GET', '/api/behavior-categories', null, G)).json[0];
      const today = (await call('GET', '/api/todays-goals', null, G)).json.date;
      const g = (await call('POST', '/api/todays-goals', { title: 'Do it', child_id: c.id, category_id: cat.id, schedule_kind: 'one_off', scheduled_date: today }, G)).json;
      const done = await call('POST', `/api/todays-goals/${g.id}/complete`, { request_id: rid() }, G);
      expect(done.status).toBe(200);
      expect(done.json.streak.streak).toBe(1);
      expect((await call('GET', '/api/family/streak', null, G)).json).toMatchObject({ streak: 1, longest: 1 });
    });

    it('Undo never reduces the streak (no punitive reset)', async () => {
      const c = (await call('POST', '/api/children', { name: 'U' })).json;
      await reset(F.code);
      const a = await call('POST', `/api/children/${c.id}/award`, { points: 1, category: 'Kindness', request_id: rid() });
      expect(a.json.streak.streak).toBe(1);
      expect((await call('POST', `/api/point-events/${a.json.event.id}/undo`, { request_id: rid() })).status).toBe(200);
      expect((await call('GET', '/api/family/streak')).json.streak).toBe(1);
    });

    it('reads in the family\'s local days: yesterday (local) keeps it live, two days ago reads 0', async () => {
      const { rows: [d] } = await ctx.pool.query(
        "SELECT to_char((NOW() AT TIME ZONE 'Pacific/Kiritimati')::date - 1, 'YYYY-MM-DD') y, to_char((NOW() AT TIME ZONE 'Pacific/Kiritimati')::date - 2, 'YYYY-MM-DD') y2");
      await ctx.pool.query("UPDATE families SET timezone='Pacific/Kiritimati', current_streak=6, longest_streak=6, last_active_date=$2 WHERE family_code=$1", [F.code, d.y]);
      expect((await call('GET', '/api/family/streak')).json.streak).toBe(6);
      await ctx.pool.query('UPDATE families SET last_active_date=$2 WHERE family_code=$1', [F.code, d.y2]);
      expect((await call('GET', '/api/family/streak')).json).toMatchObject({ streak: 0, longest: 6 });
    });
  });
});
