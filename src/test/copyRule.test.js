// V1 plan §8.6: design-only notes in the approved HTML never ship as UI copy.
// Each phrase below is taken from the approved HTML (blob 9de1df2).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const APP = walk(path.join(ROOT, 'src')).filter((f) => /\.(jsx?|tsx?)$/.test(f) && !/\.test\./.test(f) && !f.includes(`${path.sep}test${path.sep}`));

const DESIGN_ONLY = [
  /design preview/i,
  /design only/i,
  /No points are actually awarded/i,
  /This preview does not change/i,
  /Streak figure is sample content/i,
  /is a visual concept until/i,
];

describe('copy rule (§8.6)', () => {
  it('no app source contains a design-only note', () => {
    const hits = [];
    for (const f of APP) {
      const text = fs.readFileSync(f, 'utf8');
      for (const re of DESIGN_ONLY) if (re.test(text)) hits.push(`${path.relative(ROOT, f)}: ${re}`);
    }
    expect(hits).toEqual([]);
  });
  it('the scan sees app files (control)', () => {
    expect(APP.some((f) => f.endsWith(path.join('home', 'AwardPointsDialog.jsx')))).toBe(true);
    expect(fs.readFileSync(path.join(ROOT, 'src/components/home/AwardPointsDialog.jsx'), 'utf8')).toMatch(/Give Percy Points/);
  });
});
