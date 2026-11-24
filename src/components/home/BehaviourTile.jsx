// The inside of a behaviour tile, shared by Home's Quick Points and step 2 of
// "Give Percy Points" so the two cannot drift.
//
// Contract (V1-F design section 10, owner 24 November 2026: "keep the boxes,
// but they are too chunky"; it keeps the reason for the 22 November ruling,
// "standardised alignment"): on one screen every tile has the same structure
// whatever the length of its name, and a name is never clipped or covered.
// - From 375px: icon, name, "+N" on one row, centred on the tile's middle
//   line. The name is 12px up to 640px, so two lines of it fit inside the
//   44px tile: a one-line name and a two-line name give the same height.
//   The icon is 14px and the badge's side padding 4px there, so the widest
//   default name ("Adventurous") has room to spare at 375px in the form
//   (CI drew it a few pixels wider than the machine it was built on, and
//   with 3px spare it broke onto a second line).
// - Below 375px: icon top left, "+N" top right, the name beneath on its own
//   line(s), as since 22 November. One row cannot hold the name there: at
//   360px in the form "Adventurous" would break, and at 320px even
//   "Kindness" would.
// - From 640px: one row at 14px, as before.
// - Tiles in a row are one height; on Home (TILE_GRID_EVEN) all of them are.
// - A name wraps at spaces. A single word wider than its space breaks; the
//   name never runs under the badge. (No hyphenation: the browser hyphenates
//   short words that fit and leaves capitalised ones.)
// - A tile's border is one width in every state, so selecting a tile cannot
//   change the room its name has. The form marks the selected tile with a
//   ring (a shadow), which takes no room.
// The order in the page stays icon, name, badge (what a screen reader reads).
// e2e/checks.js measures every [data-tile-grid] on every screen it checks.
import CategoryIcon from '@/components/CategoryIcon';

// Home (four tiles at most): every tile one height. The dialog lists every
// behaviour, so there tiles match within a row only: one long name must not
// stretch all five rows (design review).
export const TILE_GRID = 'grid grid-cols-2 gap-2 phone:gap-1.5 sm:gap-2';
export const TILE_GRID_EVEN = 'grid grid-cols-2 auto-rows-fr gap-2 phone:gap-1.5 sm:gap-2';

// For the tile's own element (a button). Text is 12px below 360px, 14px from
// 360px (two rows), 12px again from 375px (one row), 14px from 640px.
export const TILE_LAYOUT = 'grid grid-cols-[1fr_auto] content-start items-center gap-x-2 gap-y-1.5 phone:grid-cols-[auto_1fr_auto] phone:content-center phone:gap-x-1 sm:gap-x-2 min-h-11 rounded-md p-2.5 phone:px-1.5 phone:py-1 sm:p-2.5 text-left text-xs xs:text-sm phone:text-xs sm:text-sm font-semibold text-foreground';

export default function BehaviourTileParts({ iconKey, name, points }) {
  return (
    <>
      <span aria-hidden="true" data-tile-part="icon" className="col-start-1 row-start-1 text-primary">
        <CategoryIcon iconKey={iconKey} className="h-5 w-5 phone:h-3.5 phone:w-3.5 sm:h-5 sm:w-5" />
      </span>
      <span data-tile-part="name" className="col-span-2 row-start-2 min-w-0 break-words phone:col-span-1 phone:col-start-2 phone:row-start-1">{name}</span>
      {/* The space keeps the spoken name "Kindness +1" where the tile has no aria-label; a grid ignores it. */}
      {' '}
      <span data-tile-part="badge" className="col-start-2 row-start-1 justify-self-end rounded-md bg-star px-1.5 py-0.5 tabular-nums phone:col-start-3 phone:px-1 sm:px-1.5">+{points}</span>
    </>
  );
}

// Give Percy Points (V1-F design section 11, owner 24 November 2026: "the
// categories have points listed, these don't need to be there"): a tile with
// no "+N". With no badge the name has room on one row at every width (about
// 99px at 320px in the form; "Adventurous" needs about 80), so there is one
// layout below 640px: icon and name on one row, 44px tall, two lines of a
// 12px name the same height. A grid of these declares data-tile-badge="none"
// so e2e/checks.js measures it without a badge (and fails if one appears).
export const TILE_GRID_PLAIN = 'grid grid-cols-2 gap-1.5 sm:gap-2';
export const TILE_LAYOUT_PLAIN = 'flex items-center gap-1 sm:gap-2 min-h-11 rounded-md px-1.5 py-1 sm:p-2.5 text-left text-xs sm:text-sm font-semibold text-foreground';

export function BehaviourTilePlain({ iconKey, name }) {
  return (
    <>
      <span aria-hidden="true" data-tile-part="icon" className="shrink-0 text-primary">
        <CategoryIcon iconKey={iconKey} className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
      </span>
      <span data-tile-part="name" className="min-w-0 flex-1 break-words">{name}</span>
    </>
  );
}
