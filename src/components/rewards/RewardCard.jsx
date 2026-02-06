import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Eye, EyeOff, Pencil } from "lucide-react";
import { motion } from "framer-motion";

export default function RewardCard({ reward, onRequest, isParentView, onToggleVisibility, onEdit, canAfford, assignedChildren = [] }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`overflow-hidden hover:shadow-lg transition-all duration-300 ${
        !reward.visible_to_child && isParentView ? 'opacity-60' : ''
      }`}>
        {/* Image/Emoji Header */}
        <div className={`h-32 flex items-center justify-center ${
          reward.image_url 
            ? 'bg-cover bg-center' 
            : 'bg-gradient-to-br from-amber-300 via-orange-300 to-pink-300'
        }`}
        style={reward.image_url ? { backgroundImage: `url(${reward.image_url})` } : {}}>
          {!reward.image_url && (
            <span className="text-6xl">
              {reward.emoji || '🎁'}
            </span>
          )}
        </div>

        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-bold text-slate-800 text-lg line-clamp-1">
              {reward.title}
            </h3>
            {isParentView && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 -mt-1"
                  onClick={() => onEdit(reward)}
                >
                  <Pencil className="w-4 h-4 text-slate-400" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 -mt-1"
                  onClick={() => onToggleVisibility(reward)}
                >
                  {reward.visible_to_child ? (
                    <Eye className="w-4 h-4 text-slate-400" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-slate-400" />
                  )}
                </Button>
              </div>
            )}
          </div>

          {reward.description && (
            <p className="text-sm text-slate-600 mb-2 line-clamp-2">
              {reward.description}
            </p>
          )}

          {isParentView && assignedChildren.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-1">Assigned to:</p>
              <div className="flex flex-wrap gap-1">
                {assignedChildren.map(child => (
                  <Badge key={child.id} variant="outline" className="text-xs">
                    {child.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Badge className="bg-amber-100 text-amber-700 border-0 text-base px-3 py-1">
              <Coins className="w-4 h-4 mr-1" />
              {reward.cost_points}
            </Badge>
            {!isParentView && (
              onRequest ? (
                <Button
                  size="sm"
                  onClick={() => onRequest(reward)}
                  disabled={!canAfford}
                  className={canAfford 
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                    : "bg-slate-300"
                  }
                >
                  Request
                </Button>
              ) : (
                <Badge variant="outline" className="text-xs text-slate-500">
                  Weekends only
                </Badge>
              )
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
