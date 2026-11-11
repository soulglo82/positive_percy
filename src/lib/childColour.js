// Each child keeps one colour (Batch D v0.5), stored on the child as
// colour_index (migration 010), so deleting a child never moves the others.
// A child loaded before 010 ran falls back to its place, oldest first.
// Every class is written out in full so Tailwind and the token check see it.
export const CHILD_COLOURS = [
  { band: 'bg-kid-1', soft: 'bg-kid-1-soft', ring: 'ring-kid-1', border: 'border-kid-1', text: 'text-kid-1' },
  { band: 'bg-kid-2', soft: 'bg-kid-2-soft', ring: 'ring-kid-2', border: 'border-kid-2', text: 'text-kid-2' },
  { band: 'bg-kid-3', soft: 'bg-kid-3-soft', ring: 'ring-kid-3', border: 'border-kid-3', text: 'text-kid-3' },
  { band: 'bg-kid-4', soft: 'bg-kid-4-soft', ring: 'ring-kid-4', border: 'border-kid-4', text: 'text-kid-4' },
  { band: 'bg-kid-5', soft: 'bg-kid-5-soft', ring: 'ring-kid-5', border: 'border-kid-5', text: 'text-kid-5' },
  { band: 'bg-kid-6', soft: 'bg-kid-6-soft', ring: 'ring-kid-6', border: 'border-kid-6', text: 'text-kid-6' },
];

const NEUTRAL = { band: 'bg-border', soft: 'bg-muted', ring: 'ring-border', border: 'border-border', text: 'text-muted-foreground' };

function order(a, b) {
  const ta = Date.parse(a.created_date || '') || 0;
  const tb = Date.parse(b.created_date || '') || 0;
  if (ta !== tb) return ta - tb;
  return String(a.id).localeCompare(String(b.id));
}

// childOrId: a child object or a child id. children: the family's children.
export function childColour(childOrId, children = []) {
  const id = typeof childOrId === 'object' && childOrId ? childOrId.id : childOrId;
  const child = (typeof childOrId === 'object' && childOrId) || children.find((c) => c.id === id);
  if (child && Number.isInteger(child.colour_index) && child.colour_index >= 0) {
    return CHILD_COLOURS[child.colour_index % CHILD_COLOURS.length];
  }
  const sorted = [...children].sort(order);
  const i = sorted.findIndex((c) => c.id === id);
  return i < 0 ? NEUTRAL : CHILD_COLOURS[i % CHILD_COLOURS.length];
}
