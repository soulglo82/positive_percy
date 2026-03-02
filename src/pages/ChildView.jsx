import React, { useState, useEffect } from 'react';
import { Child, Reward, Redemption } from "@/api/entities";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trophy, Gift } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";

import RewardCard from "../components/rewards/RewardCard";

export default function ChildView() {
  const { user } = useAuth();
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [redeemConfirm, setRedeemConfirm] = useState(null);

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

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  const selectedChild = children.find(c => c.id === selectedChildId);

  // ENH-011: Direct redemption with confirmation
  const handleRedeemReward = async (reward) => {
    if (!selectedChild) return;

    if (selectedChild.total_points < reward.cost_points) {
      toast.error("Not enough points yet!");
      return;
    }

    setRedeemConfirm({ reward, child: selectedChild });
  };

  const confirmRedemption = async () => {
    const { reward, child } = redeemConfirm;

    try {
      // Deduct points atomically via server
      const token = getToken();
      await fetch(`/api/children/${child.id}/adjust-points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ points: -reward.cost_points }),
      });

      // Log the redemption as completed (for history)
      await Redemption.create({
        child_id: child.id,
        child_name: child.name,
        reward_id: reward.id,
        reward_title: reward.title,
        reward_cost: reward.cost_points,
        status: 'Completed',
      });

      queryClient.invalidateQueries(['children']);
      toast.success(`${child.name} redeemed ${reward.title}!`);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#a855f7', '#ec4899', '#22c55e', '#3b82f6', '#f59e0b'],
      });
    } catch {
      toast.error("Something went wrong. Please try again.");
    }

    setRedeemConfirm(null);
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

                  {/* ENH-010: Single hero points display */}
                  <div className="max-w-xs mx-auto">
                    <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl p-8 text-white">
                      <Trophy className="w-10 h-10 mb-3 mx-auto" />
                      <div className="text-5xl font-bold mb-2">{selectedChild.total_points}</div>
                      <div className="text-sm opacity-90">Total Points</div>
                    </div>
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
                      onRequest={handleRedeemReward}
                      canAfford={selectedChild.total_points >= reward.cost_points}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Redemption Confirmation Dialog */}
      <AlertDialog open={!!redeemConfirm} onOpenChange={(open) => !open && setRedeemConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redeem Reward</AlertDialogTitle>
            <AlertDialogDescription>
              {redeemConfirm && (
                <>
                  <span className="font-semibold">{redeemConfirm.child.name}</span> will spend{' '}
                  <span className="font-semibold">{redeemConfirm.reward.cost_points} points</span> on{' '}
                  <span className="font-semibold">{redeemConfirm.reward.title}</span>. Continue?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRedemption}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
            >
              Redeem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
