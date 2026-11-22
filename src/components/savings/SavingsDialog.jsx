// "Saving for something bigger" Edit (D1, savings design §19.3). A parent
// chooses one of the child's bigger goals, then saves points towards it or
// moves points back, with Undo; and redeems the goal when it is within reach
// (O7). Limits come from the server's figures (child.available_points and the
// goal's saved, cost and to_go in child.goals); the server re-checks every one.
//
// Wording: "Saving for something bigger" and "Saved: {n}" are approved; "Save
// points" and "Move points back" are the owner's proposed O4 wording; the
// rest is provisional for the owner's screen review (§19.8).
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import NumberInput from '@/components/ui/NumberInput';
import RewardIcon from '@/components/rewards/RewardIcon';
import { cn } from '@/lib/utils';
import { refreshPoints, undoAction, UNDO_TOAST_MS, newRequestId, MAX_AWARD } from '@/lib/points';
import { saveTowards, moveBack, undoSavings, redeemGoal, pointsWord, leadingGoal } from '@/lib/savings';

const STALE = "That didn't work: the figures changed. Check them and try again.";
const OFFLINE = "Couldn't save that. Check your connection and try again.";

// The savings Undo: one request id per toast, one tap at a time, and on a
// connection failure the same undo is offered again (as undoAction does).
export function undoSavingsAction(eventId, queryClient, requestId = newRequestId()) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      const r = await undoSavings(eventId, requestId);
      toast.success(`Undone. ${r.child.name} has ${r.child.available_points} ${pointsWord(r.child.available_points)} available.`);
    } catch (err) {
      if (err.status === 409 || err.status === 404) {
        toast.error(err.message || STALE);
      } else {
        toast.error("Couldn't undo that. Check your connection.", {
          duration: UNDO_TOAST_MS,
          action: { label: 'Try again', onClick: undoSavingsAction(eventId, queryClient, requestId) },
        });
      }
    } finally {
      running = false;
      refreshPoints(queryClient);
    }
  };
}

