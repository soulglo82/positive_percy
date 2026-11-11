import { useState, useEffect } from 'react';
import { refreshPoints, spendReward, undoAction, UNDO_TOAST_MS } from "@/lib/points";
import { Child, Reward } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { Points } from "@/components/brand/PointsStar";
import Logo from "@/components/brand/Logo";
import EmojiTile from "../components/rewards/EmojiTile";
import ChildAvatar from "../components/child/ChildAvatar";

import { PERCY } from "@/constants/terminology";
import LoadingSpinner from "../components/LoadingSpinner";

export default function ChildView() {
  const { user } = useAuth();
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [redeeming, setRedeeming] = useState(null);
  const queryClient = useQueryClient();

  const { data: children = [], isLoading } = useQuery({
    queryKey: ['children'],
    queryFn: () => Child.list(),
    enabled: !!user,
  });

  const { data: allRewards = [] } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => Reward.list(),
  });

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  if (isLoading) return <div className="min-h-screen p-6"><LoadingSpinner message="Loading..." /></div>;

  const selectedChild = children.find(c => c.id === selectedChildId);

  const rewards = allRewards
    .filter(reward => {
      if (reward.visible_to_child === false) return false;
      if (!reward.assigned_child_ids || reward.assigned_child_ids.length === 0) return true;
      return selectedChildId && reward.assigned_child_ids.includes(selectedChildId);
    })
    .sort((a, b) => a.cost_points - b.cost_points);

  const handleRedeem = async (reward) => {
    if (!selectedChild || selectedChild.total_points < reward.cost_points) {
      toast.error('Not enough points');
      return;
    }

    setRedeeming(reward.id);
    try {
      const { redemption } = await spendReward(selectedChild.id, reward.id);

      refreshPoints(queryClient);

      toast.success(`${selectedChild.name} redeemed ${reward.title}.`, {
        duration: UNDO_TOAST_MS,
        action: { label: 'Undo', onClick: undoAction('spend', redemption.id, queryClient) },
      });
    } catch (e) {
      toast.error(e.message || 'Failed to redeem reward');
    } finally {
      setRedeeming(null);
    }
  };

  if (children.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <Logo size={48} decorative className="mb-4" />
            <h2 className="text-title font-semibold text-foreground mb-2">Welcome!</h2>
            <p className="text-muted-foreground">Add a child on the Home screen to get started.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Child selector */}
        {children.length > 1 && (
          <div className="flex justify-center flex-wrap gap-3" role="group" aria-label="Choose a child">
            {children.map((child) => (
              <button
                key={child.id}
                aria-pressed={selectedChildId === child.id}
                onClick={() => setSelectedChildId(child.id)}
                className={`flex flex-col items-center gap-1 px-3 py-2 min-w-16 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  selectedChildId === child.id
                    ? 'bg-selected border-selected-border'
                    : 'bg-card border-border hover:bg-accent'
                }`}
              >
                <ChildAvatar name={child.name} url={child.avatar_url} />
                <span className={`text-xs ${selectedChildId === child.id ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>
                  {child.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {selectedChild && (
          <>
            {/* Points summary */}
            <div className="text-center">
              <h1 className="text-title font-semibold text-foreground">{selectedChild.name}'s Rewards</h1>
              <p className="text-lg text-muted-foreground mt-1 flex items-center justify-center gap-2">
                <Points value={selectedChild.total_points} className="font-semibold text-foreground text-title" starClassName="h-6 w-6" /> {PERCY.POINTS} available
              </p>
            </div>

            {/* Rewards list */}
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                <Gift className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                Available Rewards
              </h2>

              {rewards.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <EmojiTile emoji="🎁" className="mx-auto mb-3" />
                    <p className="text-muted-foreground">No rewards created yet.</p>
                    <p className="text-muted-foreground text-sm mt-1">Add rewards in the Rewards tab.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {rewards.map((reward) => {
                    const canAfford = selectedChild.total_points >= reward.cost_points;
                    const isRedeeming = redeeming === reward.id;

                    return (
                      <Card key={reward.id} className={`overflow-hidden ${canAfford ? '' : 'bg-muted shadow-none'}`}>
                        <CardContent className="flex items-center gap-3 p-3 sm:p-4">
                          <EmojiTile emoji={reward.emoji} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm sm:text-base truncate">{reward.title}</p>
                            {reward.description && (
                              <p className="text-xs text-muted-foreground truncate">{reward.description}</p>
                            )}
                            <Points value={reward.cost_points} className="text-sm text-muted-foreground mt-1" />
                          </div>
                          <Button
                            size="sm"
                            variant={canAfford ? "default" : "outline"}
                            disabled={!canAfford || isRedeeming}
                            onClick={() => handleRedeem(reward)}
                            className="shrink-0 px-4"
                          >
                            {isRedeeming ? '...' : canAfford ? 'Spend' : `Need ${reward.cost_points - selectedChild.total_points} more`}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
