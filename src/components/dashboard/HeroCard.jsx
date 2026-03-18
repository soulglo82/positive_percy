import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Flame, Star } from "lucide-react";
import { PERCY, formatPoints } from "@/constants/terminology";
import { motion } from "framer-motion";

export default function HeroCard({ children = [], streak = 0, rewards = [], onAddFirstChild }) {
  const hasChildren = children.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="overflow-hidden border-2 border-purple-200 bg-gradient-to-r from-purple-50 via-white to-pink-50 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-5 h-5 text-purple-500" />
                <h2 className="text-lg font-bold text-slate-800">
                  {PERCY.PRODUCT_STATEMENT}
                </h2>
              </div>
              {streak > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-orange-600 font-medium mt-1">
                  <Flame className="w-4 h-4" />
                  <span>{streak}-day {PERCY.STREAK}</span>
                </div>
              )}
            </div>

            {hasChildren && (
              <div className="flex flex-wrap gap-3">
                {children.map((child) => {
                  const nextReward = rewards
                    .filter(r =>
                      (!r.assigned_child_ids || r.assigned_child_ids.length === 0 || r.assigned_child_ids.includes(child.id))
                      && r.cost_points > child.total_points
                    )
                    .sort((a, b) => a.cost_points - b.cost_points)[0];

                  return (
                    <div
                      key={child.id}
                      className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-200 shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {child.avatar_url ? (
                          <img src={child.avatar_url} alt={child.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          child.name.charAt(0)
                        )}
                      </div>
                      <div className="text-xs">
                        <div className="font-semibold text-slate-700">{child.name}</div>
                        <div className="text-purple-600 font-bold">
                          {formatPoints(child.total_points, { compact: true })}
                        </div>
                        {nextReward && (
                          <div className="text-slate-400 truncate max-w-[120px]">
                            {nextReward.cost_points - child.total_points} to {nextReward.title}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!hasChildren && (
              <Button
                onClick={onAddFirstChild}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Your First Child
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
