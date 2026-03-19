import React, { useState, useEffect } from 'react';
import { Child, Reward } from "@/api/entities";
import { useAuth, getToken } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trophy, Gift } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";

import { PERCY } from "@/constants/terminology";
import RewardCard from "../components/rewards/RewardCard";
import RewardStack from "../components/rewards/RewardStack";
import LoadingSpinner from "../components/LoadingSpinner";

export default function ChildView() {
  const { user } = useAuth();
  const [selectedChildId, setSelectedChildId] = useState(null);

  const queryClient = useQueryClient();

  const { data: children = [], isLoading } = useQuery({
    queryKey: ['children'],
    queryFn: () => Child.list(),
    enabled: !!user,
  });

  const { data: allRewards = [] } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => Reward.filter({ visible_to_child: true }),
  });

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  if (isLoading) return <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 p-6"><LoadingSpinner message="Loading..." /></div>;

  const rewards = allRewards.filter(reward => {
    if (!reward.assigned_child_ids || reward.assigned_child_ids.length === 0) {
      return true;
    }
    return selectedChildId && reward.assigned_child_ids.includes(selectedChildId);
  });

  const selectedChild = children.find(c => c.id === selectedChildId);
  const stack = selectedChild?.reward_stack || [];
  const stackTotal = stack.reduce((sum, item) => sum + item.cost, 0);
  const remainingAfterStack = (selectedChild?.total_points || 0) - stackTotal;

  // Check if a reward is already in the stack
  const isInStack = (rewardId) => stack.some(item => item.rewardId === rewardId);

  // Can the child afford this reward given their remaining balance (after stack)?
  const canAffordWithStack = (reward) => {
    if (isInStack(reward.id)) return true; // already in stack
    return remainingAfterStack >= reward.cost_points;
  };

  const handleToggleStack = async (reward) => {
    if (!selectedChild) return;
    const token = getToken();

    if (isInStack(reward.id)) {
      // Remove from stack
      const index = stack.findIndex(item => item.rewardId === reward.id);
      if (index === -1) return;

      try {
        const res = await fetch(`/api/children/${selectedChild.id}/stack/${index}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || 'Failed to remove from stack');
          return;
        }
        queryClient.invalidateQueries(['children']);
        toast.info(`Removed ${reward.title} from stack`);
      } catch {
        toast.error('Failed to remove from stack');
      }
    } else {
      // Add to stack
      if (remainingAfterStack < reward.cost_points) {
        toast.error('Not enough points remaining');
        return;
      }

      try {
        const res = await fetch(`/api/children/${selectedChild.id}/stack/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            reward_id: reward.id,
            reward_title: reward.title,
            reward_cost: reward.cost_points,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || 'Failed to add to stack');
          return;
        }

        queryClient.invalidateQueries(['children']);
        toast.success(`Added ${reward.title} to stack!`);
      } catch {
        toast.error('Failed to add to stack');
      }
    }
  };

  const handleRemoveFromStack = async (index) => {
    if (!selectedChild) return;
    const token = getToken();

    try {
      const res = await fetch(`/api/children/${selectedChild.id}/stack/${index}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to remove from stack');
        return;
      }
      queryClient.invalidateQueries(['children']);
    } catch {
      toast.error('Failed to remove from stack');
    }
  };

  if (children.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <div className="text-6xl mb-4">👋</div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Welcome!
            </h2>
            <p className="text-slate-600">
              Ask your parent to add your profile first
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {children.length > 1 && (
          <div className="flex justify-center">
            <Select value={selectedChildId} onValueChange={setSelectedChildId}>
              <SelectTrigger className="w-64 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedChild && (
          <>
            {/* Greeting + Points */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="overflow-hidden border-4 border-white shadow-2xl">
                <div className="h-3 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400" />
                <CardContent className="p-8 text-center">
                  <div className="mb-4 flex justify-center">
                    {selectedChild.avatar_url ? (
                      <img
                        src={selectedChild.avatar_url}
                        alt={selectedChild.name}
                        className="w-24 h-24 rounded-full object-cover border-6 border-purple-200"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-4xl font-bold border-6 border-purple-200">
                        {selectedChild.name.charAt(0)}
                      </div>
                    )}
                  </div>

                  <h1 className="text-3xl font-bold text-slate-800 mb-1">
                    Hi {selectedChild.name}! 👋
                  </h1>

                  <div className="max-w-xs mx-auto mt-4">
                    <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl p-6 text-white">
                      <Trophy className="w-8 h-8 mb-2 mx-auto" />
                      <div className="text-4xl font-bold mb-1">{selectedChild.total_points}</div>
                      <div className="text-sm opacity-90">{PERCY.POINTS}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Reward Stack */}
            <div>
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-4">
                🛒 Your Reward Stack
              </h2>
              <RewardStack
                stack={stack}
                totalPoints={selectedChild.total_points}
                onRemove={handleRemoveFromStack}
              />
            </div>

            {/* Reward Grid */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                  <Gift className="w-8 h-8 text-pink-500" />
                  Available Treats
                </h2>
              </div>

              {rewards.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <div className="text-6xl mb-4">🎁</div>
                    <p className="text-slate-600">
                      No rewards available yet. Check back soon!
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...rewards]
                    .sort((a, b) => {
                      const aAfford = canAffordWithStack(a) ? 0 : 1;
                      const bAfford = canAffordWithStack(b) ? 0 : 1;
                      if (aAfford !== bAfford) return aAfford - bAfford;
                      return a.cost_points - b.cost_points;
                    })
                    .map((reward) => (
                    <RewardCard
                      key={reward.id}
                      reward={reward}
                      isParentView={false}
                      onToggleStack={handleToggleStack}
                      canAfford={canAffordWithStack(reward)}
                      childPoints={remainingAfterStack}
                      isInStack={isInStack(reward.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
