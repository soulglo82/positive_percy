import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { PERCY, formatPoints, formatPointsBadge } from "@/constants/terminology";

export default function ChildCard({ child, onAddPoints, onEdit, onQuickAction, quickActions = [], rewards = [] }) {
  // Find next reward the child is working toward
  const nextReward = rewards
    .filter(r => r.cost_points > child.total_points)
    .sort((a, b) => a.cost_points - b.cost_points)[0];

  // If child has enough points for all rewards, show the most expensive reward at 100%
  const displayReward = nextReward || (rewards.length > 0
    ? [...rewards].sort((a, b) => b.cost_points - a.cost_points)[0]
    : null);

  const progress = displayReward
    ? Math.min((child.total_points / displayReward.cost_points) * 100, 100)
    : 0;

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
                    className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil className="w-5 h-5 text-white" />
                  </button>
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">{child.name}</h3>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-600">{child.total_points}</div>
              <div className="text-xs text-slate-500">{PERCY.POINTS_COMPACT}</div>
            </div>
          </div>

          {/* Reward Progress Bar */}
          <div className="mb-3">
            {displayReward ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-600">
                    {progress >= 100 ? '🎉 Ready to redeem' : 'Progress to'} {displayReward.emoji || '🎁'} {displayReward.title}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : (
              rewards.length === 0 && (
                <p className="text-xs text-slate-400 italic">Add a reward to start earning!</p>
              )
            )}
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
        </CardContent>
      </Card>
    </motion.div>
  );
}
