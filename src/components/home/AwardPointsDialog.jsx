// V1 "Give Percy Points", the compact form the owner chose from mock-ups on
// 24 November 2026 (docs/engineering/V1-F-DESIGN.md section 11, version B).
// The category boxes carry no value: the amount comes only from the Points
// row, which is fixed above Cancel and Award. The award itself goes through
// the caller's applyAward (lock, Undo toast, streak, badges).
import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import NumberInput from '@/components/ui/NumberInput';
import { MAX_AWARD } from '@/lib/points';
import { cn } from '@/lib/utils';
import { BehaviourTilePlain, TILE_GRID_PLAIN, TILE_LAYOUT_PLAIN } from '@/components/home/BehaviourTile';
import { FamilyStrip } from '@/components/home/HomeSections';

// A1: unassigned behaviours, or ones assigned to this child.
export const behavioursFor = (categories, childId) => categories.filter((c) =>
  !c.assigned_children?.length || c.assigned_children.includes(childId));

export const pointWord = (n) => (n === 1 ? 'point' : 'points');

// What the server accepts (POST /api/children/:id/award).
const canAward = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_AWARD;

// Numbered section heading, as drawn in the approved forms.
export function StepHeading({ n, title, hint, id }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-warning font-display font-bold text-foreground">{n}</span>
      <div>
        <h3 id={id} className="font-display font-bold text-lg text-primary leading-tight">{title}</h3>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

export default function AwardPointsDialog({ isOpen, onClose, children = [], categories = [], initialChildId, onSubmit }) {
  // Held here because closing must wait for an award that is being sent.
  const [submitting, setSubmitting] = useState(false);
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      {/* short: in a window under 420px tall the footer cannot stay fixed (the
          list would have no room), so the whole pop-up scrolls as one piece. */}
      <DialogContent className="sm:max-w-lg short:overflow-y-auto">
        {/* The form exists only while the pop-up is open, so each opening starts
            from fresh state. Resetting an always-mounted form in an effect drew
            the previous opening for one frame: an old note field took the focus
            and was then removed (code review). A new child to open for is a new form. */}
        <AwardForm key={initialChildId ?? ''} onClose={onClose} children={children} categories={categories}
          initialChildId={initialChildId} onSubmit={onSubmit} submitting={submitting} setSubmitting={setSubmitting} />
      </DialogContent>
    </Dialog>
  );
}

