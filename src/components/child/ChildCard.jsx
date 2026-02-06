import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Minus, TrendingUp, Pencil } from "lucide-react";
import { motion } from "framer-motion";

export default function ChildCard({ child, onAddPoints, onSubtractPoints, onEdit }) {
  const progressPercent = Math.min((child.weekly_points / child.weekly_target) * 100, 100);
  const isOnTrack = child.weekly_points >= child.weekly_target;
  
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
                {isOnTrack && (
                  <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                    <TrendingUp className="w-3 h-3 text-white" />
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
                <p className="text-sm text-slate-500">Total: {child.total_points} points</p>
              </div>
            </div>
            <Badge 
              className={`${isOnTrack ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'} border-0`}
            >
              {child.weekly_points} / {child.weekly_target}
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-slate-600 mb-2">
              <span>Weekly Progress</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  isOnTrack 
                    ? 'bg-gradient-to-r from-green-400 to-emerald-500' 
                    : 'bg-gradient-to-r from-purple-400 to-pink-400'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => onAddPoints(child)}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
            <Button
              onClick={() => onSubtractPoints(child)}
              variant="outline"
              className="border-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300"
            >
              <Minus className="w-4 h-4 mr-1" />
              Remove
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
