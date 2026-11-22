// One points figure with its picture: the icon in a tile, the figure with its
// unit on one baseline, and a label beneath, all from one left edge
// (docs/engineering/V1-B-DESIGN.md §10). Child View's points card was drawn
// this way first; Home's "Little wins" and the Children weekly-target card use
// the same component, so the three screens cannot drift apart (owner, 22 Nov:
// "the changes we just made … need to be consistently applied").
//
// `icon` is the element itself (an approved icon with a literal id), not an id:
// approved icon ids are never computed (src/test/approvedIcons.test.js).
// e2e/checks.js measures every [data-figure] on every screen it checks.
export default function PointsFigure({ icon, value, unit, label, valueProps = {} }) {
  return (
    <div className="flex items-center gap-3" data-figure>
      {/* The same tile as a reward's picture (RewardIcon md), so figures and goals line up. */}
      <span aria-hidden="true" data-figure-part="icon" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-warning text-primary">
        {icon}
      </span>
      <p className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span data-figure-part="value" className="font-display font-extrabold text-total text-foreground" {...valueProps}>{value}</span>
          {' '}
          <span data-figure-part="unit" className="font-semibold text-foreground">{unit}</span>
        </span>
        {' '}
        <span data-figure-part="label" className="block text-sm font-medium text-muted-foreground">{label}</span>
      </p>
    </div>
  );
}
