import React, { useState, useEffect } from 'react';
import { Child, Reward, Redemption } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Trophy, Target, Gift } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import RewardCard from "../components/rewards/RewardCard";

export default function ChildView() {
  const { user } = useAuth();
  const [selectedChildId, setSelectedChildId] = useState(null);

  const queryClient = useQueryClient();

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: () => Child.list(),
    enabled: !!user,
  });

  const { data: allRewards = [] } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => Reward.filter({ visible_to_child: true }),
  });

  const rewards = allRewards.filter(reward => {
    if (!reward.assigned_child_ids || reward.assigned_child_ids.length === 0) {
      return true;
    }
    return selectedChildId && reward.assigned_child_ids.includes(selectedChildId);
  });

  const isWeekend = () => {
    const day = new Date().getDay();
    return day === 0 || day === 6;
  };

  const createRedemptionMutation = useMutation({
    mutationFn: (data) => Redemption.create(data),
    onSuccess: () => {
      toast.success("Request sent to your parent!");
    },
  });

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  const selectedChild = children.find(c => c.id === selectedChildId);
  const progressPercent = selectedChild
    ? Math.min((selectedChild.weekly_points / selectedChild.weekly_target) * 100, 100)
    : 0;

  const handleRequestReward = async (reward) => {
    if (!selectedChild) return;

    if (selectedChild.total_points < reward.cost_points) {
      toast.error("Not enough points yet!");
      return;
    }

    await createRedemptionMutation.mutateAsync({
      child_id: selectedChild.id,
      child_name: selectedChild.name,
      reward_id: reward.id,
      reward_title: reward.title,
      reward_cost: reward.cost_points,
      status: 'Pending',
    });
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
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="overflow-hidden border-4 border-white shadow-2xl">
                <div className="h-3 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400" />
                <CardContent className="p-8 text-center">
                  <div className="mb-6 flex justify-center">
                    {selectedChild.avatar_url ? (
                      <img
                        src={selectedChild.avatar_url}
                        alt={selectedChild.name}
                        className="w-32 h-32 rounded-full object-cover border-8 border-purple-200"
                      />
                    ) : (
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-5xl font-bold border-8 border-purple-200">
                        {selectedChild.name.charAt(0)}
                      </div>
                    )}
                  </div>

                  <h1 className="text-4xl font-bold text-slate-800 mb-2">
                    Hi {selectedChild.name}! 👋
                  </h1>
                  <p className="text-slate-600 mb-6">Keep up the amazing work!</p>

                  <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-6">
                    <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl p-6 text-white">
                      <Trophy className="w-8 h-8 mb-2 mx-auto" />
                      <div className="text-4xl font-bold mb-1">{selectedChild.total_points}</div>
                      <div className="text-sm opacity-90">Total Points</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl p-6 text-white">
                      <Sparkles className="w-8 h-8 mb-2 mx-auto" />
                      <div className="text-4xl font-bold mb-1">{selectedChild.weekly_points}</div>
                      <div className="text-sm opacity-90">This Week</div>
                    </div>
                  </div>

                  <div className="max-w-md mx-auto">
                    <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                      <span className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        Weekly Goal
                      </span>
                      <span className="font-bold">{selectedChild.weekly_points} / {selectedChild.weekly_target}</span>
                    </div>
                    <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                    {progressPercent >= 100 && (
                      <motion.p
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-green-600 font-bold mt-2"
                      >
                        🎉 Goal achieved! Amazing!
                      </motion.p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                  <Gift className="w-8 h-8 text-pink-500" />
                  Available Treats
                </h2>
                {!isWeekend() && (
                  <Badge className="bg-amber-100 text-amber-700 border-0">
                    🗓️ Available on weekends
                  </Badge>
                )}
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
                  {rewards.map((reward) => (
                    <RewardCard
                      key={reward.id}
                      reward={reward}
                      isParentView={false}
                      onRequest={isWeekend() ? handleRequestReward : null}
                      canAfford={selectedChild.total_points >= reward.cost_points}
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
