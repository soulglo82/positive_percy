// HeroCard — family dashboard summary
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Flame, Star } from "lucide-react";
import { PERCY } from "@/constants/terminology";
import { motion } from "framer-motion";

export default function HeroCard({ children = [], streak = 0, onAddFirstChild }) {
  const hasChildren = children.length > 0;

  const weeklyTotal = children.reduce((sum, c) => sum + (c.weekly_points || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="overflow-hidden border-2 border-purple-200 bg-gradient-to-r from-purple-50 via-white to-pink-50 shadow-lg">
        <CardContent className="p-5 sm:p-6">
          {hasChildren ? (
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-3">
                Family Dashboard
              </h1>
              <div className="flex flex-wrap gap-3">
                {/* Streak */}
                {streak > 0 ? (
                  <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5">
                    <Flame className="w-5 h-5 text-orange-500" />
                    <span className="text-lg font-bold text-orange-600">{streak}</span>
                    <span className="text-sm text-orange-500 font-medium">day streak</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                    <Star className="w-5 h-5 text-slate-400" />
                    <span className="text-sm text-slate-500">Award points to start your streak</span>
                  </div>
                )}

                {/* Weekly total */}
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                  <Star className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-green-700">
                    This week: <span className="font-bold text-lg">{weeklyTotal}</span> points
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-1">
                  Welcome to Positive Percy
                </h1>
                <p className="text-slate-500">{PERCY.TAGLINE}</p>
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
