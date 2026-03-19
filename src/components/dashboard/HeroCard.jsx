import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Flame, Star, ShoppingCart } from "lucide-react";
import { PERCY } from "@/constants/terminology";
import { motion } from "framer-motion";

export default function HeroCard({ children = [], streak = 0, onAddFirstChild }) {
  const hasChildren = children.length > 0;

  // Family-level stats
  const weeklyTotal = children.reduce((sum, c) => sum + (c.weekly_points || 0), 0);
  const totalStacked = children.reduce((sum, c) => {
    const stack = c.reward_stack || [];
    return sum + stack.reduce((s, item) => s + item.cost, 0);
  }, 0);
  const stackedCount = children.reduce((sum, c) => sum + (c.reward_stack || []).length, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="overflow-hidden border-2 border-purple-200 bg-gradient-to-r from-purple-50 via-white to-pink-50 shadow-lg">
        <CardContent className="p-6">
          {hasChildren ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Streak */}
              <div className="flex items-center gap-3">
                {streak > 0 ? (
                  <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                    <Flame className="w-5 h-5 text-orange-500" />
                    <span className="text-lg font-bold text-orange-600">{streak}</span>
                    <span className="text-xs text-orange-500 font-medium">day {PERCY.STREAK}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <Star className="w-5 h-5 text-slate-400" />
                    <span className="text-sm text-slate-500">Award points to start your streak</span>
                  </div>
                )}
              </div>

              {/* Weekly total */}
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <Star className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-700">
                  This week: <span className="font-bold">{weeklyTotal}</span> {PERCY.POINTS_COMPACT}
                </span>
              </div>

              {/* Ready to redeem */}
              {stackedCount > 0 && (
                <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                  <ShoppingCart className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium text-purple-700">
                    Ready to redeem: <span className="font-bold">{stackedCount}</span> reward{stackedCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-5 h-5 text-purple-500" />
                  <h2 className="text-lg font-bold text-slate-800">
                    {PERCY.PRODUCT_STATEMENT}
                  </h2>
                </div>
              </div>
              <Button
                onClick={onAddFirstChild}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Your First Child
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
