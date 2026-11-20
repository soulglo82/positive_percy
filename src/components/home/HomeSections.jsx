// V1 Home sections (approved design 18769f7; plan docs/engineering/V1-IMPLEMENTATION-PLAN.md).
// Every figure comes from the server: week_points, weekly_target and
// available_points on the child, the family streak, the reward stack. No
// savings figures are shown until the savings ledger (owner decision D1).
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PercyIcon from '@/components/icons/PercyIcon';
import CategoryIcon from '@/components/CategoryIcon';
import ChildAvatar from '@/components/child/ChildAvatar';
import { childColour } from '@/lib/childColour';

// Approved: "{n}-day family streak · Keep the good stuff going!". Hidden at 0
// (owner decision D4: no zero-streak copy exists).
export function StreakStrip({ streak }) {
  if (!streak) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-warning px-3 py-2 text-sm">
      <p className="flex items-center gap-2 font-semibold text-foreground">
        <PercyIcon id="phosphor:sparkle:duotone" className="h-5 w-5 text-primary" />
        {streak}-day family streak
      </p>
      <p className="text-sm text-muted-foreground">Keep the good stuff going!</p>
    </div>
  );
}

const pct = (n, d) => (d > 0 ? Math.max(0, Math.min(100, Math.round((n / d) * 100))) : 0);

function ProgressBar({ value, max }) {
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden" aria-hidden="true">
      {/* Decorative fill: the figures beside it carry the meaning. */}
      <div className="h-full rounded-full bg-sunrise" style={{ width: pct(value, max) + '%' }} />
    </div>
  );
}

// Selected child is marked with a purple 2px border and aria-pressed. The
// approved orange border is below 3:1 (intended deviation, recorded).
export function FamilyStrip({ children, selectedId, onSelect }) {
  return (
    <div className="grid grid-cols-2 xs:grid-cols-3 lg:grid-cols-4 gap-3" role="group" aria-label="Choose a child">
      {children.map((child) => {
        const selected = child.id === selectedId;
        const week = child.week_points ?? 0;
        return (
          <button key={child.id} type="button" aria-pressed={selected}
            onClick={() => onSelect(child.id)}
            className={cn('min-h-11 rounded-lg bg-card p-3 text-left space-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              selected ? 'border-2 border-selected-border' : 'border border-border hover:bg-accent')}>
            <ChildAvatar name={child.name} url={child.avatar_url} size="sm" colour={childColour(child, children)} decorative />
            <span className="block font-semibold text-sm text-foreground break-words">{child.name}</span>
            <span className="block text-xs text-muted-foreground tabular-nums">{week} / {child.weekly_target} this week</span>
            <ProgressBar value={week} max={child.weekly_target} />
          </button>
        );
      })}
    </div>
  );
}

// "Little wins, big adventures!" with This week and Available now.
export function LittleWins({ child }) {
  const week = child.week_points ?? 0;
  const available = child.available_points ?? child.total_points ?? 0;
  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div>
          <h2 className="font-display font-bold text-lg text-primary">Little wins, big adventures!</h2>
          <p className="text-sm text-muted-foreground">Every positive step counts.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border p-3">
            <p className="font-display font-extrabold text-title text-foreground tabular-nums">{week} / {child.weekly_target}</p>
            <p className="text-sm font-medium text-muted-foreground">This week</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="font-display font-extrabold text-title text-foreground tabular-nums">{available} {available === 1 ? 'point' : 'points'}</p>
            <p className="text-sm font-medium text-muted-foreground">Available now</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// "What you're working towards": the child's chosen (stacked) rewards at
// current names and costs (server reward_stack_priced, the same stack that
// available_points is computed from). No savings bar or "saved" figures until
// owner decision D1.
export function WorkingTowards({ child }) {
  const stack = child.reward_stack_priced ?? [];
  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <h2 className="font-display font-bold text-lg text-primary">What you're working towards</h2>
        {stack.map((item, i) => (
          <div key={item.rewardId + '-' + i} className="flex items-center gap-3">
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-warning text-primary">
              <PercyIcon id="phosphor:gift:duotone" className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground break-words">{item.name}</p>
              <p className="text-sm text-muted-foreground">{item.cost} {item.cost === 1 ? 'point' : 'points'} · Ready when a parent agrees</p>
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <Link to={createPageUrl('ChildView') + '?child=' + encodeURIComponent(child.id)} className="inline-flex items-center min-h-11 text-sm font-semibold text-primary underline-offset-4 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            View all goals and rewards
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// "Quick Points": the family's quick behaviours for the selected child.
export function QuickPoints({ child, actions, awarding, onAward, onOpenAward, onOpenRewards }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div>
          <h2 className="font-display font-bold text-lg text-primary">Quick Points</h2>
          <p className="text-sm text-muted-foreground">Award points for positive behaviour, whenever it happens.</p>
        </div>
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No quick points yet.{' '}
            <Link to={createPageUrl('ParentProfile')} className="inline-flex items-center min-h-11 font-medium text-foreground underline underline-offset-4 rounded-sm hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              Choose them in Settings
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {actions.map((action) => (
              <button key={action.id} type="button" disabled={awarding}
                onClick={() => onAward(child, action)}
                aria-label={`${action.label} +${action.points} for ${child.name}`}
                className="disabled:opacity-60 flex items-center gap-1.5 min-h-11 rounded-md border border-border bg-warning px-2 py-3 text-left text-sm font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <span className="text-primary"><CategoryIcon iconKey={action.icon_key} className="h-5 w-5" /></span>
                {/* Wraps only between words; a long single word may shrink the badge gap, never split. */}
                <span className="flex-1 min-w-0">{action.label}</span>
                <span className="shrink-0 rounded-md bg-star px-1.5 py-0.5 text-sm font-semibold text-foreground tabular-nums">+{action.points}</span>
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={onOpenAward}>
            <PercyIcon id="phosphor:plus-circle:duotone" className="h-4 w-4" />
            Award points
          </Button>
          <Button variant="outline" onClick={onOpenRewards}>
            <PercyIcon id="phosphor:gift:duotone" className="h-4 w-4" />
            Rewards
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
