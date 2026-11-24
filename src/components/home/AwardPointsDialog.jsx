// V1 "Give Percy Points" (approved design 9de1df2, screen "award";
// docs/engineering/V1-F-DESIGN.md A and section 9). The amount starts as the
// chosen behaviour's points and the parent can choose another (owner, 23
// November 2026: custom points, as the old dialog had). The award itself goes
// through the caller's applyAward (lock, Undo toast, streak, badges).
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
import BehaviourTileParts, { TILE_GRID, TILE_LAYOUT } from '@/components/home/BehaviourTile';
import { FamilyStrip } from '@/components/home/HomeSections';

// A1: unassigned behaviours, or ones assigned to this child.
export const behavioursFor = (categories, childId) => categories.filter((c) =>
  !c.assigned_children?.length || c.assigned_children.includes(childId));

export const pointWord = (n) => (n === 1 ? 'point' : 'points');

// The old dialog's quick amounts.
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
  const [childId, setChildId] = useState(initialChildId);
  const [categoryId, setCategoryId] = useState(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // The parent's own amount, with the behaviour it was chosen for: null until
  // they choose one (minus, plus or a typed number); its amount is '' when
  // they have cleared the field. It counts only for that behaviour: tapping a
  // box, or a child change that moves the behaviour, starts again from the
  // behaviour's points (V1-F design section 10: the amount sits under the
  // boxes, so a box says what the amount is).
  const [own, setOwn] = useState(null);

  const child = children.find((c) => c.id === childId) || children[0];
  const offered = child ? behavioursFor(categories, child.id) : [];
  const chosen = offered.find((c) => c.id === categoryId) || null;

  // Fresh form each time it opens, for the child it was opened for.
  useEffect(() => {
    if (!isOpen) return;
    setChildId(initialChildId);
    setCategoryId(null);
    setNote('');
    setOwn(null);
  }, [isOpen, initialChildId]);

  // A2: keep the behaviour if this child can use it, otherwise their first.
  useEffect(() => {
    if (!isOpen) return;
    if (!chosen && offered.length) setCategoryId(offered[0].id);
  }, [isOpen, chosen, offered]);

  const ownAmount = own && chosen && own.for === chosen.id ? own.amount : null;
  const points = ownAmount === null ? (chosen ? (chosen.points ?? 1) : '') : ownAmount;
  const valid = !!chosen && canAward(points);
  // Nothing is said about an empty field; anything else that cannot be awarded gets the rule.
  const showRule = points !== '' && !canAward(points);
  const setAmount = (amount) => { if (chosen) setOwn({ for: chosen.id, amount }); };
  // While an award is being sent, nothing that decides the amount moves: the
  // amount controls are disabled, and a child or behaviour picked in flight is
  // ignored (it would show another amount than the one sent).
  const pickChild = (id) => { if (!submitting) setChildId(id); };
  // A box says what the amount is: tapping one, the selected one too, goes
  // back to that behaviour's points.
  const pickBehaviour = (id) => { if (submitting) return; setCategoryId(id); setOwn(null); };
  // Minus and plus: one down or one up, kept within 1 to MAX_AWARD. From an
  // empty field or something that is not a number, 1. From a number that is
  // not whole, the next whole number in that direction.
  const step = (by) => {
    if (submitting) return;
    const n = points === '' ? NaN : Number(points);
    const moved = !Number.isFinite(n) ? 1 : by > 0 ? Math.floor(n) + 1 : Math.ceil(n) - 1;
    const next = Math.min(MAX_AWARD, Math.max(1, moved));
    // Minus at 1 (or plus at the top) changes nothing, so it chooses nothing.
    if (ownAmount === null && next === points) return;
    setAmount(next);
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-title font-extrabold text-primary">Give Percy Points</DialogTitle>
          <DialogDescription>Notice something positive, whenever it happens.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <section className="space-y-3">
            <StepHeading n={1} title="Who's earned points?" hint="Select the child receiving the award." />
            <FamilyStrip children={children} selectedId={child?.id} onSelect={pickChild} />
          </section>
          <section className="space-y-3 border-t border-border pt-5">
            <StepHeading n={2} id="award-behaviour" title={`What did ${child?.name || 'they'} do?`} hint="Choose a positive behaviour." />
            {offered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add a behaviour in Family settings first.</p>
            ) : (
              <>
              <div className={TILE_GRID} role="group" aria-labelledby="award-behaviour" data-tile-grid>
                {offered.map((cat) => {
                  const on = cat.id === chosen?.id;
                  return (
                    <button key={cat.id} type="button" aria-pressed={on} onClick={() => pickBehaviour(cat.id)} data-tile
                      className={cn(TILE_LAYOUT, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        on ? 'border border-selected-border ring-1 ring-selected-border bg-selected' : 'border border-border bg-card hover:bg-accent')}>
                      <BehaviourTileParts iconKey={cat.icon_key} name={cat.name} points={cat.points ?? 1} />
                    </button>
                  );
                })}
              </div>
              {/* Owner, 24 November 2026: the amount is one tight row under the
                  boxes. At the ends of the range a button is aria-disabled, not
                  disabled: a button that disables itself under the finger drops
                  the focus. followModel: the field shows an amount set by minus
                  or plus, or by a box, even while it has focus; it is never
                  remounted (a remount drops the keyboard in the middle of typing). */}
              <div className="flex items-center justify-between gap-3">
                <Label id="award-points-label" htmlFor="award-points">Points</Label>
                <div className="flex items-center gap-1.5" role="group" aria-labelledby="award-points-label">
                  <Button type="button" variant="outline" size="icon" aria-label="One point fewer" disabled={submitting}
                    aria-disabled={points === 1} className="text-lg aria-disabled:opacity-50" onClick={() => step(-1)}>
                    <span aria-hidden="true">−</span>
                  </Button>
                  <NumberInput id="award-points" inputMode="numeric" followModel
                    value={points} emptyValue="" min={1} max={MAX_AWARD} disabled={submitting}
                    aria-invalid={showRule} aria-describedby={showRule ? 'award-points-rule' : undefined}
                    onChange={setAmount} onWheel={(e) => e.currentTarget.blur()}
                    className="w-16 px-0 text-center text-lg font-semibold tabular-nums" />
                  <Button type="button" variant="outline" size="icon" aria-label="One point more" disabled={submitting}
                    aria-disabled={points === MAX_AWARD} className="text-lg aria-disabled:opacity-50" onClick={() => step(1)}>
                    <span aria-hidden="true">+</span>
                  </Button>
                </div>
              </div>
              {showRule && (
                <p id="award-points-rule" role="alert" className="text-xs text-destructive">Points must be a whole number from 1 to {MAX_AWARD}.</p>
              )}
              </>
            )}
          </section>
          <section className="space-y-2 border-t border-border pt-5">
            <Label htmlFor="award-note">Add a note (optional)</Label>
            <Textarea id="award-note" value={note} maxLength={500} rows={3}
              placeholder="What went well?" onChange={(e) => setNote(e.target.value)} />
          </section>
          {/* The live region stays in the page, so a change of amount is announced. */}
          <div aria-live="polite" aria-atomic="true">
            {valid && child && (
              <div className="rounded-md bg-warning p-3">
                <p className="font-semibold text-foreground">{child.name} earns {points} Percy {points === 1 ? 'Point' : 'Points'}</p>
                <p className="text-sm text-muted-foreground">For {chosen.name}.</p>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button className="flex-1" onClick={submit} disabled={!valid || submitting}>
            {valid ? `Award ${points} ${pointWord(points)}` : 'Award points'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
