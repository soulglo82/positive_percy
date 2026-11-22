// V1-B Children page (approved design 9de1df2, screen "children";
// docs/engineering/V1-B-DESIGN.md §2). Every figure comes from the server:
// week_points, weekly_target and available_points on the child, the goals
// and today's completions from GET /api/todays-goals?manage=true. "Saving for
// something bigger" shows the child's bigger goals from child.goals (D1,
// savings design §19.3); its Edit opens the savings dialog.
import { useRef, useState } from 'react';
import { isAssignedTo } from '@/lib/assignment';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { Child, Reward } from '@/api/entities';
import { getToken, useAuth } from '@/lib/AuthContext';
import { childOrder, childColour } from '@/lib/childColour';
import ChildAvatar from '../components/child/ChildAvatar';
import { loadTodaysGoals, goalRecurrenceV1, pointsText } from '@/lib/todaysGoals';
import { useRewardMutations } from '@/hooks/useRewardMutations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PercyIcon from '@/components/icons/PercyIcon';
import PointsFigure from '@/components/PointsFigure';
import { FamilyStrip } from '../components/home/HomeSections';
import WelcomeCard from '../components/home/WelcomeCard';
import AddChildModal from '../components/child/AddChildModal';
import EditChildModal from '../components/child/EditChildModal';
import ManageGoalsDialog from '../components/dashboard/ManageGoalsDialog';
import RewardForm from '../components/rewards/RewardForm';
import RewardTile from '../components/rewards/RewardTile';
import GoalProgress from '../components/savings/GoalProgress';
import SavingsDialog from '../components/savings/SavingsDialog';
import { leadingGoal, goalRewardsFor, goalOrder } from '@/lib/savings';
import { buildChildCreatePayload } from '@/lib/childPayload';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorCard from '../components/ErrorCard';

const linkClass = 'inline-flex items-center min-h-11 text-sm font-semibold text-primary underline-offset-4 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const pct = (n, d) => (d > 0 ? Math.max(0, Math.min(100, Math.round((n / d) * 100))) : 0);

// Rewards this child can see (assignment). Hidden ones are shown, tagged, for
// the parent; Child View leaves them out. Bigger goals are listed under
// "Saving for something bigger" instead (D1).
export const rewardsForChild = (rewards, childId) => rewards.filter((r) => isAssignedTo(r, childId) && !r.is_bigger_goal);

