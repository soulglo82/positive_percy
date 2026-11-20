// V1-D §14 (owner decision 2026-11-20): the approved reward artwork is
// exactly the register's decisions.rewards, served unchanged, safe, and
// looked up in one place everywhere a reward is drawn or chosen.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import { svgProblems } from './svgScan.js';
import { REWARD_ARTWORK, REWARD_ART_GROUP } from '../lib/rewardArtwork.js';
import { pickerItems, pickerLabel, accentOf, ARTWORK_ALIASES } from '../lib/rewardPicker.js';
import RewardIcon, { rewardArt } from '../components/rewards/RewardIcon.jsx';

const ROOT = path.resolve(__dirname, '../..');
const REGISTER = JSON.parse(fs.readFileSync(path.join(ROOT, 'design/stage1/APPROVAL_REGISTER.json'), 'utf8'));
const CREDITS = fs.readFileSync(path.join(ROOT, 'public/licenses/CREDITS.txt'), 'utf8');

describe('approved reward artwork', () => {
  it('is exactly the register decisions.rewards, in order, with their approved names', () => {
    const want = Object.entries(REGISTER.decisions.rewards).map(([name, e]) => ({ id: e.asset_id, name }));
    expect(REWARD_ARTWORK.map(({ id, name }) => ({ id, name }))).toEqual(want);
    expect(want).toHaveLength(12);
    expect(REWARD_ARTWORK.find((a) => a.name === 'New book').id).toBe('phosphor:book-bookmark:duotone');
  });
  it('the Streamline files are served byte-for-byte from their checked-in sources, and are safe', () => {
    const streamline = REWARD_ARTWORK.filter((a) => a.src);
    expect(streamline).toHaveLength(11);
    for (const a of streamline) {
      const served = fs.readFileSync(path.join(ROOT, 'public', a.src));
      const source = fs.readFileSync(path.join(ROOT, a.source));
      expect(served.equals(source), a.src).toBe(true);
      expect(a.source).toBe(REGISTER.decisions.rewards[a.name].source_file);
      expect(svgProblems(served.toString('utf8')), a.src).toEqual([]);
    }
    expect(CREDITS).toMatch(/Streamline[\s\S]*CC BY 4\.0/);
  });
  it('one lookup: names, labels and search never fall back to the id parts', () => {
    for (const a of REWARD_ARTWORK) {
      expect(rewardArt(a.id)).toMatchObject({ name: a.name });
      expect(pickerLabel(a.id)).toBe(a.name);
      expect(accentOf(a.id)).toBeNull();
    }
    expect(pickerItems('', 'plump')).toEqual([]);
    expect(pickerItems('', 'duo')).toEqual([]);
    expect(pickerItems(REWARD_ART_GROUP, '')).toEqual(REWARD_ARTWORK.map((a) => a.id));
    expect(pickerItems('', 'bike').map(pickerLabel)).toEqual(['Bike ride', 'Bicycle']);
    expect(pickerItems('', 'movie').map(pickerLabel)).toEqual(['Movie night', 'Film Slate']);
    expect(rewardArt('streamline:plump:duo:not:real')).toBeNull();
    // Every alias belongs to a real artwork; the obvious words find each one.
    const ids = new Set(REWARD_ARTWORK.map((a) => a.id));
    expect(Object.keys(ARTWORK_ALIASES).filter((k) => !ids.has(k))).toEqual([]);
    for (const [word, name] of [['camera', 'Photo adventure'], ['beach', 'Family outing'], ['ticket', 'Day out'], ['bicycle', 'Bike ride'], ['present', 'Gift'], ['song', 'Music time']]) {
      expect(pickerItems('', word).map(pickerLabel), word).toContain(name);
    }
  });
  it('a reward with artwork draws its image (decorative); precedence and fallback unchanged', () => {
    const { container, rerender } = render(<RewardIcon reward={{ icon_key: 'streamline:plump:duo:food-drink:cake-slice', emoji: '🎂', image_url: '/u/p.png' }} />);
    const img = container.querySelector('img');
    expect(img.getAttribute('src')).toBe('/reward-art/cake-slice.svg');
    expect(img.getAttribute('alt')).toBe('');
    rerender(<RewardIcon reward={{ icon_key: 'phosphor:book-bookmark:duotone' }} />);
    expect(container.querySelector('svg[data-icon="phosphor:book-bookmark:duotone"]')).toBeTruthy();
    // Cleared again: the stored image and emoji come back (nothing was replaced).
    rerender(<RewardIcon reward={{ icon_key: null, emoji: '🎂', image_url: '/u/p.png' }} />);
    expect(container.querySelector('img').getAttribute('src')).toBe('/u/p.png');
  });
});
