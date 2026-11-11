import { useState } from 'react';
import { refreshPoints, spendReward, undoAction, UNDO_TOAST_MS } from "@/lib/points";
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
import EmojiTile from "@/components/rewards/EmojiTile";
import Logo from "@/components/brand/Logo";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PERCY } from "@/constants/terminology";

export default function SpendRewardsModal({ isOpen, onClose, child, rewards = [] }) {
  const [redeeming, setRedeeming] = useState(null);
  const queryClient = useQueryClient();

  if (!child) return null;

  const availableRewards = rewards
    .filter(r => r.visible_to_child !== false)
    .sort((a, b) => a.cost_points - b.cost_points);

  const handleRedeem = async (reward) => {
    if (child.total_points < reward.cost_points) {
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
            <Points value={child.total_points} className="font-semibold text-foreground" /> {PERCY.POINTS} available
          </p>
        </DialogHeader>

        <DialogBody>
          {availableRewards.length === 0 ? (
            <div className="text-center py-8">
              <Logo size={48} decorative className="mb-3" />
              <p className="text-muted-foreground text-sm">No rewards created yet.</p>
              <p className="text-muted-foreground text-xs mt-1">Add rewards in the Rewards tab.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableRewards.map((reward) => {
                const canAfford = child.total_points >= reward.cost_points;
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
                    <EmojiTile emoji={reward.emoji} className={canAfford ? "" : "bg-card"} />
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
                      {isRedeeming ? 'Spending...' : canAfford ? 'Spend' : `Need ${reward.cost_points - child.total_points} more`}
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
