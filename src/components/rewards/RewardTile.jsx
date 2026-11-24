// V1-D catalogue tile: icon, title, points, visibility tag and Edit. Used by
// Rewards and Children.
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import RewardIcon from './RewardIcon';

const pointsWord = (n) => (n === 1 ? 'point' : 'points');

export default function RewardTile({ reward, onEdit }) {
  const visible = reward.visible_to_child !== false;
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <RewardIcon reward={reward} size="lg" />
      <p className="break-words font-display font-bold text-foreground">{reward.title}</p>
      {/* "{cost} points · Bigger achievement": approved wording for a bigger goal (D1, N7). */}
      <p className="text-sm text-muted-foreground tabular-nums">
        {reward.cost_points} {pointsWord(reward.cost_points)}{reward.is_bigger_goal ? ' · Big Goal' : ''}
      </p>
      <span className={cn('self-start rounded-md border px-2 py-0.5 text-xs font-semibold',
        visible ? 'border-border bg-muted text-primary' : 'border-border bg-card text-muted-foreground')}>
        {visible ? 'Visible to children' : 'Hidden from children'}
      </span>
      <Button variant="outline" className="mt-auto w-full" aria-label={`Edit ${reward.title}`} onClick={() => onEdit(reward)}>
        Edit
      </Button>
    </div>
  );
}
