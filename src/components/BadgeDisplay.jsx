import React from 'react';
import { BADGE_DEFINITIONS, getBadgeById } from '@/data/badge-definitions';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function BadgeDisplay({ earnedBadgeIds = [] }) {
  if (earnedBadgeIds.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-slate-400">No badges earned yet. Keep going!</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2 justify-center">
        {earnedBadgeIds.map((badgeId) => {
          const badge = getBadgeById(badgeId);
          if (!badge) return null;
          return (
            <Tooltip key={badgeId}>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center p-2 rounded-lg bg-white/60 border border-slate-200 hover:bg-white hover:shadow-md transition-all cursor-default min-w-[60px]">
                  <span className="text-2xl">{badge.emoji}</span>
                  <span className="text-[10px] text-slate-600 font-medium mt-0.5 text-center leading-tight">{badge.title}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{badge.title}</p>
                <p className="text-xs text-slate-400">{badge.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {/* Show locked badges as motivation */}
        {BADGE_DEFINITIONS.filter(b => !earnedBadgeIds.includes(b.id)).slice(0, 3).map((badge) => (
          <Tooltip key={badge.id}>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center p-2 rounded-lg bg-slate-100 border border-slate-200 opacity-40 cursor-default min-w-[60px]">
                <span className="text-2xl grayscale">🔒</span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5 text-center leading-tight">???</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Locked Badge</p>
              <p className="text-xs text-slate-400">{badge.description}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
