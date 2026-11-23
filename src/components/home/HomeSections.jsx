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
import PointsFigure from '@/components/PointsFigure';
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
export function FamilyStrip({ children, selectedId, onSelect }) {
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

// "Little wins, big adventures!" with the points available now.
export function LittleWins({ child }) {
  const available = child.available_points ?? child.total_points ?? 0;
  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div>
          <h2 className="font-display font-bold text-lg text-primary">Little wins, big adventures!</h2>
          <p className="text-sm text-muted-foreground">Every positive step counts.</p>
        </div>
        {/* The same figure as Child View's points card (owner, 22 Nov). The week
            is not repeated here: the selected child's tile above shows it with
            its bar (owner, 22 Nov: trim repetition). */}
        <PointsFigure icon={<PercyIcon id="phosphor:piggy-bank:duotone" className="h-7 w-7" />}
          value={available} valueProps={{ 'data-available': true }} unit={available === 1 ? 'point' : 'points'} label="Available now" />
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
        {goal && <GoalProgress goal={goal} label="Saving for something bigger" />}
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
