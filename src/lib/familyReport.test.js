import { describe, it, expect } from 'vitest';
import {
  buildFamilyReportModel, buildFamilyReportPages, imagesToPdf,
} from './familyReport';

const now = new Date('2026-11-12T05:00:00Z'); // Thursday 13:00 SGT.
function data() {
  return {
    family: { family_name: 'The <Smith> Family & Co', timezone: 'Asia/Singapore' },
    children: [
      { id: 'a', name: 'Élodie <script>alert(1)</script>', total_points: 12,
        weekly_target: 20, badges_earned: ['Helping hand'] },
      { id: 'b', name: 'Maya', total_points: 5, weekly_target: 10 },
    ],
    pointEvents: [
      { id: '1', child_id: 'a', kind: 'award', category: 'Kindness', points: 10,
        created_date: '2026-11-09T16:30:00Z' },
      { id: '2', child_id: 'a', kind: 'undo', reverses_id: '1',
        category: 'Undo', points: -10, created_date: '2026-11-10T06:00:00Z' },
      { id: '3', child_id: 'a', kind: 'award', category: 'Helpfulness', points: 4,
        created_date: '2026-11-09T16:31:00Z' },
      { id: '4', child_id: 'a', kind: 'starting', category: 'Starting points', points: 8,
        created_date: '2026-11-09T09:00:00Z' },
      { id: '5', child_id: 'a', kind: 'award', category: 'Kindness', points: 3,
        created_date: '2026-11-08T16:30:00Z' }, // Monday 00:30 SGT, Sunday UTC.
      { id: '6', child_id: 'b', kind: 'award', category: 'Reading', points: 2,
        created_date: '2026-10-01T01:00:00Z' },
    ],
    redemptions: [
      { id: 'r', child_id: 'a', status: 'Completed', reward_title: 'Movie night',
        reward_cost: 10, created_date: '2026-11-11T05:00:00Z' },
    ],
    rewards: [{ id: 'reward', title: 'Movie night', cost_points: 10 }],
    behaviours: [{ name: 'Kindness', points: 1, is_quick_action: true }],
  };
}

describe('parent Family Report calculations', () => {
  it('uses the family local Monday, not UTC, and removes undone points', () => {
    const model = buildFamilyReportModel(data(), now);
    expect(model.weekStart).toBe('2026-11-09');
    expect(model.totalBalance).toBe(17);
    expect(model.totalWeeklyEarned).toBe(7); // 4 + 3; undo + starting excluded.
    expect(model.totalClaimed).toBe(1);
    expect(model.children[0].weekPoints).toBe(7);
    expect(model.children[0].lifetimeEarned).toBe(7);
    expect(model.children[0].topCategories).toEqual([['Helpfulness', 4], ['Kindness', 3]]);
    expect(model.children[1].weekPoints).toBe(0);
    expect(model.children[0].activity.find(e => e.label === 'Award corrected')).toBeTruthy();
  });

  it('produces an A4-style report and safely escapes parent-entered names', () => {
    const pages = buildFamilyReportPages(data(), now);
    expect(pages.length).toBeGreaterThan(3);
    expect(pages[0]).toContain('POSITIVE PERCY');
    expect(pages.join('')).toContain('Our children');
    expect(pages.join('')).toContain('Points and rewards activity');
    expect(pages.join('')).toContain('Behaviour settings');
    expect(pages.join('')).not.toContain('<script>alert(1)</script>');
    expect(pages.join('')).toContain('&lt;script&gt;');
    expect(pages[0]).toContain('Page 1 of ' + pages.length);
    expect(pages.join('')).not.toContain('family_code');
  });

  it('assembles a valid PDF object tree with an A4 page and xref', async () => {
    // JPEG payload is deliberately minimal here: real JPEG encoding is tested
    // end-to-end in Chromium. The assembler test covers PDF object structure.
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
    const blob = imagesToPdf([{ width: 120, height: 170, data: jpeg }]);
    expect(blob.type).toBe('application/pdf');
    const binary = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder('latin1').decode(binary);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Type /Pages');
    expect(text).toContain('/Count 1');
    expect(text).toContain('/MediaBox [0 0 595.28 841.89]');
    expect(text).toContain('/Subtype /Image');
    expect(text).toContain('xref\n0 7');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });
});
