// HeroCard: the family's header on Home. Solid fox orange (Batch D v0.5).
import { Button } from "@/components/ui/button";
import { UserPlus, Flame, Star } from "lucide-react";
import { PERCY } from "@/constants/terminology";
import Logo from "@/components/brand/Logo";

function Chip({ children }) {
  return (
    <div className="flex items-center gap-2 bg-primary-hover text-primary-foreground rounded-full pl-3 pr-4 min-h-11">
      {children}
    </div>
  );
}

export default function HeroCard({ children = [], streak = 0, onAddFirstChild }) {
  const hasChildren = children.length > 0;
  const weeklyTotal = children.reduce((sum, c) => sum + (c.week_points || 0), 0);

  return (
    <section className="rounded-lg bg-primary text-primary-foreground shadow overflow-hidden">
      <div className="p-5 sm:p-6 flex items-center gap-4">
        <div className="shrink-0 rounded-full bg-card p-1.5 shadow">
          <Logo size={hasChildren ? 52 : 64} decorative />
        </div>
        <div className="min-w-0 flex-1">
          {hasChildren ? (
            <>
              <h1 className="font-display text-title font-semibold mb-3">
                Family Dashboard
              </h1>
              <div className="flex flex-wrap gap-2">
                <Chip>
                  <Flame className="w-4 h-4" aria-hidden="true" />
                  {streak > 0 ? (
                    <span className="text-sm">
                      <span className="text-lg font-semibold tabular-nums">{streak}</span> day streak
                    </span>
                  ) : (
                    <span className="text-sm">Award points to start your streak</span>
                  )}
                </Chip>
                <Chip>
                  <Star className="w-4 h-4 fill-primary-foreground" aria-hidden="true" />
                  <span className="text-sm">
                    This week: <span className="text-lg font-semibold tabular-nums">{weeklyTotal}</span> points
                  </span>
                </Chip>
              </div>
            </>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="font-display text-title font-semibold mb-1">
                  Welcome to Positive Percy
                </h1>
                <p>{PERCY.TAGLINE}</p>
              </div>
              <Button onClick={onAddFirstChild} variant="outline" className="border-transparent">
                <UserPlus className="w-4 h-4" />
                Add Your First Child
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
