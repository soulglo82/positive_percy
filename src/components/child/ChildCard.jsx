import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { useQueryClient } from "@tanstack/react-query";
import { PERCY, formatPoints, formatPointsBadge } from "@/constants/terminology";
import { getToken } from "@/lib/AuthContext";
import RewardStackSummary from "../rewards/RewardStackSummary";

export default function ChildCard({ child, onAddPoints, onEdit, onQuickAction, quickActions = [], rewards = [] }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const queryClient = useQueryClient();

  const stack = child.reward_stack || [];
  const stackTotal = stack.reduce((sum, item) => sum + item.cost, 0);

  // How many rewards can this child take?
  const affordableCount = rewards.filter(r => child.total_points >= r.cost_points).length;

  const handleConfirmRewards = async () => {
    setIsConfirming(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/children/${child.id}/stack/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to confirm rewards');
        setIsConfirming(false);
        return;
      }

      const result = await res.json();
      queryClient.invalidateQueries(['children']);
      queryClient.invalidateQueries(['recentActivity']);
      queryClient.invalidateQueries(['activityFeed']);
      toast.success(`Confirmed ${result.confirmed_count} reward${result.confirmed_count > 1 ? 's' : ''} for ${child.name}!`);
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#a855f7', '#ec4899', '#22c55e', '#3b82f6', '#f59e0b'],
      });
    } catch {
      toast.error('Failed to confirm rewards');
    }
    setIsConfirming(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="overflow-hidden border-2 hover:shadow-xl transition-all duration-300">
        <div className="h-2 bg-gradient-to-r from-purple-200 via-pink-200 to-blue-200" />
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="relative group">
                {child.avatar_url ? (
                  <img
                    src={child.avatar_url}
                    alt={child.name}
                    className="w-16 h-16 rounded-full object-cover border-4 border-purple-100"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-2xl font-bold border-4 border-purple-100">
                    {child.name.charAt(0)}
                  </div>
                )}
                {onEdit && (
                  <button
                    onClick={() => onEdit(child)}
                    aria-label={`Edit ${child.name}`}
                    className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil className="w-5 h-5 text-white" />
                  </button>
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">{child.name}</h3>
                <p className="text-sm text-slate-500">
                  {affordableCount > 0
                    ? `Can take ${affordableCount} reward${affordableCount > 1 ? 's' : ''}`
                    : 'Earning toward rewards'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-600">{child.total_points}</div>
              <div className="text-xs text-slate-500">{PERCY.POINTS_COMPACT}</div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          {onQuickAction && quickActions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
              {quickActions.map((action) => (
                <button
                  key={action.id || action.label}
                  onClick={() => onQuickAction(child, action)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:border-green-300 transition-colors min-h-[36px]"
                >
                  <span>{action.icon || '⭐'}</span>
                  <span className="truncate">{action.label}</span>
                  <span className="font-bold shrink-0">{formatPointsBadge(action.points)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Action Button */}
          <Button
            onClick={() => onAddPoints(child)}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0 min-h-[44px]"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>

          {/* Reward Stack Summary — only shown when stack is non-empty */}
          <RewardStackSummary
            stack={stack}
            childName={child.name}
            onConfirm={handleConfirmRewards}
            isConfirming={isConfirming}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}
