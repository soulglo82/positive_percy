// Fox 1A artwork table (E02): file names in public/brand and viewBox sizes.
// Pure data so tests can import it without a DOM.
export const LOGO_ART = {
  symbol: { w: 365, h: 459, file: { full: 'fox-1a-symbol-full', reverse: 'fox-1a-symbol-white', 'mono-purple': 'fox-1a-symbol-purple', 'mono-black': 'fox-1a-symbol-black' } },
  horizontal: { w: 1350, h: 380, file: { full: 'positive-percy-horizontal-full', reverse: 'positive-percy-horizontal-reverse', 'mono-purple': 'positive-percy-horizontal-mono-purple', 'mono-black': 'positive-percy-horizontal-mono-black' } },
  stacked: { w: 800, h: 890, file: { full: 'positive-percy-stacked-full', reverse: 'positive-percy-stacked-reverse', 'mono-purple': 'positive-percy-stacked-mono-purple', 'mono-black': 'positive-percy-stacked-mono-black' } },
};

export function logoSrc(variant, tone) {
  const art = LOGO_ART[variant] || LOGO_ART.symbol;
  return `/brand/${art.file[tone] || art.file.full}.svg`;
}
