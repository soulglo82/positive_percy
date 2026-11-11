import { Card, CardContent } from "@/components/ui/card";
import CategoryIcon from '@/components/CategoryIcon';
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { PERCY } from "@/constants/terminology";
import ChildAvatar from "./ChildAvatar";
import PointsStar from "@/components/brand/PointsStar";
import { cn } from "@/lib/utils";

// This week against the weekly target. Hidden when there is no target.
function GoalBar({ week, target, colour }) {
  if (!target || target <= 0) return null;
  const pct = Math.min(100, Math.round((Math.max(0, week) / target) * 100));
  return (
    <div className="flex items-center gap-2 mb-4">
      <div
        className="relative flex-1 h-2 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-label="This week's points towards the weekly target"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(Math.max(0, week), target)}
      >
        <div className={cn("h-full rounded-full", colour ? colour.band : "bg-earn")} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums shrink-0">{Math.max(0, week)} / {target}</span>
      <PointsStar className="h-4 w-4 text-foreground" />
    </div>
  );
}

export default function ChildCard({ child, colour, popKey = 0, onAddPoints, onEdit, onQuickAction, onSpendRewards, quickActions = [], rewards = [], awarding = false }) {
  const week = child.week_points || 0;
  // popKey goes up when an award made on this device lands (not on refetches
  // or changes from another device); each new key replays the pop once.
  const pops = popKey;
  return (
    <Card className="overflow-hidden">
      <div className={cn("h-1.5", colour ? colour.band : "bg-border")} aria-hidden="true" />
      <CardContent className="p-4 sm:p-5">
        {/* Child header */}
        <div className="flex items-center gap-3 mb-3">
          <ChildAvatar name={child.name} url={child.avatar_url} colour={colour} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <h3 className="font-display text-lg font-semibold text-foreground break-words line-clamp-2 min-w-0">{child.name}</h3>
              {/* Always visible, 44px (A2 E1): hover-only never worked on phones or keyboards. */}
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(child)}
                  aria-label={`Edit ${child.name}`}
                  className="shrink-0 w-11 h-11 -my-2 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Pencil className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
                </button>
              )}
            </div>
            {week > 0 ? (
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{week}</span> points this week. Keep it up
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Ready to earn some points</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center justify-end gap-1.5 text-total font-semibold text-foreground tabular-nums">
              <PointsStar key={`star-${pops}`} className={cn("h-6 w-6", pops > 0 && "star-pop")} />
              <span key={`total-${pops}`} className={cn("inline-block", pops > 0 && "total-rise")}>{child.total_points}</span>
            </div>
            <div className="text-xs text-muted-foreground">{PERCY.POINTS_COMPACT}</div>
          </div>
        </div>

        <GoalBar week={week} target={child.weekly_target} colour={colour} />

        {/* No quick points ticked: say where to choose them (no built-in set). */}
        {onQuickAction && quickActions.length === 0 && (
          <p className="text-sm text-muted-foreground mb-3">
            No quick points yet.{' '}
            <Link to={createPageUrl('ParentProfile')} className="inline-flex items-center min-h-11 font-medium text-foreground underline underline-offset-4 rounded-sm hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              Choose them in Settings
            </Link>
          </p>
        )}

        {/* Quick Actions, labelled */}
        {onQuickAction && quickActions.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Quick points</p>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.id || action.label}
                  onClick={() => onQuickAction(child, action)}
                  disabled={awarding}
                  aria-label={`${action.label} +${action.points} for ${child.name}`}
                  className="disabled:opacity-60 flex items-center gap-1.5 text-sm font-medium px-2.5 rounded-md bg-earn-soft text-foreground border border-transparent hover:border-earn active:border-earn transition-colors min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <CategoryIcon iconKey={action.icon_key} />
                  <span className="truncate flex-1 text-left">{action.label}</span>
                  <span className="font-semibold text-earn shrink-0 text-sm tabular-nums">+{action.points}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={() => onAddPoints(child)} className="flex-1">
            <Plus className="w-4 h-4" />
            Add points
          </Button>
          {onSpendRewards && rewards.length > 0 && (
            <Button onClick={() => onSpendRewards(child)} variant="secondary" className="flex-1">
              <Gift className="w-4 h-4" />
              Spend
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
