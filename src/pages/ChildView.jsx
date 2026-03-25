import { useState, useEffect } from 'react';
import { Child, Reward } from "@/api/entities";
import { useAuth, getToken } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gift, Coins } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";

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

  if (isLoading) return <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 p-6"><LoadingSpinner message="Loading..." /></div>;

  const selectedChild = children.find(c => c.id === selectedChildId);

  const rewards = allRewards
    .filter(reward => {
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
      const token = getToken();
      const res = await fetch(`/api/children/${selectedChild.id}/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          reward_id: reward.id,
          reward_title: reward.title,
          reward_cost: reward.cost_points,
          child_name: selectedChild.name,
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

      toast.success(`${selectedChild.name} redeemed ${reward.title}!`);
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

  if (children.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <div className="text-6xl mb-4">👋</div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome!</h2>
            <p className="text-slate-600">Add a child on the Home screen to get started.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Child selector */}
        {children.length > 1 && (
          <div className="flex justify-center gap-3">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedChildId(child.id)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                  selectedChildId === child.id
                    ? 'bg-white shadow-lg scale-105 ring-2 ring-purple-400'
                    : 'bg-white/50 hover:bg-white/80'
                }`}
              >
                {child.avatar_url ? (
                  <img src={child.avatar_url} alt={child.name} className="w-12 h-12 rounded-full object-cover border-2 border-purple-200" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-lg font-bold border-2 border-purple-200">
                    {child.name.charAt(0)}
                  </div>
                )}
                <span className={`text-xs font-medium ${selectedChildId === child.id ? 'text-purple-700' : 'text-slate-500'}`}>
                  {child.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {selectedChild && (
          <>
            {/* Points summary */}
            <motion.div
              key={selectedChildId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <h1 className="text-2xl font-bold text-slate-800">{selectedChild.name}'s Rewards</h1>
              <p className="text-lg text-slate-600 mt-1">
                <span className="font-bold text-purple-600 text-2xl">{selectedChild.total_points}</span> {PERCY.POINTS} available
              </p>
            </motion.div>

            {/* Rewards list */}
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Gift className="w-5 h-5 text-pink-500" />
                Available Rewards
              </h2>

              {rewards.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <div className="text-5xl mb-3">🎁</div>
                    <p className="text-slate-600">No rewards created yet.</p>
                    <p className="text-slate-400 text-sm mt-1">Add rewards in the Rewards tab.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {rewards.map((reward) => {
                    const canAfford = selectedChild.total_points >= reward.cost_points;
                    const isRedeeming = redeeming === reward.id;

                    return (
                      <motion.div
                        key={reward.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card className={`overflow-hidden transition-all ${canAfford ? 'hover:shadow-md' : 'opacity-60'}`}>
                          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
                            <span className="text-3xl shrink-0">{reward.emoji || '🎁'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-800 text-sm sm:text-base truncate">{reward.title}</p>
                              {reward.description && (
                                <p className="text-xs text-slate-500 truncate">{reward.description}</p>
                              )}
                              <Badge variant="outline" className="text-xs mt-1 bg-amber-50 text-amber-700 border-amber-200">
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
                              {isRedeeming ? '...' : canAfford ? 'Spend' : `Need ${reward.cost_points - selectedChild.total_points} more`}
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
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
