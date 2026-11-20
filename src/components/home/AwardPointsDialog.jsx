// V1 "Give Percy Points" (approved design 9de1df2, screen "award";
// docs/engineering/V1-F-DESIGN.md A). The amount is the chosen behaviour's
// points; the award itself goes through the caller's applyAward (lock, Undo
// toast, streak, badges).
import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import CategoryIcon from '@/components/CategoryIcon';
import { FamilyStrip } from '@/components/home/HomeSections';

// A1: unassigned behaviours, or ones assigned to this child.
export const behavioursFor = (categories, childId) => categories.filter((c) =>
  !c.assigned_children?.length || c.assigned_children.includes(childId));

export const pointWord = (n) => (n === 1 ? 'point' : 'points');

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

  const child = children.find((c) => c.id === childId) || children[0];
  const offered = child ? behavioursFor(categories, child.id) : [];
  const chosen = offered.find((c) => c.id === categoryId) || null;

  // Fresh form each time it opens, for the child it was opened for.
  useEffect(() => {
    if (!isOpen) return;
    setChildId(initialChildId);
    setCategoryId(null);
    setNote('');
  }, [isOpen, initialChildId]);

  // A2: keep the behaviour if this child can use it, otherwise their first.
  useEffect(() => {
    if (!isOpen) return;
    if (!chosen && offered.length) setCategoryId(offered[0].id);
  }, [isOpen, chosen, offered]);

  const points = chosen ? (chosen.points ?? 1) : 0;

  const submit = async () => {
    if (submitting || !child || !chosen) return;
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
            <FamilyStrip children={children} selectedId={child?.id} onSelect={setChildId} />
          </section>
          <section className="space-y-3 border-t border-border pt-5">
            <StepHeading n={2} id="award-behaviour" title={`What did ${child?.name || 'they'} do?`} hint="Choose a positive behaviour." />
            {offered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add a behaviour in Family settings first.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="award-behaviour">
                {offered.map((cat) => {
                  const on = cat.id === chosen?.id;
                  return (
                    <button key={cat.id} type="button" aria-pressed={on} onClick={() => setCategoryId(cat.id)}
                      className={cn('flex items-center gap-1.5 min-h-11 rounded-md px-2 py-3 text-left text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        on ? 'border-2 border-selected-border bg-selected' : 'border border-border bg-card hover:bg-accent')}>
                      <span aria-hidden="true" className="text-primary"><CategoryIcon iconKey={cat.icon_key} className="h-5 w-5" /></span>
                      <span className="flex-1 min-w-0">{cat.name}</span>{' '}
                      <span className="shrink-0 rounded-md bg-star px-1.5 py-0.5 text-sm font-semibold tabular-nums">+{cat.points ?? 1}</span>
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
          {chosen && child && (
            <div className="rounded-md bg-warning p-3" aria-live="polite">
              <p className="font-semibold text-foreground">{child.name} earns {points} Percy {points === 1 ? 'Point' : 'Points'}</p>
              <p className="text-sm text-muted-foreground">For {chosen.name}.</p>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button className="flex-1" onClick={submit} disabled={!chosen || submitting}>
            {chosen ? `Award ${points} ${pointWord(points)}` : 'Award points'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
