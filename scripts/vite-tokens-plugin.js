// Writes token colours where CSS variables can't reach: manifest.json
// (theme_color, background_color) and the theme-color meta in index.html.
// The manifest source is manifest.base.json (no colours); the built file is
// emitted as /manifest.json and served the same way in dev.
import fs from 'node:fs';
import path from 'node:path';
import { TOKENS } from '../src/lib/tokens.js';

export const THEME_COLOR = TOKENS.primary;
export const BACKGROUND_COLOR = TOKENS.background;

export function buildManifest(root) {
  const base = JSON.parse(fs.readFileSync(path.join(root, 'manifest.base.json'), 'utf8'));
  delete base.$comment;
  return { ...base, background_color: BACKGROUND_COLOR, theme_color: THEME_COLOR };
}

export function transformHtml(html) {
  return html.replaceAll('%THEME_COLOR%', THEME_COLOR);
}

export default function tokensPlugin() {
  let root = process.cwd();
  return {
    name: 'percy-tokens',
    configResolved(config) { root = config.root; },
    transformIndexHtml: (html) => transformHtml(html),
    configureServer(server) {
      server.middlewares.use('/manifest.json', (req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(JSON.stringify(buildManifest(root), null, 2));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: JSON.stringify(buildManifest(root), null, 2) });
    },
  };
}
