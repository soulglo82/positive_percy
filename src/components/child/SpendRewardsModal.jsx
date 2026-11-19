import { useState } from 'react';
import { refreshPoints, spendReward, undoAction, UNDO_TOAST_MS, confirmRequests, removeRequest } from "@/lib/points";
import { REQUEST_COPY } from "@/lib/rewardCopy";
import RewardIcon from "@/components/rewards/RewardIcon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift } from "lucide-react";
import { Points } from "@/components/brand/PointsStar";
import Logo from "@/components/brand/Logo";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PERCY } from "@/constants/terminology";

export default function SpendRewardsModal({ isOpen, onClose, child, rewards = [] }) {
  const [redeeming, setRedeeming] = useState(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  if (!child) return null;

  // V1-D: points not already set aside for the child's requests (server value).
  const available = child.available_points ?? child.total_points;
  // The child's requests, priced by the server; only a parent's "Agree" spends them (D5).
  const requests = child.reward_stack_priced || [];

  const agree = async () => {
    if (busy || requests.length === 0) return;
    setBusy(true);
    try {
      const r = await confirmRequests(child.id, requests);
      refreshPoints(queryClient);
      onClose();
      toast.success(REQUEST_COPY.agreed(child.name, r.confirmed_count));
    } catch (e) {
      // 409: the requests changed while this was open; show them as they are now.
      if (e.status === 409) { refreshPoints(queryClient); toast.info(REQUEST_COPY.changed); }
      else toast.error(e.message || 'Failed to redeem reward');
    } finally {
      setBusy(false);
    }
  };

  const notNow = async (item) => {
    if (busy) return;
    setBusy(true);
    try {
      await removeRequest(child.id, item);
    } catch (e) {
      if (e.status === 409) toast.info(REQUEST_COPY.changed);
      else toast.error("Couldn't update points. Please try again.");
    } finally {
      refreshPoints(queryClient);
      setBusy(false);
    }
  };

  const availableRewards = rewards
    .filter(r => r.visible_to_child !== false)
    .sort((a, b) => a.cost_points - b.cost_points);

  const handleRedeem = async (reward) => {
    if (available < reward.cost_points) {
      toast.error('Not enough points');
      return;
    }

    setRedeeming(reward.id);
    try {
      const { redemption } = await spendReward(child.id, reward.id);

      refreshPoints(queryClient);
      // Close first: an open dialog blocks taps outside it, including the
      // toast's Undo button.
      onClose();

      toast.success(`${child.name} redeemed ${reward.title}.`, {
        duration: UNDO_TOAST_MS,
        action: { label: 'Undo', onClick: undoAction('spend', redemption.id, queryClient) },
      });
    } catch (e) {
      toast.error(e.message || 'Failed to redeem reward');
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            Spend {child.name}'s Points
          </DialogTitle>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Points value={available} className="font-semibold text-foreground" /> {PERCY.POINTS} available
          </p>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {requests.length > 0 && (
            <section className="space-y-2 rounded-lg border border-border bg-warning p-3" aria-labelledby="requests-heading">
              <h3 id="requests-heading" className="font-display font-bold text-primary">{REQUEST_COPY.heading(child.name)}</h3>
              <ul className="space-y-2">
                {requests.map((item) => (
                  <li key={item.stackIndex + ':' + item.rewardId} className="flex items-center gap-3 rounded-md bg-card p-2">
                    <RewardIcon reward={item} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium text-foreground">{item.name}</p>
                      <Points value={item.cost} className="text-sm text-muted-foreground" />
                    </div>
                    <Button size="sm" variant="outline" disabled={busy} aria-label={`${REQUEST_COPY.notNow}: ${item.name}`}
                      onClick={() => notNow(item)}>{REQUEST_COPY.notNow}</Button>
                  </li>
                ))}
              </ul>
              <Button className="w-full" disabled={busy} onClick={agree}>{REQUEST_COPY.agree(requests.length)}</Button>
            </section>
          )}
          {availableRewards.length === 0 ? (
            <div className="text-center py-8">
              <Logo size={48} decorative className="mb-3" />
              <p className="text-muted-foreground text-sm">No rewards created yet.</p>
              <p className="text-muted-foreground text-xs mt-1">Add rewards in the Rewards tab.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableRewards.map((reward) => {
                const canAfford = available >= reward.cost_points;
                const isRedeeming = redeeming === reward.id;

                return (
                  <div
                    key={reward.id}
                    className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${
                      canAfford
                        ? 'bg-card border-border'
                        : 'bg-muted border-border'
                    }`}
                  >
                    <RewardIcon reward={reward} size="sm" className={canAfford ? "" : "bg-card"} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{reward.title}</p>
                      <Points value={reward.cost_points} className="text-sm text-muted-foreground mt-0.5" />
                    </div>
                    <Button
                      size="sm"
                      variant={canAfford ? "default" : "outline"}
                      disabled={!canAfford || isRedeeming}
                      onClick={() => handleRedeem(reward)}
                      className="shrink-0 px-4"
                    >
                      {isRedeeming ? 'Spending...' : canAfford ? 'Spend' : `Need ${reward.cost_points - available} more`}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="w-full">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
