import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Flame, Target } from "lucide-react";
import { PERCY } from "@/constants/terminology";

export default function MotivationCard({ metrics }) {
  if (!metrics) return null;

  const { rewards_earned_count, best_streak, next_unlock } = metrics;
  const hasAnyData = rewards_earned_count > 0 || best_streak > 0 || next_unlock;

  if (!hasAnyData) {
    return (
      <div className="mt-3 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-4 text-center">
        <p className="text-sm text-slate-600 font-medium">
          Keep earning {PERCY.POINTS} to unlock achievements!
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
      {/* Rewards Earned */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3 text-center border border-amber-100">
        <Trophy className="w-5 h-5 text-amber-500 mx-auto mb-1" />
        <div className="text-2xl font-bold text-amber-700">{rewards_earned_count}</div>
        <div className="text-xs text-amber-600">Rewards Earned</div>
      </div>

      {/* Best Streak */}
      <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-3 text-center border border-orange-100">
        <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
        <div className="text-2xl font-bold text-orange-700">{best_streak}</div>
        <div className="text-xs text-orange-600">Best Streak (days)</div>
      </div>

      {/* Next Unlock */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-3 text-center border border-blue-100">
        <Target className="w-5 h-5 text-blue-500 mx-auto mb-1" />
        {next_unlock ? (
          <>
            <div className="text-2xl font-bold text-blue-700">
              {next_unlock.eta_days != null ? `${next_unlock.eta_days}d` : '—'}
            </div>
            <div className="text-xs text-blue-600 truncate" title={next_unlock.reward_name}>
              {next_unlock.eta_days != null
                ? `to ${next_unlock.reward_name}`
                : 'Keep earning to unlock!'}
            </div>
          </>
        ) : (
          <>
            <div className="text-2xl font-bold text-green-700">✓</div>
            <div className="text-xs text-green-600">All rewards unlocked!</div>
          </>
        )}
      </div>
    </div>
  );
}
