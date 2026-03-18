import React from 'react';
import { format } from "date-fns";
import { motion } from "framer-motion";
import { PERCY, formatPoints } from "@/constants/terminology";

export default function PointEventItem({ event }) {
  const isPositive = event.points > 0;
  const icon = isPositive ? '⭐' : '⚙️';
  const colorClass = isPositive ? 'text-green-600' : 'text-rose-600';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3 p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors"
    >
      <span className="text-lg mt-0.5 shrink-0">{icon}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 leading-snug">
              {icon} {event.child_name} {isPositive ? 'earned' : 'adjusted'}{' '}
              <span className={colorClass}>
                {formatPoints(Math.abs(event.points), { compact: true, showSign: isPositive })}
              </span>
            </p>
            {(event.category || event.note) && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {event.category}{event.note ? ` — ${event.note}` : ''}
              </p>
            )}
          </div>
          <span className={`font-bold text-sm ${colorClass} whitespace-nowrap shrink-0`}>
            {isPositive ? '+' : ''}{event.points}
          </span>
        </div>

        <p className="text-xs text-slate-400 mt-1.5">
          {format(new Date(event.created_date), "MMM d, yyyy 'at' h:mm a")}
        </p>
      </div>
    </motion.div>
  );
}
