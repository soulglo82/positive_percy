// HeroCard: family dashboard summary
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Flame } from "lucide-react";
import { PERCY } from "@/constants/terminology";
import PointsStar from "@/components/brand/PointsStar";
import Logo from "@/components/brand/Logo";

export default function HeroCard({ children = [], streak = 0, onAddFirstChild }) {
  const hasChildren = children.length > 0;

  const weeklyTotal = children.reduce((sum, c) => sum + (c.week_points || 0), 0);

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        {hasChildren ? (
          <div>
            <h1 className="text-title font-semibold text-foreground mb-3">
              Family Dashboard
            </h1>
            <div className="flex flex-wrap gap-3">
              {streak > 0 ? (
                <div className="flex items-center gap-2 bg-muted border border-border rounded-md px-4 py-2">
                  <Flame className="w-4 h-4 text-primary" strokeWidth={1.5} aria-hidden="true" />
                  <span className="text-lg font-semibold text-foreground tabular-nums">{streak}</span>
                  <span className="text-sm text-muted-foreground">day streak</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-muted border border-border rounded-md px-4 py-2">
                  <Flame className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                  <span className="text-sm text-muted-foreground">Award points to start your streak</span>
                </div>
              )}

              <div className="flex items-center gap-2 bg-muted border border-border rounded-md px-4 py-2">
                <PointsStar />
                <span className="text-sm text-muted-foreground">
                  This week: <span className="font-semibold text-lg text-foreground tabular-nums">{weeklyTotal}</span> points
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Logo size={48} decorative />
              <div>
                <h1 className="text-title font-semibold text-foreground mb-1">
                  Welcome to Positive Percy
                </h1>
                <p className="text-muted-foreground">{PERCY.TAGLINE}</p>
              </div>
            </div>
            <Button onClick={onAddFirstChild}>
              <UserPlus className="w-4 h-4" />
              Add Your First Child
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
