// HeroCard: the family's header on Home. Fox orange, one short band
// (Batch D v0.6; shortened after the external review, Nael 2026-11-11).
import { Button } from "@/components/ui/button";
import { UserPlus, Flame, Star } from "lucide-react";
import { PERCY } from "@/constants/terminology";
import Logo from "@/components/brand/Logo";

function Chip({ children }) {
  return (
    <div className="flex items-center gap-1.5 bg-primary-hover text-primary-foreground rounded-full pl-2.5 pr-3 min-h-9 text-sm whitespace-nowrap">
      {children}
    </div>
  );
}

export default function HeroCard({ children = [], streak = 0, onAddFirstChild }) {
  const hasChildren = children.length > 0;
  const weeklyTotal = children.reduce((sum, c) => sum + (c.week_points || 0), 0);

  return (
    <section className="rounded-lg bg-primary text-primary-foreground shadow">
      <div className="px-4 py-3 sm:px-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-3 min-w-0 mr-auto">
          <span className="shrink-0 rounded-full bg-card p-1">
            <Logo size={32} decorative />
          </span>
          <h1 className="font-display text-lg sm:text-title font-semibold truncate">
            {hasChildren ? 'Family Dashboard' : 'Welcome to Positive Percy'}
          </h1>
        </div>
        {hasChildren ? (
          <div className="flex flex-wrap gap-2">
            <Chip>
              <Flame className="w-4 h-4" aria-hidden="true" />
              {streak > 0 ? (
                <span><span className="font-semibold tabular-nums">{streak}</span> day streak</span>
              ) : (
                <span>Award points to start your streak</span>
              )}
            </Chip>
            <Chip>
              <Star className="w-4 h-4 fill-primary-foreground" aria-hidden="true" />
              <span>This week: <span className="font-semibold tabular-nums">{weeklyTotal}</span> points</span>
            </Chip>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">{PERCY.TAGLINE}</p>
            <Button onClick={onAddFirstChild} variant="outline" className="border-transparent">
              <UserPlus className="w-4 h-4" />
              Add Your First Child
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
