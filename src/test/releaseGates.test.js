// V1-F §3 (v1.1): the treasure map is release-gated. It is never in public/,
// the build adds it only once its gate is cleared, and the dist check fails
// on a gated file (by hash, so a rename does not dodge it).
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openGates } from '../../scripts/check-release-gates.mjs';
import { includeGated, isCleared, readGates } from '../../scripts/brand/gated-assets.mjs';

const ROOT = path.resolve(__dirname, '../..');
const SOURCE = path.join(ROOT, 'design/brand/library/Positive_Percy_Stage1_Brand_System/04_Illustrations/treasure-map_3570506.png');
const record = JSON.parse(fs.readFileSync(path.join(ROOT, 'design/brand/RELEASE_GATES.json'), 'utf8'));
const gate = record.gates.find((g) => g.id === 'freepik-treasure-map-3570506');

function tree({ status = 'open', clearance = null, file = 'dist/gated/treasure-map-3570506.png', withMap = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gates-'));
  fs.mkdirSync(path.join(dir, 'design/brand'), { recursive: true });
  const gates = record.gates.map((g) => ({ ...g, status, clearance }));
  fs.writeFileSync(path.join(dir, 'design/brand/RELEASE_GATES.json'), JSON.stringify({ ...record, gates }));
  fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'dist/index.html'), 'x');
  if (withMap) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.copyFileSync(SOURCE, path.join(dir, file));
  }
  return dir;
}

describe('release gate record', () => {
  it('gates the exact approved map bytes and is open', () => {
    // The record's hash is the source file's real hash (a re-exported map
    // would otherwise slip past the hash-based dist check), and it is the
    // approved bytes (the same as the approved HTML's embedded image).
    expect(crypto.createHash('sha256').update(fs.readFileSync(SOURCE)).digest('hex')).toBe(gate.sha256);
    expect(gate.sha256).toBe('9f31c75a73e77e4bd19ebe93b09b94f75d30ef1c667a94ec89a541209b9d8ad1');
    expect(gate.status).toBe('open'); // clearing it is the owner's decision, recorded with the change
    expect(readGates(ROOT)).toHaveLength(1);
  });
});

describe('build inclusion (gated-assets.mjs)', () => {
  const open = { ...gate, status: 'open', clearance: null };
  it('open gate: excluded from a normal build', () => {
    expect(includeGated(open, {})).toBe(false);
  });
  it('open gate: a local review build may include it', () => {
    expect(includeGated(open, { PERCY_PREVIEW_GATED: '1' })).toBe(true);
  });
  it('open gate: the review flag is ignored on Railway', () => {
    expect(includeGated(open, { PERCY_PREVIEW_GATED: '1', RAILWAY_ENVIRONMENT_NAME: 'production' })).toBe(false);
  });
  it('"cleared" without a clearance reference is still open', () => {
    expect(isCleared({ ...gate, status: 'cleared', clearance: '  ' })).toBe(false);
    expect(includeGated({ ...gate, status: 'cleared', clearance: null }, {})).toBe(false);
  });
  it('cleared with a reference: included', () => {
    expect(includeGated({ ...gate, status: 'cleared', clearance: 'Owner licence record' }, {})).toBe(true);
  });
});

describe('dist check (check-release-gates.mjs)', () => {
  it('the committed repository has no gated file in public/', () => {
    expect(openGates(ROOT, ['public'])).toEqual([]);
  });
  it('open gate + file in dist: fails', () => {
    expect(openGates(tree())).toHaveLength(1);
  });
  it('open gate + file renamed: still fails (by hash)', () => {
    expect(openGates(tree({ file: 'dist/assets/x.png' })).map((g) => g.file)).toEqual(['dist/assets/x.png']);
  });
  it('cleared with a reference: passes', () => {
    expect(openGates(tree({ status: 'cleared', clearance: 'Owner licence record' }))).toEqual([]);
  });
  it('file absent: passes', () => {
    expect(openGates(tree({ withMap: false }))).toEqual([]);
  });
});
