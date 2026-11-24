// V1-D reward form, "Add reward" / "Edit reward" (approved design 9de1df2, screen "rewardform";
// docs/engineering/V1-D-DESIGN.md §4.2 and §10). Replaces the Add/Edit reward
// modals. icon_key is only ever set by a parent's tap on an icon (D2: no
// automatic assignment) and only sent when it changed; a reward's emoji and
// image are never touched.
import { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import NumberInput from '@/components/ui/NumberInput';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { StepHeading } from '@/components/home/AwardPointsDialog';
import { pickerLabel } from '@/lib/rewardPicker';
import { ChildAssignList } from './RewardFormParts';
import RewardIcon, { rewardArt } from './RewardIcon';
import RewardPicker from './RewardPicker';

const DEFAULT_EMOJI = '🎁';

// C3 (owner-approved): what the reward shows before a picker icon is chosen.
// A photo is "Current image"; an icon or emoji (or the gift) is "Current icon".
// Same precedence as RewardIcon: a known picker icon wins, then a photo.
export const currentArtLabel = (reward) =>
  (reward?.image_url && !rewardArt(reward?.icon_key) ? 'Current image' : 'Current icon');

// `variant="bigGoal"` (V1-F §12 W7): the short form the Daily Wins & Big Goals
// pop-up uses. A new one is a Big Goal for `forChild`; an edit sends only the
// name, the cost and a changed picture, so it can never change who the goal
// is for, hide it, un-mark it or end savings. `embedded` renders the form's
// header, body and footer without a dialog of its own (§12 W8).
export default function RewardForm({ isOpen, onClose, reward = null, initialTemplate = null, children = [], onSubmit, onDelete,
  variant = 'reward', forChild = null, embedded = false, titleRef = null }) {
  const editing = !!reward;
  const big = variant === 'bigGoal';
  const [title, setTitle] = useState('');
  const [costPoints, setCostPoints] = useState(50);
  const [description, setDescription] = useState('');
  const [visible, setVisible] = useState(true);
  const [biggerGoal, setBiggerGoal] = useState(false);
  const [assigned, setAssigned] = useState([]);
  const [iconKey, setIconKey] = useState(null);
  const [iconTouched, setIconTouched] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  // D1 §21: what the server says this save (or delete) would release, when it
  // differs from what this page knew. It replaces the local list in both
  // warnings, and its snapshot is what the parent then confirms.
  const [serverEnding, setServerEnding] = useState(null);
  const [deleteEnding, setDeleteEnding] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const opened = useRef(false);

  // Fresh form on each opening: from the reward, the starter template, or blank.
  useEffect(() => {
    if (!isOpen) { opened.current = false; return; }
    if (opened.current) return;
    opened.current = true;
    const src = reward || initialTemplate || {};
    setTitle(src.title || '');
    setCostPoints(src.cost_points ?? (big ? 100 : 50));
    setDescription(src.description || '');
    setVisible(reward ? reward.visible_to_child !== false : true);
    setBiggerGoal(big ? true : !!reward?.is_bigger_goal);
    setAssigned(reward?.assigned_child_ids || (big && forChild ? [forChild.id] : []));
    setIconKey(reward?.icon_key ?? null);
    setIconTouched(false);
    setPickerOpen(big ? false : !reward); // approved: a new reward opens the picker; edit starts closed. A Big Goal opens it on Change
    setSaving(false);
    setServerEnding(null);
    setDeleteEnding(null);
  }, [isOpen, reward, initialTemplate]);

  // What the reward looks like now: the chosen icon, else its own image/emoji.
  // An existing reward shows what its tile shows: its own emoji, or the gift
  // icon when it has none (design critique: the form showed a gift emoji for a
  // reward whose tile shows the gift icon). A new reward starts with the default.
  const emoji = reward ? (reward.emoji || null) : (initialTemplate?.emoji || DEFAULT_EMOJI);
  const preview = { icon_key: iconKey, image_url: reward?.image_url || null, emoji };
  const valid = title.trim().length > 0 && Number.isInteger(costPoints) && costPoints >= 1;

  const choose = (id) => { setIconKey(id); setIconTouched(true); };
  // A change to what is being saved makes any list from the server stale.
  const toggleChild = (id) => { setServerEnding(null); setAssigned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); };

  // O6: un-marking a bigger goal, or taking it away from a child, ends what
  // was saved towards it for good (the points return to available; marking it
  // again starts from 0). Say so before saving (code review of the screens).
  const lower = (ids) => (ids || []).map((x) => String(x).toLowerCase());
  const hadFor = (id) => { const was = lower(reward?.assigned_child_ids); return was.length === 0 || was.includes(String(id).toLowerCase()); };
  const hasFor = (id) => { const now = lower(assigned); return now.length === 0 || now.includes(String(id).toLowerCase()); };
  // Who loses the goal, and how much each has saved towards it (server figures,
  // child.goals). Nothing saved: nothing is lost, so no warning (§20.3).
  // A Big Goal edit from the pop-up sends no assignment and no mark, so it
  // can end nobody's savings whatever this form's copy says (§12 X21).
  const losing = (!reward?.is_bigger_goal || (big && editing)) ? [] : children
    .filter((c) => hadFor(c.id) && (!biggerGoal || !hasFor(c.id)))
    .map((c) => ({ id: c.id, name: c.name, saved: (c.goals || []).find((g) => String(g.rewardId) === String(reward.id))?.saved ?? 0 }))
    .filter((c) => c.saved > 0);
  // The local snapshot: the reward row's generations and each child's amount.
  const snapshotOf = (list) => ({
    goal_epoch: reward?.goal_epoch ?? 0,
    goal_child_epochs: reward?.goal_child_epochs || {},
    children: list.map((c) => ({ child_id: c.id, saved: c.saved })),
  });
  const shown = serverEnding ? serverEnding.ending.map((e) => ({ id: e.child_id, name: e.name, saved: e.saved })) : losing;
  const endsSavings = shown.length > 0;
  // A delete ends the savings of every child who has some in this goal.
  const deletingFrom = !reward?.is_bigger_goal ? [] : children
    .filter((c) => hadFor(c.id))
    .map((c) => ({ id: c.id, name: c.name, saved: (c.goals || []).find((g) => String(g.rewardId) === String(reward.id))?.saved ?? 0 }))
    .filter((c) => c.saved > 0);
  const deleteShown = deleteEnding ? deleteEnding.ending.map((e) => ({ id: e.child_id, name: e.name, saved: e.saved })) : deletingFrom;
  const releaseLine = (c) => `${c.name || 'A child'}: ${c.saved} saved ${c.saved === 1 ? 'point' : 'points'} will become available again.`;

  const save = async (confirmed = false) => {
    if (!valid || saving) return;
    if (endsSavings && confirmed !== true) { setConfirmEnd(true); return; }
    setSaving(true);
    try {
      const payload = big && editing ? {
        title: title.trim(),
        cost_points: costPoints,
        ...(iconTouched ? { icon_key: iconKey } : {}),
      } : {
        title: title.trim(),
        cost_points: costPoints,
        description: description.trim(),
        visible_to_child: big ? true : visible,
        is_bigger_goal: big ? true : biggerGoal,
        assigned_child_ids: assigned,
        ...(editing ? {} : { emoji }),
        ...(iconTouched ? { icon_key: iconKey } : {}),
        // Only after the parent confirmed the per-child warning: exactly what
        // was shown (§21), the server's list when it sent one.
        ...(confirmed === true && endsSavings ? { confirm_end_savings: serverEnding ? serverEnding.snapshot : snapshotOf(losing) } : {}),
      };
      const ok = await onSubmit(payload);
      if (ok?.needsConfirm) { setServerEnding(ok.needsConfirm); setConfirmEnd(true); return; }
      if (ok === false) return;
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // Who a Big Goal is for: the child it is being made for, or on an edit the
  // assigned children who still exist (ids compared in lower case).
  const forNames = () => {
    if (!editing) return forChild ? [forChild.name] : [];
    const ids = lower(reward.assigned_child_ids);
    return children.filter((c) => ids.includes(String(c.id).toLowerCase())).map((c) => c.name);
  };
  const listNames = (names) => (names.length <= 1 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]);
  const forLine = !big ? '' : (editing && lower(reward.assigned_child_ids).length === 0) || forNames().length === 0
    ? 'For the whole family' : 'For ' + listNames(forNames());
  const heading = big ? (reward ? 'Edit Big Goal' : 'New Big Goal') : (reward ? 'Edit reward' : 'Add reward');

  const content = (
    <>
          <DialogHeader className={big ? 'pb-2 pt-4' : undefined}>
            {/* Owner-approved wording C1 and C2 (2026-11-19). */}
            <DialogTitle ref={titleRef} tabIndex={-1} className={big ? 'text-lg text-primary focus-visible:outline-none' : 'text-title font-extrabold text-primary focus-visible:outline-none'}>{heading}</DialogTitle>
            <DialogDescription>{big ? forLine : 'Name the reward, set its points cost and choose an icon.'}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            {big ? (
              <section className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="reward-name">What is it?</Label>
                  <Input id="reward-name" value={title} maxLength={100} placeholder="e.g. New bike"
                    onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reward-cost">Points needed</Label>
                  <NumberInput id="reward-cost" value={costPoints} onChange={setCostPoints} min="1" />
                </div>
                <div className="flex items-center gap-3">
                  <RewardIcon reward={preview} size="md" />
                  <p className="min-w-0 flex-1 text-sm text-muted-foreground">Picture</p>
                  <Button type="button" variant="outline" aria-expanded={pickerOpen} aria-controls="reward-icon-picker"
                    aria-label={pickerOpen ? 'Hide pictures' : 'Change picture'} onClick={() => setPickerOpen((o) => !o)}>
                    {pickerOpen ? 'Hide' : 'Change'}
                  </Button>
                </div>
              </section>
            ) : (
            <section className="space-y-3">
              <StepHeading n={1} title="The reward" hint="Set the name and point cost." />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="reward-name">Reward name</Label>
                  <Input id="reward-name" value={title} maxLength={100} placeholder="e.g. Choose a movie"
                    onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reward-cost">Points needed</Label>
                  <NumberInput id="reward-cost" value={costPoints} onChange={setCostPoints} min="1" />
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-warning p-3">
                <RewardIcon reward={preview} size="md" className="bg-card" />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-foreground">{iconKey ? pickerLabel(iconKey) : currentArtLabel(reward)}</p>
                  <p className="text-sm text-muted-foreground">Selected reward icon</p>
                </div>
                <Button type="button" variant="outline" aria-expanded={pickerOpen} aria-controls="reward-icon-picker" onClick={() => setPickerOpen((o) => !o)}>
                  {pickerOpen ? 'Hide' : 'Change'}
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reward-description">Description (optional)</Label>
                <Textarea id="reward-description" value={description} rows={2} maxLength={1000}
                  onChange={(e) => setDescription(e.target.value)} />
              </div>
              <label htmlFor="reward-visible" className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 hover:bg-accent">
                <Checkbox id="reward-visible" checked={visible} onCheckedChange={(v) => setVisible(v === true)} />
                <span className="text-sm font-medium text-foreground">Visible to children</span>
              </label>
              {/* D1 (D7): a parent marks a bigger goal. Wording O4, proposed by the
                  owner; final approval at screen review. Un-marking ends the
                  goal's savings for good (O6), so say so when it is on. */}
              <label htmlFor="reward-bigger-goal" className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-1 py-2 hover:bg-accent">
                <Checkbox id="reward-bigger-goal" checked={biggerGoal} onCheckedChange={(v) => { setServerEnding(null); setBiggerGoal(v === true); }}
                  aria-describedby="reward-bigger-goal-help" className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">Big Goal</span>
                  <span id="reward-bigger-goal-help" className="block text-xs text-muted-foreground">Save points towards this reward over time</span>
                </span>
              </label>
              {endsSavings && (
                <div role="status" className="space-y-1 rounded-md border border-border bg-warning p-3 text-sm text-foreground">
                  {shown.map((c) => <p key={c.id}>{releaseLine(c)}</p>)}
                  <p>Past savings won't be restored if you make it a Big Goal again.</p>
                </div>
              )}
              {children.length > 0 && (
                <div>
                  <p className="mb-1 text-sm font-medium text-foreground">Assign to Children</p>
                  <p className="mb-2 text-xs text-muted-foreground">Leave unchecked to make available to all children</p>
                  <ChildAssignList children={children} selectedIds={assigned} onToggle={toggleChild} />
                </div>
              )}
            </section>
            )}
            {pickerOpen && (
              <section className="space-y-3 border-t border-border pt-5">
                {!big && <StepHeading n={2} title="Choose an icon" />}
                <RewardPicker id="reward-icon-picker" value={iconKey} onChange={choose} />
              </section>
            )}
            {editing && onDelete && (
              <div className="border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setConfirmDelete(true)} disabled={saving}>
                  {big ? 'Delete Big Goal' : 'Delete Reward'}
                </Button>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="button" className="flex-1" onClick={() => save()} disabled={!valid || saving}>{big ? 'Save Big Goal' : 'Save reward'}</Button>
          </DialogFooter>
    </>
  );

  return (
    <>
      {embedded ? content : (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
          <DialogContent className="sm:max-w-2xl">{content}</DialogContent>
        </Dialog>
      )}

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this Big Goal's savings?</AlertDialogTitle>
            <AlertDialogDescription>
              {shown.map(releaseLine).join(' ')} Past savings won't be restored if you make it a Big Goal again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep saving</AlertDialogCancel>
            {/* "End savings", not "Save reward": beside "Keep saving" two "save" labels meant opposite things (owner's handover, 22 Nov, W3). It saves the reward and ends the savings, as before. */}
            <AlertDialogAction onClick={() => { setConfirmEnd(false); save(true); }}>End savings</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={(o) => { if (deleting) return; setConfirmDelete(o); if (!o) setDeleteEnding(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {reward?.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              {big ? 'This will permanently delete this Big Goal for everyone it is for.' : 'This will permanently delete this reward.'} Any pending redemptions will be denied. This cannot be undone.
            </AlertDialogDescription>
            {/* D1 §21.2: what deleting a bigger goal releases, per child. */}
            {deleteShown.length > 0 && (
              <div role="status" className="space-y-1 rounded-md border border-border bg-warning p-3 text-sm text-foreground">
                {deleteShown.map((c) => <p key={c.id}>{releaseLine(c)}</p>)}
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} onClick={() => setDeleteEnding(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={async (e) => {
              e.preventDefault();
              if (deleting) return; // one request at a time (code review of 2074d55)
              setDeleting(true);
              try {
                const confirm = deleteShown.length ? (deleteEnding ? deleteEnding.snapshot : snapshotOf(deletingFrom)) : null;
                const r = await onDelete(reward, confirm);
                // The server saw something else: show its list and ask again.
                if (r?.needsConfirm) { setDeleteEnding(r.needsConfirm); return; }
                setConfirmDelete(false);
                setDeleteEnding(null);
              } finally {
                setDeleting(false);
              }
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
