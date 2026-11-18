// Release-gated assets (docs/engineering/V1-F-DESIGN.md §3, v1.1). A gated
// file is never in public/ and never in a normal build. The build adds it only
// once its gate in design/brand/RELEASE_GATES.json is cleared with a recorded
// clearance. PERCY_PREVIEW_GATED=1 adds it to a local review build only; it is
// ignored on Railway, so it cannot reach a deploy.
import fs from 'node:fs';
import path from 'node:path';

export function readGates(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'design/brand/RELEASE_GATES.json'), 'utf8')).gates;
}

export const isCleared = (gate) => gate.status === 'cleared' && typeof gate.clearance === 'string' && gate.clearance.trim().length > 0;

export function includeGated(gate, env = process.env) {
  if (isCleared(gate)) return true;
  const onRailway = Object.keys(env).some((k) => k.startsWith('RAILWAY_'));
  return env.PERCY_PREVIEW_GATED === '1' && !onRailway;
}

// The URL each gated asset is served at (built from the gate's own runtime
// path), and its define name for the app.
const urlOf = (gate) => '/' + gate.runtime.replace(/^public\//, '');

export default function gatedAssetsPlugin(root) {
  const gates = readGates(root);
  const included = gates.filter((g) => includeGated(g));
  return {
    name: 'percy-gated-assets',
    config() {
      if (process.env.VITEST) return {}; // tests stub the env themselves
      const define = {};
      for (const g of gates) define[`import.meta.env.${g.env}`] = JSON.stringify(included.includes(g) ? urlOf(g) : '');
      return { define };
    },
    configureServer(server) {
      for (const g of included) {
        server.middlewares.use(urlOf(g), (req, res) => {
          res.setHeader('Content-Type', 'image/png');
          res.end(fs.readFileSync(path.join(root, g.source)));
        });
      }
    },
    generateBundle() {
      for (const g of included) {
        this.emitFile({ type: 'asset', fileName: urlOf(g).slice(1), source: fs.readFileSync(path.join(root, g.source)) });
      }
    },
  };
}
