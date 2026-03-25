import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Gift } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/AuthContext";
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
      const token = getToken();
      const res = await fetch(`/api/children/${child.id}/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          reward_id: reward.id,
          reward_title: reward.title,
          reward_cost: reward.cost_points,
          child_name: child.name,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to redeem reward');
        return;
      }

      queryClient.invalidateQueries(['children']);
      queryClient.invalidateQueries(['recentActivity']);
      queryClient.invalidateQueries(['activityFeed']);

      toast.success(`${child.name} redeemed ${reward.title}!`);
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#a855f7', '#ec4899', '#22c55e', '#3b82f6', '#f59e0b'],
      });
    } catch {
      toast.error('Failed to redeem reward');
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-pink-500" />
            Spend {child.name}'s Points
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            <span className="font-bold text-purple-600">{child.total_points}</span> {PERCY.POINTS} available
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 py-2">
          {availableRewards.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">🎁</div>
              <p className="text-slate-500 text-sm">No rewards created yet.</p>
              <p className="text-slate-400 text-xs mt-1">Add rewards in the Rewards tab.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableRewards.map((reward) => {
                const canAfford = child.total_points >= reward.cost_points;
                const isRedeeming = redeeming === reward.id;

                return (
                  <div
                    key={reward.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      canAfford
                        ? 'bg-white border-slate-200 hover:border-green-300 hover:bg-green-50/50'
                        : 'bg-slate-50 border-slate-100 opacity-60'
                    }`}
                  >
                    <span className="text-2xl shrink-0">
                      {reward.emoji || '🎁'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 text-sm truncate">{reward.title}</p>
                      <Badge variant="outline" className="text-xs mt-0.5 bg-amber-50 text-amber-700 border-amber-200">
                        <Coins className="w-3 h-3 mr-1" />
                        {reward.cost_points} pts
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      disabled={!canAfford || isRedeeming}
                      onClick={() => handleRedeem(reward)}
                      className={`shrink-0 min-h-[40px] px-4 ${
                        canAfford
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                          : ''
                      }`}
                    >
                      {isRedeeming ? 'Spending...' : canAfford ? 'Spend' : `Need ${reward.cost_points - child.total_points} more`}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
