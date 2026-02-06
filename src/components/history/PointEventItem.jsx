import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Plus, Minus } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function PointEventItem({ event }) {
  const isPositive = event.points > 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-4 p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors"
    >
      <div className={`p-2 rounded-full ${
        isPositive ? 'bg-green-100' : 'bg-rose-100'
      }`}>
        {isPositive ? (
          <Plus className="w-4 h-4 text-green-600" />
        ) : (
          <Minus className="w-4 h-4 text-rose-600" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <h4 className="font-semibold text-slate-800">
              {event.child_name}
            </h4>
            <Badge variant="outline" className="text-xs mt-1">
              {event.category}
            </Badge>
          </div>
          <span className={`font-bold text-lg ${
            isPositive ? 'text-green-600' : 'text-rose-600'
          }`}>
            {isPositive ? '+' : ''}{event.points}
          </span>
        </div>
        
        {event.note && (
          <p className="text-sm text-slate-600 mt-2">
            {event.note}
          </p>
        )}
        
        <p className="text-xs text-slate-400 mt-2">
          {format(new Date(event.created_date), "MMM d, yyyy 'at' h:mm a")}
        </p>
      </div>
    </motion.div>
  );
}
