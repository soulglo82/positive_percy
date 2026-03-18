import React, { useState, useEffect } from 'react';
import { Child, Reward, Point_Event } from "@/api/entities";
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
import { Trophy, Gift, Award, ShoppingBag, Plus, Minus, History } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import confetti from "canvas-confetti";

import { PERCY } from "@/constants/terminology";
import RewardCard from "../components/rewards/RewardCard";
import ShareableCard from "../components/ShareableCard";
import BadgeDisplay from "../components/BadgeDisplay";
import LoadingSpinner from "../components/LoadingSpinner";

export default function ChildView() {
  const { user } = useAuth();
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [redeemConfirm, setRedeemConfirm] = useState(null);

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

  const { data: allEvents = [] } = useQuery({
    queryKey: ['pointEvents'],
    queryFn: () => Point_Event.list('-created_date', 50),
    enabled: !!user,
  });

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  // FEAT-010: Check badges on child selection
  const checkBadges = async (childId) => {
    try {
      const token = getToken();
      const res = await fetch(`/api/children/${childId}/check-badges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.new_badges && data.new_badges.length > 0) {
        queryClient.invalidateQueries(['children']);
        toast.success(`New badge${data.new_badges.length > 1 ? 's' : ''} earned!`);
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#a855f7', '#22c55e'],
        });
      }
    } catch {}
  };

  useEffect(() => {
    if (selectedChildId) checkBadges(selectedChildId);
  }, [selectedChildId]);

  if (isLoading) return <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 p-6"><LoadingSpinner message="Loading..." /></div>;

  const rewards = allRewards.filter(reward => {
    if (!reward.assigned_child_ids || reward.assigned_child_ids.length === 0) {
      return true;
    }
    return selectedChildId && reward.assigned_child_ids.includes(selectedChildId);
  });

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
        toast.error(err.error || "Something went wrong. Please try again.");
        setRedeemConfirm(null);
        return;
      }

      queryClient.invalidateQueries(['children']);
      queryClient.invalidateQueries(['redemptions']);
      toast.success(`${child.name} redeemed ${reward.title}!`);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#a855f7', '#ec4899', '#22c55e', '#3b82f6', '#f59e0b'],
      });

      // Check for new badges after redemption
      checkBadges(child.id);
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
                  <div className="max-w-sm mx-auto">
                    <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl p-8 text-white">
                      <Trophy className="w-10 h-10 mb-3 mx-auto" />
                      <div className="text-5xl font-bold mb-2">{selectedChild.total_points}</div>
                      <div className="text-sm opacity-90">{PERCY.POINTS}</div>
                    </div>
                    {(selectedChild.points_spent || 0) > 0 && (
                      <div className="mt-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-4 text-white flex items-center justify-center gap-3">
                        <ShoppingBag className="w-6 h-6" />
                        <div>
                          <div className="text-2xl font-bold">{selectedChild.points_spent}</div>
                          <div className="text-xs opacity-90">Points Spent on Rewards</div>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex justify-center">
                      <ShareableCard child={selectedChild} message="Look at my points!" />
                    </div>
                  </div>

                  {/* FEAT-010: Badges */}
                  {selectedChild.badges_earned && selectedChild.badges_earned.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-700 flex items-center justify-center gap-2 mb-3">
                        <Award className="w-5 h-5 text-amber-500" />
                        My {PERCY.BADGES}
                      </h3>
                      <BadgeDisplay earnedBadgeIds={selectedChild.badges_earned} />
                    </div>
                  )}
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
                  {[...rewards]
                    .sort((a, b) => {
                      const aAfford = selectedChild.total_points >= a.cost_points ? 0 : 1;
                      const bAfford = selectedChild.total_points >= b.cost_points ? 0 : 1;
                      if (aAfford !== bAfford) return aAfford - bAfford;
                      return a.cost_points - b.cost_points;
                    })
                    .map((reward) => (
                    <RewardCard
                      key={reward.id}
                      reward={reward}
                      isParentView={false}
                      onRequest={handleRedeemReward}
                      canAfford={selectedChild.total_points >= reward.cost_points}
                      childPoints={selectedChild.total_points}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activity Feed */}
            {(() => {
              const childEvents = allEvents
                .filter(e => e.child_id === selectedChildId)
                .slice(0, 10);
              if (childEvents.length === 0) return null;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <History className="w-6 h-6 text-purple-500" />
                    Recent Activity
                  </h2>
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      {childEvents.map((event) => {
                        const isPositive = event.points > 0;
                        return (
                          <div key={event.id} className={`flex items-center gap-3 p-3 rounded-lg ${isPositive ? 'bg-green-50' : 'bg-rose-50'}`}>
                            <div className={`p-1.5 rounded-full ${isPositive ? 'bg-green-200' : 'bg-rose-200'}`}>
                              {isPositive ? <Plus className="w-3 h-3 text-green-700" /> : <Minus className="w-3 h-3 text-rose-700" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <Badge variant="outline" className="text-xs">{event.category}</Badge>
                                <span className={`font-bold text-sm ${isPositive ? 'text-green-600' : 'text-rose-600'}`}>
                                  {isPositive ? '+' : ''}{event.points}
                                </span>
                              </div>
                              {event.note && (
                                <p className="text-xs text-slate-500 mt-0.5 truncate">{event.note}</p>
                              )}
                            </div>
                            <span className="text-xs text-slate-400 shrink-0">
                              {format(new Date(event.created_date), "MMM d")}
                            </span>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })()}
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
                  <span className="font-semibold">{redeemConfirm.reward.cost_points} {PERCY.POINTS_COMPACT}</span> on{' '}
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
