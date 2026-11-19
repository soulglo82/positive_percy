// @vitest-environment node
// V1-D, owner decision D2 (docs/engineering/V1-D-DESIGN.md §2, §6): rewards
// may store one of the 71 approved picker icons in a nullable icon_key. The
// route and the database both refuse anything else; legacy rewards are left
// exactly as they were; requests are confirmed only by a parent.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApp, stopApp, api, makeFamily } from './harness.js';
import { runMigrations } from '../migrate.js';
import fs from 'node:fs';
import path from 'node:path';
const REGISTER_IDS = [...new Set(Object.values(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../design/stage1/APPROVAL_REGISTER.json'), 'utf8')).picker.categories).flatMap((c) => c.asset_ids))];

const hasDb = !!process.env.TEST_DATABASE_URL;
const rid = () => crypto.randomUUID();
const GIFT = 'phosphor:gift:duotone';
const PIZZA = 'phosphor:pizza:duotone';

describe.skipIf(!hasDb)('V1-D: reward icon_key (D2)', () => {
  let ctx, F, G;
  const call = (method, path, body, f = F) => api(ctx.base, method, path, { token: f.token, body: body ?? undefined });
  const reward = (body, f = F) => call('POST', '/api/rewards', { title: 'R', cost_points: 5, emoji: '🍕', visible_to_child: true, ...body }, f);

  beforeAll(async () => {
    ctx = await startApp();
    F = await makeFamily(ctx.base, 'Rewards D2');
    G = await makeFamily(ctx.base, 'Other family D2');
  });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  it('S1: an approved icon is stored and returned', async () => {
    const r = await reward({ icon_key: GIFT });
    expect(r.status).toBe(200); // this API answers creates with 200
    expect(r.json.icon_key).toBe(GIFT);
    const list = (await call('GET', '/api/rewards')).json;
    expect(list.find((x) => x.id === r.json.id).icon_key).toBe(GIFT);
  });

  it('S2/S3: anything outside the 71 is refused and nothing is stored', async () => {
    const before = (await call('GET', '/api/rewards')).json.length;
    for (const bad of ['phosphor:gear:duotone', 'gift', '', 42, [GIFT], 'phosphor:gift:regular', ' phosphor:gift:duotone']) {
      const r = await reward({ title: 'Bad ' + JSON.stringify(bad), icon_key: bad });
      expect(r.status, JSON.stringify(bad)).toBe(422);
      expect(r.json.error).toBe('Choose one of the icons shown'); // the shipped icon message
    }
    expect((await call('GET', '/api/rewards')).json.length).toBe(before);
  });

  it('S4/S5: null clears it; an update without icon_key leaves it and every other field alone', async () => {
    const r = (await reward({ icon_key: PIZZA, image_url: null, assigned_child_ids: [] })).json;
    const cleared = await call('PUT', `/api/rewards/${r.id}`, { icon_key: null });
    expect(cleared.status).toBe(200);
    expect(cleared.json.icon_key).toBeNull();
    const renamed = (await call('PUT', `/api/rewards/${r.id}`, { title: 'Pizza night' })).json;
    expect(renamed).toMatchObject({ icon_key: null, emoji: '🍕', cost_points: 5, title: 'Pizza night' });
    const bad = await call('PUT', `/api/rewards/${r.id}`, { icon_key: 'nope' });
    expect(bad.status).toBe(422);
  });

  it('S6: the database itself refuses an unapproved icon', async () => {
    const r = (await reward({})).json;
    await expect(ctx.pool.query("UPDATE rewards SET icon_key = 'x' WHERE id = $1", [r.id])).rejects.toThrow(/rewards_icon_key_approved/);
    await ctx.pool.query('UPDATE rewards SET icon_key = $2 WHERE id = $1', [r.id, GIFT]);
  });

  it('S8/S9: another family cannot set it; other tables drop the field', async () => {
    const r = (await reward({})).json;
    expect((await call('PUT', `/api/rewards/${r.id}`, { icon_key: GIFT }, G)).status).toBe(404);
    const c = (await call('POST', '/api/children', { name: 'Kid', icon_key: GIFT })).json;
    expect(c.icon_key).toBeUndefined();
  });

  it('S7: migration 015 changes no existing reward, redemption or stack', async () => {
    // Put the database back to "before 015", with legacy data in place.
    const kid = (await call('POST', '/api/children', { name: 'Legacy kid', total_points: 40 })).json;
    const legacy = (await reward({ title: 'Legacy pizza', emoji: '🍕', image_url: null, cost_points: 7, assigned_child_ids: [kid.id] })).json;
    await call('POST', `/api/children/${kid.id}/stack/add`, { reward_id: legacy.id });
    await ctx.pool.query('ALTER TABLE rewards DROP CONSTRAINT rewards_icon_key_approved');
    await ctx.pool.query('ALTER TABLE rewards DROP COLUMN icon_key');
    await ctx.pool.query("DELETE FROM schema_migrations WHERE name = '015_reward_icon_key.sql'");
    const snap = async () => ({
      rewards: (await ctx.pool.query('SELECT id, title, description, cost_points, image_url, emoji, visible_to_child, assigned_child_ids, family_code, created_date FROM rewards ORDER BY id')).rows,
      redemptions: (await ctx.pool.query('SELECT * FROM redemptions ORDER BY id')).rows,
      stacks: (await ctx.pool.query('SELECT id, reward_stack, total_points FROM children ORDER BY id')).rows,
    });
    const before = await snap();
    await runMigrations(ctx.pool, { log: () => {} });
    expect(await snap()).toEqual(before);
    const { rows } = await ctx.pool.query('SELECT count(*)::int AS n FROM rewards WHERE icon_key IS NOT NULL');
    expect(rows[0].n).toBe(0); // no icon assigned automatically (D2, D3)
    // The constraint is back.
    await expect(ctx.pool.query("UPDATE rewards SET icon_key = 'x' WHERE id = $1", [legacy.id])).rejects.toThrow(/rewards_icon_key_approved/);
  });

  it('migration 015 is safe to run again on a database that already has it', async () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '../migrations/015_reward_icon_key.sql'), 'utf8');
    await ctx.pool.query(sql);
    await ctx.pool.query(sql);
    const { rows } = await ctx.pool.query("SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'rewards_icon_key_approved'");
    expect(rows[0].n).toBe(1);
  });

  it('the CHECK list is exactly the 71 picker icons', async () => {
    const { rows } = await ctx.pool.query(
      "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'rewards_icon_key_approved'");
    const inDb = new Set([...rows[0].def.matchAll(/'(phosphor:[a-z0-9-]+:duotone)'/g)].map((m) => m[1]));
    expect(inDb.size).toBe(71);
    expect([...inDb].sort()).toEqual([...REGISTER_IDS].sort()); // against the register itself
  });

  it('the export and the priced stack carry the icon', async () => {
    const kid = (await call('POST', '/api/children', { name: 'Stacker', total_points: 50 })).json;
    const r = (await reward({ title: 'Iconic', icon_key: PIZZA })).json;
    await call('POST', `/api/children/${kid.id}/stack/add`, { reward_id: r.id });
    const child = (await call('GET', '/api/children')).json.find((c) => c.id === kid.id);
    expect(child.reward_stack_priced).toEqual([expect.objectContaining({ rewardId: r.id, icon_key: PIZZA, emoji: '🍕', image_url: null })]);
    const exp = await call('GET', '/api/family/export');
    expect(exp.json.rewards.find((x) => x.id === r.id).icon_key).toBe(PIZZA);
  });

  it('C1/C2: a parent removes one request and agrees to the rest once', async () => {
    const kid = (await call('POST', '/api/children', { name: 'Asker', total_points: 30 })).json;
    const a = (await reward({ title: 'A', cost_points: 5 })).json;
    const b = (await reward({ title: 'B', cost_points: 8 })).json;
    await call('POST', `/api/children/${kid.id}/stack/add`, { reward_id: a.id });
    await call('POST', `/api/children/${kid.id}/stack/add`, { reward_id: b.id });
    expect((await call('DELETE', `/api/children/${kid.id}/stack/0?reward_id=${a.id}`)).status).toBe(200);
    const id = rid();
    const expected = [{ reward_id: b.id, stack_index: 0 }];
    const ok = await call('POST', `/api/children/${kid.id}/stack/confirm`, { request_id: id, expected });
    expect(ok.status).toBe(200);
    expect(ok.json).toMatchObject({ confirmed_count: 1, points_deducted: 8 });
    expect(ok.json.redemption_ids).toHaveLength(1);
    const again = await call('POST', `/api/children/${kid.id}/stack/confirm`, { request_id: id, expected });
    expect(again.json.duplicate).toBe(true);
    expect(again.json.redemption_ids).toEqual(ok.json.redemption_ids);
    const { rows } = await ctx.pool.query('SELECT reward_title FROM redemptions WHERE child_id = $1', [kid.id]);
    expect(rows.map((r) => r.reward_title)).toEqual(['B']);
    const after = (await call('GET', '/api/children')).json.find((c) => c.id === kid.id);
    expect(after.total_points).toBe(22);
    expect(after.reward_stack).toEqual([]);
  });

  it('C4: "Not now" uses the stored position, and refuses if the stack changed', async () => {
    const kid = (await call('POST', '/api/children', { name: 'Shifter', total_points: 50 })).json;
    const gone = (await reward({ title: 'Gone', cost_points: 1 })).json;
    const keep = (await reward({ title: 'Keep', cost_points: 2 })).json;
    const drop = (await reward({ title: 'Drop', cost_points: 3 })).json;
    for (const r of [gone, keep, drop]) await call('POST', `/api/children/${kid.id}/stack/add`, { reward_id: r.id });
    await call('DELETE', `/api/rewards/${gone.id}`);
    const priced = (await call('GET', '/api/children')).json.find((c) => c.id === kid.id).reward_stack_priced;
    // The deleted reward is hidden, but positions are the stored ones.
    expect(priced.map((p) => [p.name, p.stackIndex])).toEqual([['Keep', 1], ['Drop', 2]]);
    // The stored stack keeps its original three fields.
    const { rows } = await ctx.pool.query('SELECT reward_stack FROM children WHERE id = $1', [kid.id]);
    expect(Object.keys(rows[0].reward_stack[1]).sort()).toEqual(['cost', 'name', 'rewardId']);
    // A stale view (wrong reward at that position) removes nothing.
    expect((await call('DELETE', `/api/children/${kid.id}/stack/1?reward_id=${drop.id}`)).status).toBe(409);
    const ok = await call('DELETE', `/api/children/${kid.id}/stack/2?reward_id=${drop.id}`);
    expect(ok.status).toBe(200);
    const left = (await call('GET', '/api/children')).json.find((c) => c.id === kid.id).reward_stack_priced;
    expect(left.map((p) => p.name)).toEqual(['Keep']);
  });

  it('C5: confirm charges only what the parent saw; a request added meanwhile makes it refuse', async () => {
    const kid = (await call('POST', '/api/children', { name: 'Late', total_points: 50 })).json;
    const a = (await reward({ title: 'A1', cost_points: 5 })).json;
    const b = (await reward({ title: 'B1', cost_points: 6 })).json;
    await call('POST', `/api/children/${kid.id}/stack/add`, { reward_id: a.id });
    const saw = [{ reward_id: a.id, stack_index: 0 }];
    await call('POST', `/api/children/${kid.id}/stack/add`, { reward_id: b.id }); // added while the dialog was open
    const r = await call('POST', `/api/children/${kid.id}/stack/confirm`, { request_id: rid(), expected: saw });
    expect(r.status).toBe(409);
    expect((await call('GET', '/api/children')).json.find((c) => c.id === kid.id).total_points).toBe(50);
    for (const bad of [undefined, [], [{ reward_id: 'x', stack_index: 0 }], [{ reward_id: a.id, stack_index: -1 }]]) {
      expect((await call('POST', `/api/children/${kid.id}/stack/confirm`, { request_id: rid(), expected: bad })).status, JSON.stringify(bad)).toBe(400);
    }
  });
});