export default function SavingsDialog({ open, onClose, child, goalRewards, returnFocusRef = null }) {
  const queryClient = useQueryClient();
  const [goalId, setGoalId] = useState(null);
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmRedeem, setConfirmRedeem] = useState(false);
  const busyRef = useRef(false); // state alone lets two taps in one tick through
  // One request id per action for the life of the open dialog, kept until
  // that action succeeds or is refused, so a retry after a lost reply can
  // only replay, whatever else was tried in between (code review).
  const ids = useRef(new Map());

  // A goal already asked for cannot be saved towards (S1): left out here.
  const requested = useMemo(() => new Set((child?.reward_stack_priced || []).map((i) => i.rewardId)), [child]);
  const serverGoals = useMemo(() => new Map((child?.goals || []).map((g) => [g.rewardId, g])), [child]);
  const options = useMemo(() => (goalRewards || []).filter((r) => !requested.has(r.id)).map((r) => {
    const g = serverGoals.get(r.id);
    // The server's figures when the goal has savings; a goal with none is at
    // 0 saved and needs its whole cost.
    return g
      ? { id: r.id, name: g.name, cost: g.cost, saved: g.saved, toGo: g.to_go, reward: r }
      : { id: r.id, name: r.title, cost: r.cost_points, saved: 0, toGo: r.cost_points, reward: r };
  }), [goalRewards, requested, serverGoals]);

  useEffect(() => {
    if (!open) return;
    setAmount(0);
    setConfirmRedeem(false);
    ids.current = new Map();
    // The same goal Home and Child View lead with.
    const lead = leadingGoal(child?.goals || []);
    setGoalId(options.some((o) => o.id === lead?.rewardId) ? lead.rewardId : (options[0]?.id ?? null));
  }, [open, child?.id]); // reset on each opening, and for another child

  if (!child) return null;
  const goal = options.find((o) => o.id === goalId) || null;
  const available = child.available_points ?? 0;
  const saved = goal?.saved ?? 0;
  const whole = Number.isInteger(amount) && amount >= 1;
  // The server refuses more than available or more than the goal still needs.
  // One move is at most MAX_AWARD points (the server's limit per request).
  const maxSave = goal ? Math.max(0, Math.min(available, goal.toGo, MAX_AWARD)) : 0;
  const maxBack = Math.min(saved, MAX_AWARD);
  const canSave = !!goal && whole && amount <= maxSave && !busy;
  const canMoveBack = !!goal && whole && amount <= maxBack && !busy;
  const canRedeem = !!goal && saved + available >= goal.cost && !busy;
  const fromSaved = goal ? Math.min(saved, goal.cost) : 0;

  const idFor = (key) => {
    if (!ids.current.has(key)) ids.current.set(key, newRequestId());
    return ids.current.get(key);
  };
  const begin = () => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    return true;
  };
  const end = () => { busyRef.current = false; setBusy(false); refreshPoints(queryClient); };
  const fail = (err, key) => {
    if (err.status && err.status < 500) {
      ids.current.delete(key); // refused: trying again is a new action
      toast.error(err.message || STALE);
    } else {
      toast.error(OFFLINE); // the id is kept, so a retry can only replay
    }
  };

  const move = async (kind) => {
    if (!goal || !begin()) return;
    const key = `${kind}:${goal.id}:${amount}`;
    try {
      const r = await (kind === 'save'
        ? saveTowards(child.id, goal.id, amount, idFor(key))
        : moveBack(child.id, goal.id, amount, idFor(key)));
      ids.current.delete(key);
      const message = kind === 'save'
        ? `Saved ${amount} ${pointsWord(amount)} towards ${goal.name}`
        : `Moved ${amount} ${pointsWord(amount)} back from ${goal.name}`;
      toast.success(message, { duration: UNDO_TOAST_MS, action: { label: 'Undo', onClick: undoSavingsAction(r.event.id, queryClient) } });
      // Close, as the award dialog does: while a modal dialog is open the
      // page behind it (the toast and its Undo) cannot be used (e2e, §19.8).
      onClose();
    } catch (err) {
      fail(err, key);
    } finally {
      end();
    }
  };

  const redeem = async () => {
    if (!goal || !begin()) return;
    const key = `redeem:${goal.id}`;
    try {
      const r = await redeemGoal(child.id, goal.id, idFor(key));
      ids.current.delete(key);
      setConfirmRedeem(false);
      toast.success(`${goal.name} redeemed for ${child.name}`, {
        duration: UNDO_TOAST_MS,
        action: { label: 'Undo', onClick: undoAction('spend', r.redemption.id, queryClient) },
      });
      onClose();
    } catch (err) {
      setConfirmRedeem(false);
      fail(err, key);
    } finally {
      end();
    }
  };

  const focusBack = (e) => {
    if (returnFocusRef?.current) { e.preventDefault(); returnFocusRef.current.focus(); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o && !busyRef.current) onClose(); }}>
        <DialogContent className="sm:max-w-lg" onCloseAutoFocus={focusBack}>
          <DialogHeader>
            <DialogTitle className="text-title font-extrabold text-primary">Saving for something bigger</DialogTitle>
            <DialogDescription>
              Set points aside for {child.name}'s bigger goal. Saved points stay {child.name}'s; you can move them back.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">Bigger goal</legend>
              {options.map((o) => (
                <label key={o.id} className={cn('flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3',
                  o.id === goalId ? 'border-2 border-selected-border bg-selected' : 'border-border bg-card hover:bg-accent')}>
                  <input type="radio" name="savings-goal" value={o.id} checked={o.id === goalId}
                    onChange={() => { setGoalId(o.id); setAmount(0); }} className="h-4 w-4 accent-primary" />
                  <RewardIcon reward={o.reward} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-foreground break-words">{o.name}</span>
                    <span className="block text-sm text-muted-foreground tabular-nums">
                      {o.saved} of {o.cost} points saved{o.saved >= o.cost ? ' · Ready to redeem' : ''}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            {goal && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-border p-3">
                    <p className="font-display font-extrabold text-title text-foreground tabular-nums" data-saved>Saved: {saved}</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="font-display font-extrabold text-title text-foreground tabular-nums" data-available>{available}</p>
                    <p className="text-sm font-medium text-muted-foreground">Available now</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="savings-amount">Points</Label>
                  <NumberInput id="savings-amount" value={amount} onChange={setAmount} min="1" max={Math.max(maxSave, maxBack, 1)}
                    inputMode="numeric" aria-describedby="savings-amount-help" />
                  <p id="savings-amount-help" className="text-xs text-muted-foreground">
                    Save up to {maxSave} · Move back up to {maxBack}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" onClick={() => move('save')} disabled={!canSave}>Save points</Button>
                  <Button type="button" variant="outline" onClick={() => move('release')} disabled={!canMoveBack}>Move points back</Button>
                </div>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={busy}>Close</Button>
            {goal && (
              <Button type="button" className="flex-1" onClick={() => setConfirmRedeem(true)} disabled={!canRedeem}
                aria-label={`Redeem ${goal.name}`}>
                Redeem
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRedeem} onOpenChange={(o) => { if (!busyRef.current) setConfirmRedeem(o); }}>
        <AlertDialogContent onCloseAutoFocus={focusBack}>
          <AlertDialogHeader>
            <AlertDialogTitle>Redeem {goal?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will spend {goal?.cost} points from {child.name}'s balance: {fromSaved} saved and {(goal?.cost ?? 0) - fromSaved} available.
            </AlertDialogDescription>
            {/* E12 (owner review of #64): an excess over a lowered cost stays saved, never lost or counted twice. */}
            {saved > (goal?.cost ?? 0) && (
              <p className="text-sm text-muted-foreground" data-excess>
                {saved - goal.cost} saved points are more than this goal needs. They stay saved for {goal.name}, and you can move them back.
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); redeem(); }}>Redeem</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
