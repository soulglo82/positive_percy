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

export default function RewardForm({ isOpen, onClose, reward = null, initialTemplate = null, children = [], onSubmit, onDelete }) {
  const editing = !!reward;
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
  const opened = useRef(false);

  // Fresh form on each opening: from the reward, the starter template, or blank.
  useEffect(() => {
    if (!isOpen) { opened.current = false; return; }
    if (opened.current) return;
    opened.current = true;
    const src = reward || initialTemplate || {};
    setTitle(src.title || '');
    setCostPoints(src.cost_points ?? 50);
    setDescription(src.description || '');
    setVisible(reward ? reward.visible_to_child !== false : true);
    setBiggerGoal(!!reward?.is_bigger_goal);
    setAssigned(reward?.assigned_child_ids || []);
    setIconKey(reward?.icon_key ?? null);
    setIconTouched(false);
    setPickerOpen(!reward); // approved: a new reward opens the picker; edit starts closed
    setSaving(false);
  }, [isOpen, reward, initialTemplate]);

  // What the reward looks like now: the chosen icon, else its own image/emoji.
  const emoji = reward?.emoji || initialTemplate?.emoji || DEFAULT_EMOJI;
  const preview = { icon_key: iconKey, image_url: reward?.image_url || null, emoji };
  const valid = title.trim().length > 0 && Number.isInteger(costPoints) && costPoints >= 1;

  const choose = (id) => { setIconKey(id); setIconTouched(true); };
  const toggleChild = (id) => setAssigned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // O6: un-marking a bigger goal, or taking it away from a child, ends what
  // was saved towards it for good (the points return to available; marking it
  // again starts from 0). Say so before saving (code review of the screens).
  const lower = (ids) => (ids || []).map((x) => String(x).toLowerCase());
  const hadFor = (id) => { const was = lower(reward?.assigned_child_ids); return was.length === 0 || was.includes(String(id).toLowerCase()); };
  const hasFor = (id) => { const now = lower(assigned); return now.length === 0 || now.includes(String(id).toLowerCase()); };
  // Who loses the goal, and how much each has saved towards it (server figures,
  // child.goals). Nothing saved: nothing is lost, so no warning (§20.3).
  const losing = !reward?.is_bigger_goal ? [] : children
    .filter((c) => hadFor(c.id) && (!biggerGoal || !hasFor(c.id)))
    .map((c) => ({ name: c.name, saved: (c.goals || []).find((g) => String(g.rewardId) === String(reward.id))?.saved ?? 0 }))
    .filter((c) => c.saved > 0);
  const endsSavings = losing.length > 0;

  const save = async (confirmed = false) => {
    if (!valid || saving) return;
    if (endsSavings && confirmed !== true) { setConfirmEnd(true); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        cost_points: costPoints,
        description: description.trim(),
        visible_to_child: visible,
        is_bigger_goal: biggerGoal,
        assigned_child_ids: assigned,
        ...(editing ? {} : { emoji }),
        ...(iconTouched ? { icon_key: iconKey } : {}),
      };
      const ok = await onSubmit(payload);
      if (ok === false) return;
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            {/* Owner-approved wording C1 and C2 (2026-11-19). */}
            <DialogTitle className="text-title font-extrabold text-primary">{reward ? 'Edit reward' : 'Add reward'}</DialogTitle>
            <DialogDescription>Name the reward, set its points cost and choose an icon.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
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
                <Checkbox id="reward-bigger-goal" checked={biggerGoal} onCheckedChange={(v) => setBiggerGoal(v === true)}
                  aria-describedby="reward-bigger-goal-help" className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">Bigger goal</span>
                  <span id="reward-bigger-goal-help" className="block text-xs text-muted-foreground">Save points towards this reward over time</span>
                </span>
              </label>
              {endsSavings && (
                <div role="status" className="space-y-1 rounded-md border border-border bg-warning p-3 text-sm text-foreground">
                  {losing.map((c) => <p key={c.name}>{c.name}: {c.saved} saved {c.saved === 1 ? 'point' : 'points'} will become available again.</p>)}
                  <p>Past savings won't be restored if you re-enable the goal.</p>
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
            {pickerOpen && (
              <section className="space-y-3 border-t border-border pt-5">
                <StepHeading n={2} title="Choose an icon" />
                <RewardPicker id="reward-icon-picker" value={iconKey} onChange={choose} />
              </section>
            )}
            {editing && onDelete && (
              <div className="border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setConfirmDelete(true)} disabled={saving}>
                  Delete Reward
                </Button>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="button" className="flex-1" onClick={() => save()} disabled={!valid || saving}>Save reward</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this bigger goal's savings?</AlertDialogTitle>
            <AlertDialogDescription>
              {losing.map((c) => `${c.name}: ${c.saved} saved ${c.saved === 1 ? 'point' : 'points'} will become available again.`).join(' ')} Past savings won't be restored if you re-enable the goal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep saving</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmEnd(false); save(true); }}>Save reward</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {reward?.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this reward. Any pending redemptions will be denied. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmDelete(false); onDelete(reward); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
