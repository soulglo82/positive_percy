// "Saving for something bigger" Edit (D1, savings design §19.3). A parent
// chooses one of the child's bigger goals, then saves points towards it or
// moves points back, with Undo; and redeems the goal when it is within reach
// (O7). Amounts are limited by the server's figures: up to available_points to
// save, up to what is saved to move back. The server re-checks every one.
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
import { refreshPoints, undoSpend, UNDO_TOAST_MS, newRequestId } from '@/lib/points';
import { saveTowards, moveBack, undoSavings, redeemGoal, pointsWord } from '@/lib/savings';

const STALE = "That didn't work: the figures changed. Check them and try again.";
const OFFLINE = "Couldn't save that. Check your connection and try again.";

export default function SavingsDialog({ open, onClose, child, goalRewards }) {
  const queryClient = useQueryClient();
  const [goalId, setGoalId] = useState(null);
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmRedeem, setConfirmRedeem] = useState(false);
  const requestRef = useRef(null); // one id per action, reused if the same action is retried

  const savedById = useMemo(() => new Map((child?.goals || []).map((g) => [g.rewardId, g.saved])), [child]);
  const options = useMemo(() => (goalRewards || []).map((r) => ({
    id: r.id, name: r.title, cost: r.cost_points, saved: savedById.get(r.id) ?? 0, reward: r,
  })), [goalRewards, savedById]);

  useEffect(() => {
    if (!open) return;
    setAmount(0);
    setConfirmRedeem(false);
    requestRef.current = null;
    setGoalId((cur) => (options.some((o) => o.id === cur) ? cur : (options.slice().sort((a, b) => b.saved - a.saved)[0]?.id ?? null)));
  }, [open]); // reset on each opening only

  if (!child) return null;
  const goal = options.find((o) => o.id === goalId) || null;
  const available = child.available_points ?? 0;
  const saved = goal?.saved ?? 0;
  const whole = Number.isInteger(amount) && amount >= 1;
  // The server refuses more than available or more than the goal still needs.
  const maxSave = goal ? Math.max(0, Math.min(available, goal.cost - saved)) : 0;
  const canSave = !!goal && whole && amount <= maxSave && !busy;
  const canMoveBack = !!goal && whole && amount <= saved && !busy;
  const canRedeem = !!goal && saved + available >= goal.cost && !busy;
  const fromSaved = goal ? Math.min(saved, goal.cost) : 0;

  const fail = (err) => {
    if (err.status === 400 || err.status === 409 || err.status === 404) toast.error(STALE);
    else toast.error(OFFLINE);
  };

  const undoMove = (eventId) => {
    const undoId = newRequestId();
    let running = false;
    return async () => {
      if (running) return;
      running = true;
      try {
        await undoSavings(eventId, undoId);
        toast.success('Undone.');
      } catch (err) {
        toast.error(err.status === 409 || err.status === 404 ? (err.message || STALE) : OFFLINE);
      } finally {
        running = false;
        refreshPoints(queryClient);
      }
    };
  };

  const move = async (kind) => {
    if (!goal || busy) return;
    const key = `${kind}:${goal.id}:${amount}`;
    if (requestRef.current?.key !== key) requestRef.current = { key, id: newRequestId() };
    setBusy(true);
    try {
      const r = await (kind === 'save'
        ? saveTowards(child.id, goal.id, amount, requestRef.current.id)
        : moveBack(child.id, goal.id, amount, requestRef.current.id));
      requestRef.current = null;
      setAmount(0);
      const message = kind === 'save'
        ? `Saved ${amount} ${pointsWord(amount)} towards ${goal.name}`
        : `Moved ${amount} ${pointsWord(amount)} back from ${goal.name}`;
      toast.success(message, { duration: UNDO_TOAST_MS, action: { label: 'Undo', onClick: undoMove(r.event.id) } });
      // Close, as the award dialog does: while a modal dialog is open the
      // page behind it (the toast and its Undo) cannot be used (e2e, §19.8).
      onClose();
    } catch (err) {
      if (err.status && err.status < 500) requestRef.current = null; // refused: a new attempt is a new action
      fail(err);
    } finally {
      setBusy(false);
      refreshPoints(queryClient);
    }
  };

  const redeem = async () => {
    if (!goal || busy) return;
    const key = `redeem:${goal.id}`;
    if (requestRef.current?.key !== key) requestRef.current = { key, id: newRequestId() };
    setBusy(true);
    try {
      const r = await redeemGoal(child.id, goal.id, requestRef.current.id);
      requestRef.current = null;
      setConfirmRedeem(false);
      const undoId = newRequestId();
      toast.success(`${goal.name} redeemed for ${child.name}`, {
        duration: UNDO_TOAST_MS,
        action: {
          label: 'Undo',
          onClick: async () => {
            try { await undoSpend(r.redemption.id, undoId); toast.success('Undone.'); }
            catch (err) { toast.error(err.status === 409 || err.status === 404 ? (err.message || STALE) : OFFLINE); }
            finally { refreshPoints(queryClient); }
          },
        },
      });
      onClose();
    } catch (err) {
      if (err.status && err.status < 500) requestRef.current = null;
      setConfirmRedeem(false);
      fail(err);
    } finally {
      setBusy(false);
      refreshPoints(queryClient);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
        <DialogContent className="sm:max-w-lg">
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
                    <span className="block text-sm text-muted-foreground tabular-nums">{o.saved} of {o.cost} points saved</span>
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
                  <NumberInput id="savings-amount" value={amount} onChange={setAmount} min="1" max={Math.max(maxSave, saved, 1)}
                    inputMode="numeric" aria-describedby="savings-amount-help" />
                  <p id="savings-amount-help" className="text-xs text-muted-foreground">
                    Save up to {maxSave} · Move back up to {saved}
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

      <AlertDialog open={confirmRedeem} onOpenChange={(o) => { if (!busy) setConfirmRedeem(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redeem {goal?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will spend {goal?.cost} points from {child.name}'s balance: {fromSaved} saved and {(goal?.cost ?? 0) - fromSaved} available.
            </AlertDialogDescription>
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
