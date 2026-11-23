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
import { childOrder } from '@/lib/childColour';
import { loadTodaysGoals, goalRecurrenceV1, pointsText } from '@/lib/todaysGoals';
import { useRewardMutations } from '@/hooks/useRewardMutations';
import PercyIcon from '@/components/icons/PercyIcon';
import RewardIcon from '@/components/rewards/RewardIcon';
import { ChildSelector, PercyAvatar, PercyFox, ProgressRing, JourneyStop, SkyArt, Flag } from '../components/percy/parts';
import WelcomeCard from '../components/home/WelcomeCard';
import AddChildModal from '../components/child/AddChildModal';
import EditChildModal from '../components/child/EditChildModal';
import ManageGoalsDialog from '../components/dashboard/ManageGoalsDialog';
import RewardForm from '../components/rewards/RewardForm';
import SavingsDialog from '../components/savings/SavingsDialog';
import { leadingGoal, goalRewardsFor, goalOrder } from '@/lib/savings';
import { buildChildCreatePayload } from '@/lib/childPayload';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorCard from '../components/ErrorCard';

const pct = (n, d) => (d > 0 ? Math.max(0, Math.min(100, Math.round((n / d) * 100))) : 0);
const pointsWord = (n) => (n === 1 ? 'point' : 'points');

