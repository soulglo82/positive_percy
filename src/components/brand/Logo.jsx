import { cn } from '@/lib/utils';
import { LOGO_ART, logoSrc } from './logoArt';

// Approved Fox 1A artwork (E02). Files in public/brand are byte copies of the
// kit's 02_SVG_Masters; design/brand/RUNTIME_ASSETS.json and
// src/test/brandAssets.test.js tie each one back to the checksummed pack.
// Rendered with <img>, never inlined: the kit SVGs share the gradient id
// "fox1a-orange", which would collide if two were inlined on one page.
//
// variant: 'symbol' (the fox alone), 'horizontal' or 'stacked' (fox + name).
// tone: 'full' (light backgrounds), 'reverse' (on purple or ink only),
//       'mono-purple', 'mono-black'.
// `wordmark` is the older prop name for variant="horizontal".
// size: the rendered height in CSS px. Width follows the artwork's ratio.
export default function Logo({ size = 32, wordmark = false, variant, tone = 'full', decorative = false, className }) {
  const v = LOGO_ART[variant] ? variant : wordmark ? 'horizontal' : 'symbol';
  const art = LOGO_ART[v];
  const width = Math.round((size * art.w) / art.h);
  // The lockups are pictures of the name, so they need it as alt text.
  // The symbol alone is decoration next to visible text unless stated.
  const alt = decorative ? '' : 'Positive Percy';
  return (
    <span className={cn('inline-flex items-center justify-center', className)}>
      <img
        src={logoSrc(v, tone)}
        alt={alt}
        aria-hidden={decorative ? 'true' : undefined}
        width={width}
        height={size}
        decoding="async"
        className="shrink-0 object-contain"
      />
    </span>
  );
}