function SectionHead({ title, children }) {
  return (
    <div className="flex items-center justify-between gap-2">
      {/* The heading wraps; its button stays on the right (design critique: the button dropped under the heading on phones, in some cards and not others). */}
      <h2 className="min-w-0 font-display font-bold text-lg text-primary break-words">{title}</h2>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}

export default function Children() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [childId, setChildId] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('child'); } catch { return null; }
  });
  const [editingChild, setEditingChild] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [goalsStart, setGoalsStart] = useState(null); // null: closed; else the dialog's `start`
  const [rewardEditing, setRewardEditing] = useState(null);
  const [savingsOpen, setSavingsOpen] = useState(false);
  const savingsEdit = useRef(null);
  const { save, remove } = useRewardMutations();

  const { data: children = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['children'],
    queryFn: () => Child.list(),
    enabled: !!user,
    refetchOnWindowFocus: true,
  });
  const { data: rewards = [], isLoading: rewardsLoading, isError: rewardsError, refetch: refetchRewards } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => Reward.list(),
    enabled: !!user,
  });
  const { data: behaviorCategories = [] } = useQuery({
    queryKey: ['behaviorCategories'],
    queryFn: async () => {
      const res = await fetch('/api/behavior-categories', { headers: { Authorization: `Bearer ${getToken()}` } });
      return res.ok ? res.json() : [];
    },
    enabled: !!user,
  });
  const { data: goalsData } = useQuery({
    queryKey: ['todaysGoals', 'manage'],
    queryFn: () => loadTodaysGoals(true),
    enabled: !!user && children.length > 0,
    refetchOnWindowFocus: true,
  });

  if (isLoading) return <div className="min-h-screen p-6"><LoadingSpinner message="Loading your family..." /></div>;

  const ordered = [...children].sort(childOrder);
  const child = ordered.find((c) => c.id === childId) || ordered[0];

  const page = (body) => (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">{body}</div>
      <AddChildModal
        isOpen={showAddChild}
        onClose={() => setShowAddChild(false)}
        onSubmit={async (data) => {
          await Child.create(buildChildCreatePayload(data));
          queryClient.invalidateQueries({ queryKey: ['children'] });
          setShowAddChild(false);
          toast.success('Child added.');
        }}
      />
    </div>
  );

  if (isError) return page(<ErrorCard message="Couldn't load children" onRetry={refetch} />);
  if (!child) return page(<WelcomeCard onAddFirstChild={() => setShowAddChild(true)} />);

  const week = child.week_points ?? 0;
  const target = child.weekly_target ?? 0;
  const available = child.available_points ?? child.total_points ?? 0;
  const toTarget = Math.max(0, target - week);
  const today = goalsData?.date || '';
  const goals = (goalsData?.goals || []).filter((g) => g.child_id === child.id);
  const doneToday = goals.filter((g) => !!g.completion_id).length;
  const treats = rewardsForChild(rewards, child.id);
  const goalRewards = goalRewardsFor(rewards, child.id, isAssignedTo);
  const savedGoals = child.goals || [];
  const topGoal = leadingGoal(savedGoals);
  // Every current goal, at the server's figures when it has savings, else 0
  // saved (code review: a goal with nothing saved is still listed).
  const byGoal = new Map(savedGoals.map((g) => [g.rewardId, g]));
  const goalRows = goalRewards.map((r) => byGoal.get(r.id) || {
    rewardId: r.id, name: r.title, cost: r.cost_points, saved: 0, to_go: r.cost_points, icon_key: r.icon_key, emoji: r.emoji, image_url: r.image_url,
  }).sort(goalOrder);

  return page(
    <>
      <div>
        <h1 className="font-display font-extrabold text-title text-primary">Children</h1>
        <p className="text-muted-foreground">See what every child has achieved and what they're saving for.</p>
      </div>
      <FamilyStrip children={ordered} selectedId={child.id} onSelect={setChildId} />

      <Card>
        <CardContent className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ChildAvatar name={child.name} url={child.avatar_url} colour={childColour(child, ordered)} decorative />
            <div className="min-w-0">
            <h2 className="font-display font-bold text-lg text-primary break-words">{child.name}'s page</h2>
            <p className="text-sm text-muted-foreground tabular-nums">{week} of {target} weekly points · {available} available</p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link to={createPageUrl('ChildView') + '?child=' + encodeURIComponent(child.id)}>View as child</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-5 space-y-3">
          <SectionHead title={`${child.name}'s weekly target`}>
            <Button variant="outline" aria-label={`Edit ${child.name}'s weekly target`} onClick={() => setEditingChild(true)}>Edit</Button>
          </SectionHead>
          {/* The same figure as Child View's points card and Home's (owner, 22 Nov). */}
          <div className="grid gap-3 sm:grid-cols-2">
            <PointsFigure icon={<PercyIcon id="phosphor:target:duotone" className="h-7 w-7" />}
              value={week} unit={`/ ${target}`} label="Earned this week" />
            <PointsFigure icon={<PercyIcon id="phosphor:piggy-bank:duotone" className="h-7 w-7" />}
              value={available} valueProps={{ 'data-available': true }} unit={available === 1 ? 'point' : 'points'} label="Available now" />
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden" aria-hidden="true">
            <div className="h-full rounded-full bg-sunrise" style={{ width: pct(week, target) + '%' }} />
          </div>
          <p className="text-sm text-muted-foreground">{toTarget} to reach this week's target</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-5 space-y-4">
          <SectionHead title="Weekly treats to choose from">
            <Link to={createPageUrl('Rewards')} className={linkClass}>All rewards</Link>
          </SectionHead>
          {rewardsLoading ? (
            <LoadingSpinner message="Loading rewards..." />
          ) : rewardsError ? (
            <ErrorCard message="Couldn't load rewards" onRetry={refetchRewards} />
          ) : treats.length === 0 ? (
            <p className="text-muted-foreground">No rewards created yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {treats.map((reward) => <RewardTile key={reward.id} reward={reward} onEdit={setRewardEditing} />)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-5 space-y-3">
          <SectionHead title="Saving for something bigger">
            {goalRewards.length > 0 && (
              <Button ref={savingsEdit} variant="outline" aria-label={`Edit saving for something bigger for ${child.name}`} onClick={() => setSavingsOpen(true)}>Edit</Button>
            )}
          </SectionHead>
          {goalRewards.length === 0 ? (
            <p className="text-muted-foreground">
              No bigger goals yet.{' '}
              <Link to={createPageUrl('Rewards')} className={linkClass}>Mark a reward as a bigger goal</Link>
            </p>
          ) : (
            <div className="space-y-4">
              {goalRows.map((g) => <GoalProgress key={g.rewardId} goal={g} />)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-5 space-y-3">
          <SectionHead title={`${child.name}'s goals`}>
            <Button onClick={() => setGoalsStart({ view: 'form' })}>
              <PercyIcon id="phosphor:plus-circle:duotone" className="h-5 w-5" />
              New goal
            </Button>
          </SectionHead>
          {goals.length > 0 && (
            <ul className="divide-y divide-border">
              {goals.map((goal) => (
                <li key={goal.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground break-words">{goal.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {[goal.category_name || 'Behaviour unavailable', goalRecurrenceV1(goal, today), pointsText(goal.category_points ?? 1)].join(' · ')}
                    </p>
                  </div>
                  <Button variant="outline" aria-label={'Edit ' + goal.title} onClick={() => setGoalsStart({ goal })}>Edit</Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <Button variant="link" size="goal" className="-mr-3" onClick={() => setGoalsStart({ view: 'list' })} aria-label={'Manage all goals for ' + child.name}>
              Manage all goals
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-5 space-y-3">
          <SectionHead title="Achievements" />
          <div className="grid gap-3 xs:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <p className="font-semibold text-foreground">Goals completed</p>
              <p className="text-sm text-muted-foreground">Recognise effort over time</p>
              <p className="font-display font-bold text-lg text-foreground tabular-nums">{doneToday} today</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="font-semibold text-foreground">Next milestone</p>
              <p className="text-sm text-muted-foreground">Weekly target and bigger goal</p>
              <p className="font-display font-bold text-lg text-foreground tabular-nums">{toTarget} weekly points to go</p>
              {topGoal && <p className="text-sm text-muted-foreground tabular-nums">{topGoal.name}: {topGoal.to_go > 0 ? `${topGoal.to_go} to go` : 'Saved!'}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edits the weekly target (and the profile). No delete here: deleting a
          child stays in Settings (plan §8.7). */}
      {editingChild && <EditChildModal
        isOpen
        onClose={() => setEditingChild(false)}
        child={child}
        onSubmit={async (data) => {
          await Child.update(child.id, data);
          queryClient.invalidateQueries({ queryKey: ['children'] });
          toast.success(`${data.name}'s profile updated.`);
        }}
      />}
      <SavingsDialog open={savingsOpen} onClose={() => setSavingsOpen(false)} child={child} goalRewards={goalRewards} returnFocusRef={savingsEdit} />
      <ManageGoalsDialog open={!!goalsStart} onClose={() => setGoalsStart(null)} start={goalsStart}
        child={child} children={children} categories={behaviorCategories} today={today} />
      <RewardForm
        isOpen={!!rewardEditing}
        onClose={() => setRewardEditing(null)}
        reward={rewardEditing ? (rewards.find((r) => r.id === rewardEditing.id) || rewardEditing) : null}
        children={children}
        onSubmit={(data) => save(rewardEditing?.id, data)}
        onDelete={async (reward, confirm) => { const r = await remove(reward, confirm); if (r === true) setRewardEditing(null); return r; }}
      />
    </>
  );
}
