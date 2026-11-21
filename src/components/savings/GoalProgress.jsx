// One bigger goal's progress (D1, savings design §19.3). Approved wording:
// "Saving for something bigger", "{saved} of {cost} points saved", "{n} to go".
// Every figure comes from the server (child.goals).
import RewardIcon from '@/components/rewards/RewardIcon';

const pct = (n, d) => (d > 0 ? Math.max(0, Math.min(100, Math.round((n / d) * 100))) : 0);

export default function GoalProgress({ goal, label = null, showToGo = true }) {
  return (
    <div className="space-y-2" data-goal={goal.rewardId}>
      {label && <p className="text-sm font-semibold text-muted-foreground">{label}</p>}
      <div className="flex items-center gap-3">
        <RewardIcon reward={goal} size="md" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground break-words">{goal.name}</p>
          <p className="text-sm text-muted-foreground tabular-nums">{goal.saved} of {goal.cost} points saved</p>
        </div>
        {showToGo && <p className="shrink-0 text-sm font-semibold text-foreground tabular-nums">{goal.to_go > 0 ? `${goal.to_go} to go` : 'Fully saved!'}</p>}
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden" aria-hidden="true">
        <div className="h-full rounded-full bg-sunrise" style={{ width: pct(goal.saved, goal.cost) + '%' }} />
      </div>
    </div>
  );
}
