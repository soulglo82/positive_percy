import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Gift } from "lucide-react";
import { motion } from "framer-motion";
import { PERCY } from "@/constants/terminology";

export default function ChildCard({ child, onAddPoints, onEdit, onQuickAction, onSpendRewards, quickActions = [], rewards = [] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="overflow-hidden border-2 hover:shadow-xl transition-all duration-300">
        <div className="h-2 bg-gradient-to-r from-purple-200 via-pink-200 to-blue-200" />
        <CardContent className="p-4 sm:p-5">
          {/* Child header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative group shrink-0">
              {child.avatar_url ? (
                <img
                  src={child.avatar_url}
                  alt={child.name}
                  className="w-14 h-14 rounded-full object-cover border-3 border-purple-100"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xl font-bold border-3 border-purple-100">
                  {child.name.charAt(0)}
                </div>
              )}
              {onEdit && (
                <button
                  onClick={() => onEdit(child)}
                  aria-label={`Edit ${child.name}`}
                  className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Pencil className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-slate-800 truncate">{child.name}</h3>
              <p className="text-sm text-slate-500">
                {child.weekly_points || 0} this week
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl font-bold text-purple-600">{child.total_points}</div>
              <div className="text-[11px] text-slate-400 font-medium">{PERCY.POINTS_COMPACT}</div>
            </div>
          </div>

          {/* Quick Actions — labeled */}
          {onQuickAction && quickActions.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Quick Points</p>
              <div className="grid grid-cols-2 gap-1.5">
                {quickActions.map((action) => (
                  <button
                    key={action.id || action.label}
                    onClick={() => onQuickAction(child, action)}
                    className="flex items-center gap-1.5 text-sm font-medium px-2.5 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:border-green-300 active:bg-green-200 transition-colors min-h-[38px]"
                  >
                    <span className="shrink-0">{action.icon || '⭐'}</span>
                    <span className="truncate flex-1 text-left">{action.label}</span>
                    <span className="font-bold text-green-600 shrink-0 text-xs">+{action.points}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => onAddPoints(child)}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0 min-h-[44px]"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Points
            </Button>
            {onSpendRewards && rewards.length > 0 && (
              <Button
                onClick={() => onSpendRewards(child)}
                variant="outline"
                className="flex-1 border-orange-200 text-orange-700 hover:bg-orange-50 hover:border-orange-300 min-h-[44px]"
              >
                <Gift className="w-4 h-4 mr-1" />
                Spend
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
