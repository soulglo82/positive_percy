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
import { PERCY } from '@/constants/terminology';
import { cn } from '@/lib/utils';
import BehaviourTileParts, { TILE_GRID, TILE_LAYOUT } from '@/components/home/BehaviourTile';
import { FamilyStrip } from '@/components/home/HomeSections';

// A1: unassigned behaviours, or ones assigned to this child.
export const behavioursFor = (categories, childId) => categories.filter((c) =>
  !c.assigned_children?.length || c.assigned_children.includes(childId));

export const pointWord = (n) => (n === 1 ? 'point' : 'points');

// The old dialog's quick amounts.
const QUICK_AMOUNTS = [1, 2, 3, 4, 5, 10];
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
  // The parent's own amount: null until they choose one (a quick amount or a
  // typed number), '' when they have cleared the field. While it is null the
  // amount is the chosen behaviour's points; once chosen it stays until the
  // dialog closes, whatever behaviour or child is picked next.
  const [ownAmount, setOwnAmount] = useState(null);

  const child = children.find((c) => c.id === childId) || children[0];
  const offered = child ? behavioursFor(categories, child.id) : [];
  const chosen = offered.find((c) => c.id === categoryId) || null;

  // Fresh form each time it opens, for the child it was opened for.
  useEffect(() => {
    if (!isOpen) return;
    setChildId(initialChildId);
    setCategoryId(null);
    setNote('');
    setOwnAmount(null);
  }, [isOpen, initialChildId]);

  // A2: keep the behaviour if this child can use it, otherwise their first.
  useEffect(() => {
    if (!isOpen) return;
    if (!chosen && offered.length) setCategoryId(offered[0].id);
  }, [isOpen, chosen, offered]);

  const points = ownAmount === null ? (chosen ? (chosen.points ?? 1) : '') : ownAmount;
  const valid = !!chosen && canAward(points);
  // Nothing is said about an empty field; anything else that cannot be awarded gets the rule.
  const showRule = points !== '' && !canAward(points);
  // Tapping the amount that is already showing changes nothing: it does not
  // turn the behaviour's points into a chosen amount behind the parent's back.
  // While an award is being sent, nothing that decides the amount moves: the
  // amount controls are disabled, and a child or behaviour picked in flight is
  // ignored (it would show another amount than the one sent).
  const pickChild = (id) => { if (!submitting) setChildId(id); };
  const pickBehaviour = (id) => { if (!submitting) setCategoryId(id); };
  const pickAmount = (n) => {
    if (ownAmount === null && n === points) return;
    setOwnAmount(n);
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
          {offered.length > 0 && (
            <section className="space-y-3 border-t border-border pt-5">
              <StepHeading n={2} id="award-amount" title="How many points?" hint="Use the behaviour's points, or choose another amount." />
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" role="group" aria-labelledby="award-amount">
                {QUICK_AMOUNTS.map((n) => (
                  <Button key={n} type="button" size="sm" variant={points === n ? 'default' : 'outline'} disabled={submitting}
                    aria-pressed={points === n} className="tabular-nums" onClick={() => pickAmount(n)}>
                    +{n}
                  </Button>
                ))}
              </div>
              {/* followModel: the field shows an amount that was not typed (a quick
                  amount, the behaviour's points changing) even while it has focus,
                  as a screen reader or switch can leave it. It is never remounted:
                  a remount drops the keyboard focus in the middle of typing. */}
              <NumberInput id="award-points" aria-label={PERCY.POINTS_COMPACT} inputMode="numeric" followModel
                value={points} emptyValue="" min={1} max={MAX_AWARD} disabled={submitting}
                aria-invalid={showRule} aria-describedby={showRule ? 'award-points-rule' : undefined}
                onChange={setOwnAmount} onWheel={(e) => e.currentTarget.blur()}
                className="text-lg font-semibold tabular-nums" />
              {showRule && (
                <p id="award-points-rule" role="alert" className="text-xs text-destructive">Points must be a whole number from 1 to {MAX_AWARD}.</p>
              )}
            </section>
          )}
          <section className="space-y-3 border-t border-border pt-5">
            <StepHeading n={offered.length > 0 ? 3 : 2} id="award-behaviour" title={`What did ${child?.name || 'they'} do?`} hint="Choose a positive behaviour." />
            {offered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add a behaviour in Family settings first.</p>
            ) : (
              <div className={TILE_GRID} role="group" aria-labelledby="award-behaviour" data-tile-grid>
                {offered.map((cat) => {
                  const on = cat.id === chosen?.id;
                  return (
                    <button key={cat.id} type="button" aria-pressed={on} onClick={() => pickBehaviour(cat.id)} data-tile
                      className={cn(TILE_LAYOUT, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        on ? 'border-2 border-selected-border bg-selected' : 'border border-border bg-card hover:bg-accent')}>
                      <BehaviourTileParts iconKey={cat.icon_key} name={cat.name} points={cat.points ?? 1} />
                    </button>
                  );
                })}
              </div>
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
