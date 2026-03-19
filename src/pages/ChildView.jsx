import React, { useState, useEffect } from 'react';
import { Child, Reward } from "@/api/entities";
import { useAuth, getToken } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

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

  const isInStack = (rewardId) => stack.some(item => item.rewardId === rewardId);

  const canAffordWithStack = (reward) => {
    if (isInStack(reward.id)) return true;
    return remainingAfterStack >= reward.cost_points;
  };

  const handleToggleStack = async (reward) => {
    if (!selectedChild) return;
    const token = getToken();

    if (isInStack(reward.id)) {
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
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Avatar Tab Selector — only shown when multiple children */}
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
                  <img
                    src={child.avatar_url}
                    alt={child.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-purple-200"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-lg font-bold border-2 border-purple-200">
                    {child.name.charAt(0)}
                  </div>
                )}
                <span className={`text-xs font-medium ${
                  selectedChildId === child.id ? 'text-purple-700' : 'text-slate-500'
                }`}>
                  {child.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {selectedChild && (
          <>
            {/* Greeting + Points — compact */}
            <motion.div
              key={selectedChildId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <h1 className="text-2xl font-bold text-slate-800">
                Hi {selectedChild.name}! 👋
              </h1>
              <p className="text-lg text-slate-600 mt-1">
                You have <span className="font-bold text-purple-600 text-2xl">{selectedChild.total_points}</span> {PERCY.POINTS}
              </p>
            </motion.div>

            {/* Reward Stack — primary interactive element */}
            <RewardStack
              stack={stack}
              totalPoints={selectedChild.total_points}
              onRemove={handleRemoveFromStack}
            />

            {/* Reward Grid — affordable first, ascending cost */}
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Gift className="w-6 h-6 text-pink-500" />
                Available Treats
              </h2>

              {rewards.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <div className="text-5xl mb-3">🎁</div>
                    <p className="text-slate-600">
                      No rewards available yet. Check back soon!
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
