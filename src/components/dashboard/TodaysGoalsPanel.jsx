import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PercyIcon from "@/components/icons/PercyIcon";
import CategoryIcon from '@/components/CategoryIcon';
import { toast } from 'sonner';
import { getToken } from '@/lib/AuthContext';
import { completeTodayGoal, loadTodaysGoals, goalDateShortLine, goalRecurrenceV1, pointsText } from '@/lib/todaysGoals';
import { refreshPoints, undoAction, UNDO_TOAST_MS } from '@/lib/points';
import ManageGoalsDialog from './ManageGoalsDialog';

// E05 (docs/engineering/E05-DESIGN.md): the selected child is named; each goal
// keeps its category icon when done, with a separate Done mark (register
// completed_goal); weekly goals show their real days (recurring_indicator);
// Complete is a 44px button with the approved check-circle. Dates come from
// the server. V1.1 (design/v11) restyles the markup only.
// V1: the Home family strip chooses the child (selectedChildId); without one,
// or for a child no longer in the list, the panel shows the first child.
export default function TodaysGoalsPanel({ children = [], categories = [], enabled = false, selectedChildId }) {
  const queryClient = useQueryClient();
  const [manageOpen, setManageOpen] = useState(false);
  // Focus returns here when the pop-up closes (V1-F §12 W8, X32).
  const manageButton = useRef(null);
  const [pendingIds, setPendingIds] = useState([]);
  const inFlight = useRef(new Set());
  // After a completion, focus moves to that row's Done label (design N4).
  const doneRefs = useRef({});
  const [focusGoalId, setFocusGoalId] = useState(null);

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
        // "+1 point", "+2 points" (final validation: 1 is the default for every behaviour).
        toast.success('Well done! ' + pointsText(result.event.points) + ' for ' + child.name + '.', {
          duration: UNDO_TOAST_MS,
          action: { label: 'Undo', onClick: undoAction('award', result.event.id, queryClient) },
        });
      } else {
        toast.info('That Daily Win is already recorded.');
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
        toast.info(err.message || 'This Daily Win has already been completed.');
      } else {
        toast.error(err.message || 'Could not complete the Daily Win. Please try again.');
      }
    } finally {
      inFlight.current.delete(goal.id);
      setPendingIds([...inFlight.current]);
    }
  };

  // V1.1 (design/v11): one section, rows on white that turn green when done.
  // Wording, focus and every action are V1's (E05).
  return (
    <section aria-labelledby="todays-goals-title" className="pv-section">
      <div className="pv-section__head">
        <div>
          {/* E03: approved header accent (goals_interactions.header_accent); decorative. */}
          <h2 id="todays-goals-title" className="pv-t-section pv-heading-icon"><PercyIcon id="phosphor:sparkle:duotone" />Daily Wins</h2>
          <p className="pv-t-support">
            <span className="break-words">{child.name}'s checklist</span>
            {data?.date && <> · <span>{goalDateShortLine(data.date)}</span></>}
          </p>
        </div>
        {data && goals.length > 0 && (
          <p className="pv-t-meta">
            <span className="pv-dots" aria-hidden="true">{goals.map((g) => <i key={g.id} data-on={g.completion_id ? '' : undefined} />)}</span>{' '}
            {done} of {goals.length} done
          </p>
        )}
      </div>

      {isError ? (
        <div className="pv-empty">
          <p className="pv-t-body">Could not load Daily Wins.</p>
          <button type="button" className="pv-btn pv-btn--secondary" onClick={() => refetch()}>Try again</button>
        </div>
      ) : isLoading ? (
        <p className="pv-t-support" role="status">Loading Daily Wins…</p>
      ) : goals.length === 0 ? (
        <div className="pv-empty">
          <p className="pv-t-card">No Daily Wins for {child.name} today.</p>
          <p className="pv-t-support">Something to do today or every week.</p>
        </div>
      ) : (
        <ul className="pv-goals">
          {goals.map(goal => {
            const completed = !!goal.completion_id;
            const pending = pendingIds.includes(goal.id);
            const points = goal.category_points;
            return (
              <li key={goal.id} className="pv-goal" data-done={completed ? '' : undefined}>
                {/* The category icon stays the same when the goal is done (register completed_goal). */}
                <span aria-hidden="true" className="pv-medallion">
                  <CategoryIcon iconKey={goal.category_icon_key} className="w-6 h-6" />
                </span>
                <div className="pv-goal__text">
                  <p className="pv-goal__title">{goal.title}</p>
                  <p className="pv-goal__meta">
                    {[goal.category_name || 'Behaviour unavailable', goalRecurrenceV1(goal, data?.date),
                      points ? pointsText(points) : null].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {completed ? (
                  <span ref={el => { doneRefs.current[goal.id] = el; }} tabIndex={-1} className="pv-btn pv-goal__donechip">
                    <PercyIcon id="phosphor:check-circle:duotone" className="w-5 h-5" /> Done
                  </span>
                ) : (
                  <button type="button" className="pv-btn pv-btn--secondary"
                    disabled={pending || !points}
                    aria-label={'Complete ' + goal.title}
                    onClick={() => complete(goal)}>
                    <PercyIcon id="phosphor:check-circle:duotone" className="w-5 h-5" />
                    {pending ? 'Saving…' : 'Complete'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div>
        {/* One door for both kinds (owner's option C, V1-F §12 W2); focus comes
            back here when the pop-up closes (W8). The label may wrap. */}
        <button type="button" ref={manageButton} className="pv-btn pv-btn--soft pv-btn--block pv-manage-door" onClick={() => setManageOpen(true)}>
          <PercyIcon id="phosphor:target:duotone" /><span>Manage Daily Wins &amp; Big Goals</span>
        </button>
      </div>
      <ManageGoalsDialog open={manageOpen} onClose={() => setManageOpen(false)} returnFocusRef={manageButton}
        child={child} children={children} categories={categories} today={data?.date || ''} />
    </section>
  );
}