// Rewards this child can see (assignment). Hidden ones are shown, tagged, for
// the parent; Child View leaves them out. Bigger goals are listed under
// "Saving for something bigger" instead (D1).
export const rewardsForChild = (rewards, childId) => rewards.filter((r) => isAssignedTo(r, childId) && !r.is_bigger_goal);

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
  // Today's ring needs what is scheduled today; the manage list holds every
  // goal (server/todaysGoals.js), so it would be the wrong denominator.
  const { data: todayData } = useQuery({
    queryKey: ['todaysGoals'],
    queryFn: () => loadTodaysGoals(),
    enabled: !!user && children.length > 0,
    refetchOnWindowFocus: true,
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

  const page = (body, v11 = false) => (
    <div className="min-h-screen bg-background">
      {v11 ? body : <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">{body}</div>}
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
  const scheduledToday = (todayData?.goals || []).filter((g) => g.child_id === child.id);
  const doneScheduled = scheduledToday.filter((g) => !!g.completion_id).length;
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

  const reached = target > 0 && week >= target;
  // Approved V1 wording (E3: reaching the target reads 0); no target is the
  // ring's neutral state.
  const weekNote = target > 0 ? `${toTarget} to reach this week's target` : 'No weekly target set yet';
  const [lead, ...otherGoals] = goalRows;

  // V1.1 Children (design/v11; owner review 23 Nov): the child, then the ways
  // to manage them, then progress. No Quick Points and no completing goals
  // here: that is Home.
  return page(
    <div className="pv">
      <h1 className="pv-sr">Children</h1>
      <section className="pv-scene pv-scene--journey" aria-labelledby="child-title">
        <SkyArt />
        <div className="pv-scene__sky"><ChildSelector children={ordered} selectedId={child.id} onSelect={setChildId} emphasise={false} /></div>
        <div className="pv-profile">
          <PercyAvatar child={child} children={ordered} size="profile" ring />
          <div>
            <h2 id="child-title" className="pv-t-page">{child.name}</h2>
            <p className="pv-t-body"><span data-available>{available}</span> {pointsWord(available)} available now</p>
          </div>
          <div className="pv-profile__actions">
            <Link to={createPageUrl('ChildView') + '?child=' + encodeURIComponent(child.id)} className="pv-btn pv-btn--secondary">View as child</Link>
          </div>
          {/* Owner review (23 Nov): management within reach, before the journey. */}
          {/* Each card is one button (its label stretched over the card) so the
              spoken name contains the visible label (WCAG 2.5.3); the line
              under it is a description, not part of the name. */}
          <ul className="pv-manage" aria-label={`Manage ${child.name}`}>
            <li className="pv-manage-action">
              <span className="pv-medallion" aria-hidden="true"><PercyIcon id="phosphor:target:duotone" /></span>
              <span className="pv-manage-action__text">
                <button type="button" className="pv-manage-action__label pv-stretch" aria-label={`Edit ${child.name}'s weekly target`} aria-describedby="manage-target" onClick={() => setEditingChild(true)}>Weekly target</button>
                <span id="manage-target" className="pv-t-support">{target > 0 ? `${target} points a week` : 'Not set'}</span>
              </span>
            </li>
            <li className="pv-manage-action">
              <span className="pv-medallion" aria-hidden="true"><PercyIcon id="phosphor:calendar-dots:duotone" /></span>
              <span className="pv-manage-action__text">
                <button type="button" className="pv-manage-action__label pv-stretch" aria-label={'Manage all goals for ' + child.name} aria-describedby="manage-goals" onClick={() => setGoalsStart({ view: 'list' })}>All goals</button>
                <span id="manage-goals" className="pv-t-support">{goals.length} {goals.length === 1 ? 'goal' : 'goals'}</span>
              </span>
            </li>
            <li className="pv-manage-action">
              <span className="pv-medallion" aria-hidden="true"><PercyIcon id="phosphor:piggy-bank:duotone" /></span>
              <span className="pv-manage-action__text">
                {goalRewards.length > 0 ? (
                  <button ref={savingsEdit} type="button" className="pv-manage-action__label pv-stretch" aria-label={`Edit saving for something bigger for ${child.name}`} aria-describedby="manage-savings" onClick={() => setSavingsOpen(true)}>Saving for something bigger</button>
                ) : (
                  <Link to={createPageUrl('Rewards')} className="pv-manage-action__label pv-stretch" aria-describedby="manage-savings">Saving for something bigger</Link>
                )}
                <span id="manage-savings" className="pv-t-support">{goalRewards.length === 0 ? 'Mark a reward as a bigger goal' : topGoal ? `${topGoal.saved} points saved` : 'Nothing saved yet'}</span>
              </span>
            </li>
            <li className="pv-manage-action">
              <span className="pv-medallion" aria-hidden="true"><PercyIcon id="phosphor:gift:duotone" /></span>
              <span className="pv-manage-action__text">
                <Link to={createPageUrl('Rewards')} className="pv-manage-action__label pv-stretch" aria-describedby="manage-rewards">Rewards</Link>
                <span id="manage-rewards" className="pv-t-support">Treats and bigger goals</span>
              </span>
            </li>
          </ul>
        </div>
      </section>

      <div className="pv-columns">
        <div className="pv-col">
          <section className="pv-meadow" aria-labelledby="journey-title">
            <div className="pv-journey-head">
              <div>
                <h2 id="journey-title" className="pv-t-section">{child.name}'s journey</h2>
                <p className="pv-t-support">Today, this week, and the bigger goal.</p>
              </div>
              <PercyFox pose="walking" size="mid" />
            </div>
            <ol className="pv-journey">
              <JourneyStop label="Today's goals" value={doneScheduled} max={scheduledToday.length} unit="done"
                note={scheduledToday.length ? (doneScheduled === scheduledToday.length ? 'All done today' : `${scheduledToday.length - doneScheduled} to go`) : 'No goals scheduled today'}
                tone={scheduledToday.length > 0 && doneScheduled === scheduledToday.length ? 'earn' : ''}
                ring={<ProgressRing metric="today" value={doneScheduled} max={scheduledToday.length}
                  icon={<PercyIcon id="phosphor:list-checks:duotone" />} doneIcon={<PercyIcon id="phosphor:check-circle:duotone" />} />} />
              <JourneyStop label="This week" value={week} max={target} unit="points" note={weekNote} tone={reached ? 'earn' : ''}
                ring={<ProgressRing metric="week" value={week} max={target}
                  icon={<PercyIcon id="phosphor:target:duotone" />} doneIcon={<PercyIcon id="phosphor:check-circle:duotone" />}
                  progress={{ label: 'Weekly target', valueText: `${toTarget} weekly points to go` }} />} />
            </ol>
            <section className="pv-section" aria-labelledby="bigger-title">
              <h3 id="bigger-title" className="pv-t-card">Saving for something bigger</h3>
              {goalRewards.length === 0 ? (
                <div className="pv-card">
                  <p className="pv-t-body">No bigger goals yet.</p>
                  <Link to={createPageUrl('Rewards')} className="pv-link">Mark a reward as a bigger goal</Link>
                </div>
              ) : (
                <>
                  <article className="pv-destination" data-goal={lead.rewardId} aria-label={lead.name}>
                    <div className="pv-destination__scene">
                      <div className="pv-destination__title"><p className="pv-t-meta">Bigger goal</p><p className="pv-t-card">{lead.name}</p></div>
                      <Flag />
                    </div>
                    <div className="pv-destination__body">
                      <div className="pv-stop">
                        <ProgressRing metric="goal" value={lead.saved} max={lead.cost} icon={<RewardIcon reward={lead} size="sm" />}
                          doneIcon={<PercyIcon id="phosphor:check-circle:duotone" />} />
                        <div>
                          <p className="pv-t-card">{lead.saved} of {lead.cost} points saved</p>
                          <p className="pv-stop__note" data-tone={lead.to_go > 0 ? undefined : 'earn'}>{lead.to_go > 0 ? `${lead.to_go} to go` : 'Saved!'}</p>
                        </div>
                      </div>
                    </div>
                  </article>
                  {otherGoals.length > 0 && (
                    <ul className="pv-goal-list">
                      {otherGoals.map((g) => (
                        <li key={g.rewardId} className="pv-card" data-goal={g.rewardId}>
                          <div className="pv-towards-row">
                            <RewardIcon reward={g} size="md" />
                            <div className="pv-towards-text">
                              <p className="pv-t-card">{g.name}</p>
                              <p className="pv-t-support">{g.saved} of {g.cost} points saved</p>
                              <p className="pv-t-action">{g.to_go > 0 ? `${g.to_go} to go` : 'Saved!'}</p>
                            </div>
                          </div>
                          <div className="pv-bar" aria-hidden="true"><i style={{ width: pct(g.saved, g.cost) + '%' }} /></div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>
          </section>
        </div>

        <div className="pv-col">
          <section className="pv-section" aria-labelledby="goals-title">
            <div className="pv-section__head">
              <h2 id="goals-title" className="pv-t-section">{child.name}'s goals</h2>
              <button type="button" className="pv-btn pv-btn--primary" onClick={() => setGoalsStart({ view: 'form' })}>
                <PercyIcon id="phosphor:plus-circle:duotone" />New goal
              </button>
            </div>
            {goals.length > 0 ? (
              <ul className="pv-goals">
                {goals.map((goal) => (
                  <li key={goal.id} className="pv-goal">
                    <div className="pv-goal__text">
                      <p className="pv-goal__title">{goal.title}</p>
                      <p className="pv-goal__meta">
                        {[goal.category_name || 'Behaviour unavailable', goalRecurrenceV1(goal, today), pointsText(goal.category_points ?? 1)].join(' · ')}
                      </p>
                    </div>
                    <button type="button" className="pv-btn pv-btn--secondary" aria-label={'Edit ' + goal.title} onClick={() => setGoalsStart({ goal })}>
                      <PercyIcon id="phosphor:pencil:duotone" />Edit
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pv-t-support">No goals yet.</p>
            )}
          </section>

          <section className="pv-section" aria-labelledby="treats-title">
            <div className="pv-section__head">
              <h2 id="treats-title" className="pv-t-section">Weekly treats to choose from</h2>
              <Link to={createPageUrl('Rewards')} className="pv-link">All rewards</Link>
            </div>
            {rewardsLoading ? (
              <LoadingSpinner message="Loading rewards..." />
            ) : rewardsError ? (
              <ErrorCard message="Couldn't load rewards" onRetry={refetchRewards} />
            ) : treats.length === 0 ? (
              <p className="pv-t-support">No rewards created yet.</p>
            ) : (
              <ul className="pv-treats">
                {treats.map((reward) => {
                  const shown = reward.visible_to_child !== false;
                  return (
                    // The V1 catalogue tile's content (RewardTile), at V1.1 sizes.
                    <li key={reward.id} className="pv-treat">
                      <RewardIcon reward={reward} size="md" />
                      <div className="pv-towards-text">
                        <p className="pv-t-card">{reward.title}</p>
                        <p className="pv-t-support">{reward.cost_points} {pointsWord(reward.cost_points)}</p>
                        <p className="pv-treat__tag" data-shown={shown ? '' : undefined}>{shown ? 'Visible to children' : 'Hidden from children'}</p>
                      </div>
                      <button type="button" className="pv-btn pv-btn--secondary" aria-label={`Edit ${reward.title}`} onClick={() => setRewardEditing(reward)}>
                        <PercyIcon id="phosphor:pencil:duotone" />Edit
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="pv-section" aria-labelledby="ach-title">
            <h2 id="ach-title" className="pv-t-section">Achievements</h2>
            <ul className="pv-achievements" data-achievements>
              <li className="pv-achievement" data-state={doneToday > 0 ? 'earned' : 'next'}>
                <span className="pv-medallion" aria-hidden="true"><PercyIcon id="phosphor:check-circle:duotone" /></span>
                <div>
                  <p className="pv-t-card">Goals completed</p>
                  <p className="pv-t-support">Recognise effort over time</p>
                  <p className="pv-t-action">{doneToday} today</p>
                </div>
              </li>
              <li className="pv-achievement" data-state={reached ? 'earned' : 'next'}>
                <span className="pv-medallion" aria-hidden="true"><PercyIcon id="phosphor:trophy:duotone" /></span>
                <div>
                  <p className="pv-t-card">Next milestone</p>
                  <p className="pv-t-support">Weekly target and bigger goal</p>
                  {topGoal && <p className="pv-t-action">{topGoal.name}: {topGoal.to_go > 0 ? `${topGoal.to_go} to go` : 'Saved!'}</p>}
                </div>
              </li>
            </ul>
          </section>
        </div>
      </div>

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
    </div>,
    true,
  );
}
