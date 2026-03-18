import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, '..');
const rootDir = resolve(__dirname, '../..');

/**
 * IMPL-4 verification tests.
 * Structural checks that validate points_spent retirement and
 * motivation endpoint family_code scoping.
 */

describe('MotivationCard state handling', () => {
  it('should export a default component', async () => {
    const mod = await import('../components/child/MotivationCard.jsx');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

describe('ChildView: points_spent retirement', () => {
  const source = readFileSync(resolve(srcDir, 'pages/ChildView.jsx'), 'utf-8');

  it('should not import ShoppingBag icon', () => {
    expect(source).not.toContain('ShoppingBag');
  });

  it('should not render points_spent value in JSX', () => {
    const jsxLines = source.split('\n').filter(
      line => !line.trim().startsWith('//') && !line.trim().startsWith('{/*') && !line.trim().startsWith('*')
    );
    const jsxContent = jsxLines.join('\n');
    expect(jsxContent).not.toMatch(/selectedChild\.points_spent/);
    expect(jsxContent).not.toMatch(/child\.points_spent/);
  });

  it('should not render "Points Spent" display text', () => {
    expect(source).not.toContain('Points Spent');
  });

  it('should import MotivationCard', () => {
    expect(source).toContain('import MotivationCard from');
  });
});

describe('Motivation endpoint: family_code scoping', () => {
  it('should scope all queries to family_code', () => {
    const source = readFileSync(resolve(rootDir, 'server/routes.js'), 'utf-8');

    // Extract the motivation endpoint handler
    const startIdx = source.indexOf("router.get('/api/children/:id/motivation'");
    const endIdx = source.indexOf('// ─── Quick Actions CRUD');
    expect(startIdx).toBeGreaterThan(-1);
    expect(endIdx).toBeGreaterThan(startIdx);
    const handler = source.slice(startIdx, endIdx);

    // All SQL queries should include family_code
    const queryRegex = /pool\.query\(\s*[`"']([^`"']+)[`"']/g;
    const queries = [];
    let match;
    while ((match = queryRegex.exec(handler)) !== null) {
      queries.push(match[1]);
    }
    expect(queries.length).toBeGreaterThan(0);
    for (const sql of queries) {
      expect(sql).toContain('family_code');
    }
  });
});
