import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, ClipboardCheck, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { getToken } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { completeTodayGoal, loadTodaysGoals } from '@/lib/todaysGoals';
import { refreshPoints, undoAction, UNDO_TOAST_MS } from '@/lib/points';
import ManageGoalsDialog from './ManageGoalsDialog';

export default function TodaysGoalsPanel({ children = [], categories = [], enabled = false }) {
  const queryClient = useQueryClient();
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || null);
  const [manageOpen, setManageOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState([]);
  const inFlight = useRef(new Set());

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

  if (!children.length) return null;

  const child = children.find(item => item.id === selectedChildId) || children[0];
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
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="todays-goals-title" className="flex items-center gap-2 font-display font-semibold text-lg text-foreground">
                <ClipboardCheck className="h-5 w-5 text-primary" strokeWidth={1.5} aria-hidden="true" />
                Today's goals
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isLoading ? 'Loading daily goals…' : data ? done + ' of ' + goals.length + ' complete for ' + child.name : 'Build a positive daily routine.'}
              </p>
            </div>
            <Button variant="outline" onClick={() => setManageOpen(true)}
              aria-label={'Manage goals for ' + child.name}>
              <Settings2 className="h-4 w-4" aria-hidden="true" /> Manage goals
            </Button>
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a child">
            {children.map(item => (
              <Button key={item.id} type="button" size="sm"
                variant={item.id === child.id ? 'default' : 'outline'}
                aria-pressed={item.id === child.id}
                onClick={() => setSelectedChildId(item.id)}
                className="max-w-full break-words whitespace-normal text-left">
                {item.name}
              </Button>
            ))}
          </div>

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
            <ul className="space-y-2">
              {goals.map(goal => {
                const completed = !!goal.completion_id;
                const pending = pendingIds.includes(goal.id);
                return (
                  <li key={goal.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3">
                    <span aria-hidden="true" className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-full ' +
                      (completed ? 'bg-earn-soft text-earn' : 'bg-muted text-muted-foreground')}>
                      {completed ? <CheckCircle2 className="w-5 h-5" /> : <ClipboardCheck className="w-5 h-5" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground break-words">{goal.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {goal.category_name || 'Behaviour unavailable'}
                        {goal.category_points ? ' · +' + goal.category_points + ' points' : ''}
                      </p>
                    </div>
                    {completed ? (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-earn" role="status">
                        <Check className="w-4 h-4" aria-hidden="true" /> Done
                      </span>
                    ) : (
                      <Button size="sm" disabled={pending || !goal.category_points}
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
        </CardContent>
      </Card>
      <ManageGoalsDialog open={manageOpen} onClose={() => setManageOpen(false)}
        child={child} categories={categories} today={data?.date || ''} />
    </section>
  );
}
