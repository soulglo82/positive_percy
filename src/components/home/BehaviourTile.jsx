// The inside of a behaviour tile, shared by Home's Quick Points and step 2 of
// "Give Percy Points" so the two cannot drift.
//
// Contract (owner review 2026-11-22, "standardised alignment"): on one screen
// every tile has the same structure whatever the length of its name, and a
// name is never clipped or covered.
// - Below 640px: icon top left, "+N" top right, the name beneath on its own
//   line(s). One line cannot hold the name there: at 320px it would get about
//   46px and "Helpfulness" needs 75px even at the 12px floor. Names are the
//   family's own, so a layout that depends on the name fitting gives mixed
//   tiles again.
// - From 640px: icon, name, "+N" on one line.
// - Tiles in a row are one height; on Home (TILE_GRID_EVEN) all of them are.
// - A word wider than the tile breaks; the name never runs under the badge.
// The order in the page stays icon, name, badge (what a screen reader reads).
// e2e/checks.js measures every [data-tile-grid] on every screen it checks.
import CategoryIcon from '@/components/CategoryIcon';

// Home (four tiles at most): every tile one height. The dialog lists every
// behaviour, so there tiles match within a row only: one long name must not
// stretch all five rows (design review).
export const TILE_GRID = 'grid grid-cols-2 gap-2';
export const TILE_GRID_EVEN = 'grid grid-cols-2 auto-rows-fr gap-2';

// For the tile's own element (a button). Text is 12px below 360px, 14px above.
export const TILE_LAYOUT = 'grid grid-cols-[1fr_auto] content-start items-center gap-x-2 gap-y-1.5 sm:grid-cols-[auto_1fr_auto] sm:content-center min-h-11 rounded-md p-2.5 text-left text-xs xs:text-sm font-semibold text-foreground';

export default function BehaviourTileParts({ iconKey, name, points }) {
  return (
    <>
      <span aria-hidden="true" data-tile-part="icon" className="col-start-1 row-start-1 text-primary">
        <CategoryIcon iconKey={iconKey} className="h-5 w-5" />
      </span>
      <span data-tile-part="name" className="col-span-2 row-start-2 min-w-0 break-words sm:col-span-1 sm:col-start-2 sm:row-start-1">{name}</span>
      {/* The space keeps the spoken name "Kindness +1" where the tile has no aria-label; a grid ignores it. */}
      {' '}
      <span data-tile-part="badge" className="col-start-2 row-start-1 justify-self-end rounded-md bg-star px-1.5 py-0.5 tabular-nums sm:col-start-3">+{points}</span>
    </>
  );
}