function AwardForm({ onClose, children, categories, initialChildId, onSubmit, submitting, setSubmitting }) {
  const [childId, setChildId] = useState(initialChildId);
  const [categoryId, setCategoryId] = useState(null);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  // The amount: a number, or '' when the parent has cleared the field. It
  // starts at 1 and changes only by typing or by minus and plus; choosing a
  // category or a child never changes it (owner, 24 November 2026: "the value
  // is determined by the box below").
  const [points, setPoints] = useState(1);
  // What a screen reader is told, a moment after the last change (one
  // sentence for "125", not three for "1", "12", "125").
  const [said, setSaid] = useState('');

  const child = children.find((c) => c.id === childId) || children[0];
  const offered = child ? behavioursFor(categories, child.id) : [];
  const chosen = offered.find((c) => c.id === categoryId) || null;

  // A2: keep the category if this child can use it, otherwise their first.
  useEffect(() => {
    if (!chosen && offered.length) setCategoryId(offered[0].id);
  }, [chosen, offered]);

  const valid = !!chosen && canAward(points);
  // Nothing is said about an empty field; anything else that cannot be awarded gets the rule.
  const showRule = !!chosen && points !== '' && !canAward(points);
  const sentence = valid && child ? `${child.name} earns ${points} Percy ${points === 1 ? 'Point' : 'Points'}. For ${chosen.name}.` : '';
  useEffect(() => {
    const timer = setTimeout(() => setSaid(sentence), 500);
    return () => clearTimeout(timer);
  }, [sentence]);

  // While an award is being sent nothing that is sent can change: the amount
  // controls are disabled, and a child or category picked in flight is ignored.
  const pickChild = (id) => { if (!submitting) setChildId(id); };
  const pickBehaviour = (id) => { if (!submitting) setCategoryId(id); };
  // Minus and plus: one down or one up, kept within 1 to MAX_AWARD. From an
  // empty field or something that is not a number, 1. From a number that is
  // not whole, the next whole number in that direction.
  const step = (by) => {
    if (submitting) return;
    const n = points === '' ? NaN : Number(points);
    const moved = !Number.isFinite(n) ? 1 : by > 0 ? Math.floor(n) + 1 : Math.ceil(n) - 1;
    setPoints(Math.min(MAX_AWARD, Math.max(1, moved)));
  };

  const submit = async () => {
    if (submitting || !child || !valid) return;
    setSubmitting(true);
    try {
      const ok = await onSubmit(child, { points, category: chosen.name, note: note.trim() });
      if (ok === false) return; // the caller showed the error; keep the form (A5)
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
        <DialogHeader className="pb-2 pt-4">
          <DialogTitle className="text-lg font-extrabold text-primary">Give Percy Points</DialogTitle>
          {/* Not shown (the owner asked for a compact form); still the pop-up's description for a screen reader. */}
          <DialogDescription className="sr-only">Notice something positive, whenever it happens.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3 py-3 short:flex-none short:overflow-visible">
          <FamilyStrip compact children={children} selectedId={child?.id} onSelect={pickChild} />
          <section className="space-y-2 border-t border-border pt-3">
            <h3 id="award-behaviour" className="font-display text-base font-bold leading-tight text-primary">What did {child?.name || 'they'} do?</h3>
            {offered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add a behaviour in Family settings first.</p>
            ) : (
              <div className={TILE_GRID_PLAIN} role="group" aria-labelledby="award-behaviour" data-tile-grid data-tile-badge="none">
                {offered.map((cat) => {
                  const on = cat.id === chosen?.id;
                  return (
                    <button key={cat.id} type="button" aria-pressed={on} onClick={() => pickBehaviour(cat.id)} data-tile
                      className={cn(TILE_LAYOUT_PLAIN, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        on ? 'border border-selected-border ring-1 ring-selected-border bg-selected' : 'border border-border bg-card hover:bg-accent')}>
                      <BehaviourTilePlain iconKey={cat.icon_key} name={cat.name} />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
          {noteOpen ? (
            <section className="space-y-1.5">
              <Label htmlFor="award-note">Add a note (optional)</Label>
              {/* Focused as it appears: on a phone the keyboard only opens for a field focused in the same tap. */}
              <Textarea id="award-note" autoFocus value={note} maxLength={500} rows={2} disabled={submitting}
                placeholder="What went well?" onChange={(e) => setNote(e.target.value)} />
            </section>
          ) : (
            <button type="button" onClick={() => setNoteOpen(true)} disabled={submitting}
              className="inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50">
              <span aria-hidden="true">+&nbsp;</span>Add a note
            </button>
          )}
        </DialogBody>
        <DialogFooter className="relative flex-col gap-2.5">
          {/* Drawn over the bottom of the list, not in the flow: if it took a
              line of its own the row and the buttons would jump under the
              finger when it came and went (design review). */}
          {showRule && (
            <p id="award-points-rule" role="alert" className="absolute inset-x-0 bottom-full border-t border-border bg-card px-6 py-1.5 text-xs text-destructive">Points must be a whole number from 1 to {MAX_AWARD}.</p>
          )}
          {/* The amount, always on screen (owner, 24 November 2026). At the
              ends of the range a button is aria-disabled, not disabled: a
              button that disables itself under the finger drops the focus.
              followModel: the field shows an amount set by minus or plus even
              while it has focus; it is never remounted (a remount drops the
              keyboard in the middle of typing). */}
          {offered.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <Label id="award-points-label" htmlFor="award-points">Points</Label>
              <div className="flex items-center gap-1.5" role="group" aria-labelledby="award-points-label">
                <Button type="button" variant="outline" size="icon" aria-label="One point fewer" disabled={submitting}
                  aria-disabled={points === 1} className="text-lg aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:bg-card" onClick={() => step(-1)}>
                  <span aria-hidden="true">−</span>
                </Button>
                <NumberInput id="award-points" inputMode="numeric" followModel
                  value={points} emptyValue="" min={1} max={MAX_AWARD} disabled={submitting}
                  aria-invalid={showRule} aria-describedby={showRule ? 'award-points-rule' : undefined}
                  onChange={setPoints} onWheel={(e) => e.currentTarget.blur()}
                  className="w-16 px-0 text-center text-lg font-semibold tabular-nums" />
                <Button type="button" variant="outline" size="icon" aria-label="One point more" disabled={submitting}
                  aria-disabled={points === MAX_AWARD} className="text-lg aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:bg-card" onClick={() => step(1)}>
                  <span aria-hidden="true">+</span>
                </Button>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button className="flex-1" onClick={submit} disabled={!valid || submitting}>
              {valid ? `Award ${points} ${pointWord(points)}` : 'Award points'}
            </Button>
          </div>
          {/* What the cream summary used to show, kept for screen readers, outside the scrolling part. */}
          <p className="sr-only" aria-live="polite" aria-atomic="true">{said}</p>
        </DialogFooter>
    </>
  );
}
