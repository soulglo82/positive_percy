// V1 Home sections (approved design 18769f7; plan docs/engineering/V1-IMPLEMENTATION-PLAN.md).
// Every figure comes from the server: week_points, weekly_target and
// available_points on the child, the family streak, the reward stack and
// the child's bigger goals (D1, savings design §19.3).
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PercyIcon from '@/components/icons/PercyIcon';
import BehaviourTileParts, { TILE_GRID_EVEN, TILE_LAYOUT } from '@/components/home/BehaviourTile';
import RewardIcon from '@/components/rewards/RewardIcon';
import ChildAvatar from '@/components/child/ChildAvatar';
import GoalProgress from '@/components/savings/GoalProgress';
import { leadingGoal } from '@/lib/savings';
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
export function FamilyStrip({ children, selectedId, onSelect, compact = false }) {
  // Compact (Give Percy Points, V1-F design section 11): one line per child,
  // avatar and name only. A button is as wide as its content and grows to
  // share the row; a name wraps only when it is wider than the whole row, so
  // short names never break and a long one never overflows. The selected
  // child is marked by a ring, so its border is the same width as the others'.
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a child">
        {children.map((child) => {
          const selected = child.id === selectedId;
          return (
            <button key={child.id} type="button" aria-pressed={selected} onClick={() => onSelect(child.id)}
              className={cn('flex min-h-11 max-w-full shrink-0 grow items-center gap-2 rounded-lg border bg-card px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selected ? 'border-selected-border ring-1 ring-selected-border' : 'border-border hover:bg-accent')}>
              <ChildAvatar name={child.name} url={child.avatar_url} size="xs" colour={childColour(child, children)} decorative />
              <span className="min-w-0 break-words text-sm font-semibold text-foreground">{child.name}</span>
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2 xs:gap-3" role="group" aria-label="Choose a child">
      {/* Three across at every width. Below 360px it used to be two, which left the third child alone on a second row (design critique). On a desktop it was already three: the old `lg:grid-cols-4` never applied, because the custom `xs` rule is emitted after `lg` (code review). */}
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
            <span className="block text-xs text-muted-foreground tabular-nums">{week} / {child.weekly_target ?? 0} this week</span>
            <ProgressBar value={week} max={child.weekly_target} />
          </button>
        );
      })}
    </div>
  );
}

// The points line (owner's "Points 1", 24 November; V1-F §13): the selected
// child's available points in one slim card straight under the child picker.
// One paragraph, so it reads "Available now for Lara 90 points"; the name is
// in <bdi> so a right-to-left name cannot reorder the figure. Not a heading
// and not a live region (an award already raises a toast). On a phone the
// figure sits at the right and drops under a long name; from lg it follows
// the label instead of sitting at the far edge of a wide page.
export function AvailableLine({ child }) {
  const available = child.available_points ?? child.total_points ?? 0;
  return (
    <Card data-points-line>
      <CardContent className="flex items-center gap-3 px-3 py-2">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-warning text-primary">
          <PercyIcon id="phosphor:piggy-bank:duotone" className="h-5 w-5" />
        </span>
        <p className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 lg:justify-start">
          <span className="min-w-0 break-words text-sm font-medium text-muted-foreground">Available now for <bdi>{child.name}</bdi></span>
          {' '}
          <span className="whitespace-nowrap font-display text-lg font-bold text-foreground tabular-nums">
            <span data-available>{available}</span>{' '}{available === 1 ? 'point' : 'points'}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

// "What you're working towards": the selected child's bigger goal with the
// most saved (D1 N7), then the chosen (stacked) rewards at current names and
// costs (server reward_stack_priced, the same stack available_points is
// computed from).
export function WorkingTowards({ child }) {
  const stack = child.reward_stack_priced ?? [];
  const goal = leadingGoal(child.goals);
  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <h2 className="font-display font-bold text-lg text-primary">What you're working towards</h2>
        {goal && <GoalProgress goal={goal} label="Big Goal" />}
        {/* Owner wording (21 Nov): the funded-goal celebration (not a redemption). */}
        {goal && goal.to_go === 0 && <p className="text-sm font-semibold text-foreground">{child.name} has saved enough for {goal.name}!</p>}
        {stack.map((item, i) => (
          <div key={item.rewardId + '-' + i} className="flex items-center gap-3">
            <RewardIcon reward={item} size="md" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground break-words">{item.name}</p>
              <p className="text-sm text-muted-foreground">{item.cost} {item.cost === 1 ? 'point' : 'points'} · Ready when a parent agrees</p>
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <Link to={createPageUrl('ChildView') + '?child=' + encodeURIComponent(child.id)} className="inline-flex items-center min-h-11 text-sm font-semibold text-primary underline-offset-4 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            View all Big Goals and rewards
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
          {/* Owner, 24 November 2026: say that a box acts at once. No boxes, no line. */}
          {actions.length > 0 && <p className="text-sm text-muted-foreground">Tap a box to give its points straight away.</p>}
        </div>
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No quick points yet.{' '}
            <Link to={createPageUrl('ParentProfile')} className="inline-flex items-center min-h-11 font-medium text-foreground underline underline-offset-4 rounded-sm hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              Choose them in Settings
            </Link>
          </p>
        ) : (
          <div className={TILE_GRID_EVEN} data-tile-grid="even">
            {actions.map((action) => (
              <button key={action.id} type="button" disabled={awarding} data-tile
                onClick={() => onAward(child, action)}
                aria-label={`${action.label} +${action.points} for ${child.name}`}
                className={cn(TILE_LAYOUT, 'disabled:opacity-60 border border-border bg-warning hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2')}>
                <BehaviourTileParts iconKey={action.icon_key} name={action.label} points={action.points} />
              </button>
            ))}
          </div>
        )}
        {/* One column below 360px: side by side the label and its icon ran to the button's edges (owner review 2026-11-22). */}
        <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
          {/* Owner, 24 November 2026: the boxes are the main thing; the form is
              "Custom points" (soft orange) beside Rewards (soft purple), neither solid. */}
          <Button variant="warm" onClick={onOpenAward}>
            <PercyIcon id="phosphor:plus-circle:duotone" className="h-4 w-4" />
            Custom points
          </Button>
          <Button variant="soft" onClick={onOpenRewards}>
            <PercyIcon id="phosphor:gift:duotone" className="h-4 w-4" />
            Rewards
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
