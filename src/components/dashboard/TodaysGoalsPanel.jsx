import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PercyIcon from "@/components/icons/PercyIcon";
import CategoryIcon from '@/components/CategoryIcon';
import ChildAvatar from '@/components/child/ChildAvatar';
import { toast } from 'sonner';
import { getToken } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { childColour } from '@/lib/childColour';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { completeTodayGoal, loadTodaysGoals, goalDateShortLine, goalRecurrenceV1, pointsText } from '@/lib/todaysGoals';
import { refreshPoints, undoAction, UNDO_TOAST_MS } from '@/lib/points';
import ManageGoalsDialog from './ManageGoalsDialog';

// E05 (docs/engineering/E05-DESIGN.md): the selected child is named, coloured
// and pictured; each goal keeps its category icon when done, with a separate
// Done mark (register completed_goal); weekly goals show their real days
// (recurring_indicator); the completion control is the approved check-circle
// at 24px in a 44px target (control_size_weight). Dates come from the server.
// V1: selection can be controlled by the Home family strip (selectedChildId);
// without it the panel keeps its own selection (first child).
export default function TodaysGoalsPanel({ children = [], categories = [], enabled = false, selectedChildId: controlledId }) {
  const queryClient = useQueryClient();
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || null);
  const [manageOpen, setManageOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState([]);
  const inFlight = useRef(new Set());
  // One polite announcement, set only when a parent picks a child (design N4).
  const [announce, setAnnounce] = useState('');
  // After a completion, focus moves to that row's Done label (design N4).
  const doneRefs = useRef({});
  const [focusGoalId, setFocusGoalId] = useState(null);

  useEffect(() => {
    if (!children.length) { setSelectedChildId(null); return; }
    if (!children.some(child => child.id === selectedChildId)) setSelectedChildId(children[0].id);
  }, [children, selectedChildId]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['todaysGoals'],
    queryFn: () => loadTodaysGoals(),
    enabled: enabled && children.length > 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (focusGoalId && doneRefs.current[focusGoalId]) {
      doneRefs.current[focusGoalId].focus();
      setFocusGoalId(null);
    }
  });

  if (!children.length) return null;

  const child = children.find(item => item.id === (controlledId || selectedChildId)) || children[0];
  const goals = (data?.goals || []).filter(goal => goal.child_id === child.id);
  const done = goals.filter(goal => !!goal.completion_id).length;

  const complete = async (goal) => {
    if (inFlight.current.has(goal.id) || goal.completion_id) return;
    inFlight.current.add(goal.id);
    setPendingIds([...inFlight.current]);
    try {
      const result = await completeTodayGoal(goal.id);
      if (!result.duplicate) {
        toast.success('Well done! +' + result.event.points + ' points for ' + child.name + '.', {
          duration: UNDO_TOAST_MS,
          action: { label: 'Undo', onClick: undoAction('award', result.event.id, queryClient) },
        });
      } else {
        toast.info('That goal is already recorded.');
      }
      refreshPoints(queryClient);
      setFocusGoalId(goal.id);
      // Badge checks should not delay completion; the server still owns every badge award.
      fetch('/api/children/' + child.id + '/check-badges', {
        method: 'POST', headers: { Authorization: 'Bearer ' + getToken() },
      }).then(() => refreshPoints(queryClient)).catch(() => {});
    } catch (err) {
      if (err.status === 409) {
        refreshPoints(queryClient);
        toast.info(err.message || 'This goal has already been completed.');
      } else {
        toast.error(err.message || 'Could not complete the goal. Please try again.');
      }
    } finally {
      inFlight.current.delete(goal.id);
      setPendingIds([...inFlight.current]);
    }
  };

  return (
    <section aria-labelledby="todays-goals-title">
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="todays-goals-title" className="flex items-center gap-2 font-display font-bold text-lg text-primary">
              {/* E03: approved header accent (goals_interactions.header_accent); decorative, no motion. */}
              <PercyIcon id="phosphor:sparkle:duotone" className="h-5 w-5" />
              Today's Goals
            </h2>
            {data && goals.length > 0 && (
              <span className="rounded-full bg-warning px-3 py-1 text-sm font-semibold text-foreground tabular-nums">
                {done} of {goals.length} done
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border pb-3 text-sm text-muted-foreground">
            <span className="break-words">{child.name}'s checklist</span>
            {data?.date && <span>{goalDateShortLine(data.date)}</span>}
          </div>

          {!controlledId && children.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a child">
              {children.map(item => {
                const selected = item.id === child.id;
                const c = childColour(item, children);
                return (
                  <button key={item.id} type="button" aria-pressed={selected}
                    onClick={() => { setSelectedChildId(item.id); setAnnounce('Showing goals for ' + item.name); }}
                    className={cn('inline-flex items-center gap-2 rounded-full min-h-11 pl-1 pr-3 text-sm max-w-full break-words text-left text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      selected ? cn('border-2 bg-selected font-semibold', c.border) : 'border border-border bg-card hover:bg-accent')}>
                    <ChildAvatar name={item.name} url={item.avatar_url} size="sm" colour={c} decorative className="ring-0 ring-offset-0" />
                    {item.name}
                  </button>
                );
              })}
            </div>
          )}
          <p className="sr-only" aria-live="polite">{announce}</p>

          {isError ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">Could not load today's goals.</p>
              <Button variant="outline" onClick={() => refetch()}>Try again</Button>
            </div>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground" role="status">Loading goals…</p>
          ) : goals.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted px-4 py-5">
              <p className="font-medium text-foreground">No goals scheduled for {child.name} today.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add a weekly routine or a one-off task to give them something to work towards.
              </p>
              <Button className="mt-3" size="sm" onClick={() => setManageOpen(true)}>
                Set up goals
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {goals.map(goal => {
                const completed = !!goal.completion_id;
                const pending = pendingIds.includes(goal.id);
                const points = goal.category_points;
                return (
                  <li key={goal.id} className="flex items-center gap-3 py-3">
                    {/* The category icon stays the same when the goal is done (register completed_goal). */}
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center text-primary">
                      <CategoryIcon iconKey={goal.category_icon_key} className="w-6 h-6" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground break-words">{goal.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {[goal.category_name || 'Behaviour unavailable', goalRecurrenceV1(goal, data?.date),
                          points ? pointsText(points) : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {completed ? (
                      <span ref={el => { doneRefs.current[goal.id] = el; }} tabIndex={-1}
                        className="inline-flex shrink-0 items-center gap-1.5 min-h-11 rounded-md border border-earn bg-earn-soft px-4 text-sm font-semibold text-earn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <PercyIcon id="phosphor:check-circle:duotone" className="w-4 h-4" /> Done
                      </span>
                    ) : (
                      <Button variant="outline" size="goal" className="shrink-0 px-4 text-primary"
                        disabled={pending || !points}
                        aria-label={'Complete ' + goal.title}
                        onClick={() => complete(goal)}>
                        {pending ? 'Saving…' : 'Complete'}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex justify-end">
            <Button variant="link" size="goal" onClick={() => setManageOpen(true)} aria-label={'Manage goals for ' + child.name}>
              <PercyIcon id="phosphor:target:duotone" className="h-4 w-4" /> Manage goals
            </Button>
          </div>
        </CardContent>
      </Card>
      <ManageGoalsDialog open={manageOpen} onClose={() => setManageOpen(false)}
        child={child} children={children} categories={categories} today={data?.date || ''} />
    </section>
  );
}
