import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Pencil, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";

const QUICK_ACTIONS = [
  { label: "Kindness", points: 5, category: "Kindness" },
  { label: "Homework", points: 5, category: "Homework" },
  { label: "Chores", points: 5, category: "Chores" },
  { label: "Manners", points: 5, category: "Good Manners" },
];

export default function ChildCard({ child, onAddPoints, onSubtractPoints, onEdit, onQuickAction }) {
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
              <div className="text-xs text-slate-500">points</div>
              {(child.points_spent || 0) > 0 && (
                <div className="flex items-center justify-end gap-1 mt-1">
                  <ShoppingBag className="w-3 h-3 text-amber-500" />
                  <span className="text-xs text-amber-600 font-medium">{child.points_spent} spent</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Buttons */}
          {onQuickAction && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.category}
                  onClick={() => onQuickAction(child, action)}
                  className="text-xs font-medium px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:border-green-300 transition-colors min-h-[36px]"
                >
                  +{action.points} {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => onAddPoints(child)}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0 min-h-[44px]"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
            <Button
              onClick={() => onSubtractPoints(child)}
              variant="outline"
              className="border-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 min-h-[44px]"
            >
              <Minus className="w-4 h-4 mr-1" />
              Adjust
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
