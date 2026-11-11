// One family for every project (family/create is rate limited per hour).
import { request } from '@playwright/test';
import crypto from 'node:crypto';

async function api(ctx, method, path, body, token) {
  const res = await ctx.fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    data: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok()) throw new Error(`${method} ${path} ${res.status()} ${await res.text()}`);
  return res.json();
}

export default async function globalSetup(config) {
  const baseURL = config.projects[0].use.baseURL;
  const ctx = await request.newContext({ baseURL });
  const fam = await api(ctx, 'POST', '/api/family/create', { family_name: 'The Fixture Family', timezone: 'Asia/Singapore' });
  const t = fam.token;
  // Long name, 4-digit total, week over target; quick points start at the cap (4).
  const long = await api(ctx, 'POST', '/api/children', { name: 'Alexandra-Josephine Montgomery-Wellington', age: 9, weekly_target: 20, total_points: 1000 }, t);
  const sam = await api(ctx, 'POST', '/api/children', { name: 'Sam', age: 6, weekly_target: 30, total_points: 0 }, t);
  for (const [child, points, category] of [[long, 10, 'Kindness'], [long, 10, 'Bravery'], [long, 10, 'Homework'], [sam, 5, 'Caring']]) {
    await api(ctx, 'POST', `/api/children/${child.id}/award`, { points, category, request_id: crypto.randomUUID() }, t);
  }
  // A behaviour of the family's own (only those can be deleted).
  await api(ctx, 'POST', '/api/behavior-categories', { name: 'Tidy room', icon: '🧸', points: 5 }, t);
  await api(ctx, 'POST', '/api/rewards', { title: 'Screen time, 30 minutes', cost_points: 20, emoji: '📱', visible_to_child: true }, t);
  await api(ctx, 'POST', '/api/rewards', { title: 'A very long reward title that has to wrap on a small phone screen', cost_points: 5000, emoji: '🎡', visible_to_child: false }, t);
  process.env.PERCY_E2E_FAMILY = JSON.stringify({ code: fam.family_code, token: t });
  await ctx.dispose();
}
