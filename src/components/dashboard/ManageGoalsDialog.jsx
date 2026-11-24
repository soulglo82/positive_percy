// "Daily Wins & Big Goals" (owner's option C, 24 November 2026;
// docs/engineering/V1-F-DESIGN.md §12). One pop-up with four views: the list
// (a Daily Wins side and a Big Goals side), the Daily Win form, the Big Goal
// form and the savings view. The last two are RewardForm and SavingsDialog
// rendered `embedded`, so no dialog is ever stacked on another (W8).
// The E05 rules are unchanged: a running routine never sends start_date, a
// completed one-off keeps its date, and the server's R1/B2 409s show inline.
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';

import PercyIcon from "@/components/icons/PercyIcon";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Reward } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import CategoryIcon from '@/components/CategoryIcon';
import RewardIcon from '@/components/rewards/RewardIcon';
import RewardForm from '@/components/rewards/RewardForm';
import SavingsDialog from '@/components/savings/SavingsDialog';
import { FamilyStrip } from '@/components/home/HomeSections';
import { childOrder } from '@/lib/childColour';
import { isAssignedTo } from '@/lib/assignment';
import { goalRewardsFor, goalOrder } from '@/lib/savings';
import { behavioursFor } from '@/components/home/AwardPointsDialog';
import { useRewardMutations, BIG_GOAL_WORDS } from '@/hooks/useRewardMutations';
import {
  archiveTodayGoal, GOAL_DAYS, loadTodaysGoals, saveTodayGoal,
  editStartDate, goalDateLine, goalRecurrenceV1, goalShortDate, pointsText,
} from '@/lib/todaysGoals';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const choiceClass = (on) => cn(
  'inline-flex items-center justify-center gap-2 min-h-11 rounded-md px-3 text-sm font-semibold text-foreground', FOCUS,
  on ? 'border-2 border-selected-border bg-selected' : 'border border-border bg-card hover:bg-accent');
const TITLE = 'text-lg text-primary focus-visible:outline-none';
const WEEKDAYS = [1, 2, 3, 4, 5];
const pct = (n, d) => (d > 0 ? Math.max(0, Math.min(100, Math.round((n / d) * 100))) : 0);

// The Daily Win form's fields for a new one (goal null) or for one being
// edited. A behaviour since removed or reassigned cannot be kept: the parent
// chooses again (review finding 3); saving waits for that choice.
export function dailyWinFields(goal, behaviours, localToday) {
  if (!goal) {
    return { editingGoal: null, title: '', categoryId: behaviours[0]?.id || '', schedule: 'weekly',
      scheduledDate: localToday, startDate: localToday, weekdays: WEEKDAYS };
  }
  const days = goal.weekdays?.length ? goal.weekdays : WEEKDAYS;
  return {
    editingGoal: goal, title: goal.title,
    categoryId: behaviours.some((c) => c.id === goal.category_id) ? goal.category_id : '',
    schedule: goal.schedule_kind, scheduledDate: goal.scheduled_date || localToday,
    // E05 Q6: keep the stored start; the old clamp to today is gone.
    startDate: editStartDate(goal.schedule_kind === 'weekly' ? goal : null, days, localToday).value,
    weekdays: days,
  };
}

// The child's Big Goals: every reward marked as one and assigned to the
// child, at the server's figures when the child has savings in it
// (child.goals holds only those), else nothing saved (§12 W5).
export function bigGoalsFor(rewards, child) {
  if (!child) return [];
  const saved = new Map((child.goals || []).map((g) => [g.rewardId, g]));
  const asked = new Set((child.reward_stack_priced || []).map((i) => i.rewardId));
  return goalRewardsFor(rewards, child.id, isAssignedTo).map((r) => {
    const g = saved.get(r.id);
    return {
      reward: r, rewardId: r.id, name: g?.name ?? r.title, cost: g?.cost ?? r.cost_points,
      saved: g?.saved ?? 0, to_go: g?.to_go ?? r.cost_points,
      asked: asked.has(r.id), hidden: r.visible_to_child === false,
    };
  }).sort(goalOrder);
}

// `start` (Children page): open on the list (default), on the Big Goals side
// ({ side: 'bigGoals' }), on a new Daily Win ({ view: 'form' }) or on one
// Daily Win's form ({ goal }). Cancel in a form always returns to the list.
// `returnFocusRef`: the button that opened the pop-up; focus goes back to it.
export default function ManageGoalsDialog({ open, onClose, returnFocusRef = null, ...rest }) {
  const busy = useRef(false);
  const focusBack = (event) => {
    if (returnFocusRef?.current) { event.preventDefault(); returnFocusRef.current.focus(); }
  };
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value && !busy.current) onClose(); }}>
      <DialogContent className="sm:max-w-lg" onCloseAutoFocus={focusBack}>
        {/* Mounted only while the pop-up is open, so each opening starts
            where it was asked to and never shows the last one for a frame. */}
        <Popup {...rest} onClose={onClose} busy={busy} />
      </DialogContent>
    </Dialog>
  );
}

function Popup({ onClose, busy, child: initialChild, children = [], categories = [], today, start: opening = null }) {
  const queryClient = useQueryClient();
  const [childId, setChildId] = useState(initialChild?.id);
  const [side, setSide] = useState(opening?.side === 'bigGoals' ? 'goals' : 'wins'); // 'wins' | 'goals'
  const [view, setView] = useState(opening?.goal || opening?.view === 'form' ? 'form' : 'list'); // 'list' | 'form' | 'bigGoal' | 'savings'
  const [fields, setFields] = useState(() => dailyWinFields(opening?.goal || null, behavioursFor(categories, initialChild?.id), today || ''));
  const [bigGoal, setBigGoal] = useState(null); // the reward being edited, or null for a new one
  const [savingsFor, setSavingsFor] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  busy.current = saving || archiving;

  // Review of PR #58: swapping views unmounts the focused button, so focus
  // moves to the new view's title (announced, then Tab continues from there).
  const titleRef = useRef(null);
  const shownView = useRef(view);
  useEffect(() => {
    if (shownView.current !== view) titleRef.current?.focus();
    shownView.current = view;
  }, [view]);

  const strip = children.length ? [...children].sort(childOrder) : (initialChild ? [initialChild] : []);
  const child = strip.find((c) => c.id === childId) || initialChild;
  const available = behavioursFor(categories, child?.id);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['todaysGoals', 'manage'],
    queryFn: () => loadTodaysGoals(true),
    enabled: !!child,
    refetchOnWindowFocus: true,
  });
  // Loaded for as long as the pop-up is open, whichever view shows (N13).
  const rewardsQuery = useQuery({ queryKey: ['rewards'], queryFn: () => Reward.list('-created_date') });
  const rewards = rewardsQuery.data || [];
  const { save: saveReward, remove: removeReward } = useRewardMutations();
  const localToday = today || data?.date || '';

  const { editingGoal, title, categoryId, schedule, scheduledDate, startDate, weekdays } = fields;
  const set = (patch) => setFields((previous) => ({ ...previous, ...patch }));
  const backToList = () => { setSaveError(''); setView('list'); };
  const startAdding = () => { setSaveError(''); setFields(dailyWinFields(null, available, localToday)); setView('form'); };
  const startEditing = (goal) => { setSaveError(''); setFields(dailyWinFields(goal, available, localToday)); setView('form'); };

  // The start-date state for the current form (mirrors the server rule).
  const start = editStartDate(editingGoal, weekdays, localToday);

  const toggleDay = (day) => setFields((previous) => {
    const next = previous.weekdays.includes(day) ? previous.weekdays.filter((value) => value !== day) : [...previous.weekdays, day].sort();
    return { ...previous, weekdays: next,
      ...(previous.editingGoal ? { startDate: editStartDate(previous.editingGoal, next, localToday).value } : {}) };
  });

  const canSave = !saving && !!categoryId && !!title.trim() && !(schedule === 'weekly' && weekdays.length === 0);

  const save = async (event) => {
    event.preventDefault();
    if (!child || !canSave) return;
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        title: title.trim(), child_id: child.id, category_id: categoryId,
        schedule_kind: schedule,
        ...(schedule === 'one_off' ? { scheduled_date: scheduledDate || localToday }
          // A running routine's start is never sent: the server keeps it.
          : { weekdays, ...(start.editable ? { start_date: startDate || localToday } : {}) }),
      };
      await saveTodayGoal(payload, editingGoal?.id);
      await queryClient.invalidateQueries({ queryKey: ['todaysGoals'] });
      toast.success(editingGoal ? 'Daily Win updated.' : 'Daily Win added.');
      backToList();
    } catch (err) {
      // Shown once, inline, so the form stays open (design N4, E04 R1/B2).
      setSaveError(err.message || 'Could not save the Daily Win.');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!archiveTarget || archiving) return;
    setArchiving(true);
    try {
      await archiveTodayGoal(archiveTarget.id);
      await queryClient.invalidateQueries({ queryKey: ['todaysGoals'] });
      toast.success('Daily Win archived. Earned points stay in history.');
      setArchiveTarget(null);
      backToList();
    } catch (err) {
      toast.error(err.message || 'Could not archive the Daily Win.');
    } finally {
      setArchiving(false);
    }
  };

  const wins = (data?.goals || []).filter((goal) => goal.child_id === child?.id);
  const bigGoals = bigGoalsFor(rewards, child);
  const name = child?.name || 'your child';
  const chosenBehaviour = available.find((c) => c.id === categoryId);

  const openBigGoal = (reward) => { setBigGoal(reward); setSide('goals'); setView('bigGoal'); };
  const openSavings = (rewardId) => { setSavingsFor(rewardId); setSide('goals'); setView('savings'); };

  return (
    <>
      {view === 'list' && (
        <>
          <DialogHeader className="pb-2 pt-4">
            <DialogTitle ref={titleRef} tabIndex={-1} className={TITLE}>Daily Wins &amp; Big Goals</DialogTitle>
            <DialogDescription className="sr-only">Add or change {name}'s Daily Wins and Big Goals.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {strip.length > 1 && <FamilyStrip compact children={strip} selectedId={child?.id} onSelect={setChildId} />}
            <div role="group" aria-label="Show" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {[['wins', 'Daily Wins'], ['goals', 'Big Goals']].map(([key, label]) => (
                <button key={key} type="button" aria-pressed={side === key} onClick={() => setSide(key)}
                  className={cn('min-h-11 rounded-md px-2 text-sm font-semibold', FOCUS,
                    side === key ? 'bg-card text-primary shadow' : 'text-muted-foreground hover:text-foreground')}>
                  {label}
                </button>
              ))}
            </div>
            {side === 'wins' ? (
              <section aria-label={name + "'s Daily Wins"} data-side="wins">
                {isLoading && <p className="text-sm text-muted-foreground">Loading Daily Wins…</p>}
                {isError && !data && (
                  <div className="space-y-2">
                    <p className="text-sm text-destructive">Could not load Daily Wins.</p>
                    <Button type="button" variant="outline" onClick={() => refetch()}>Try again</Button>
                  </div>
                )}
                {!isLoading && !!data && wins.length === 0 &&
                  <p className="text-sm text-muted-foreground">No Daily Wins yet for {name}.</p>}
                {wins.length > 0 && (
                  <ul className="divide-y divide-border border-y border-border">
                    {wins.map((goal) => {
                      const meta = [goal.category_name || 'Behaviour unavailable', goalRecurrenceV1(goal, localToday),
                        goal.category_points ? pointsText(goal.category_points) : null].filter(Boolean).join(' · ');
                      return (
                      <li key={goal.id}>
                        <button type="button" onClick={() => startEditing(goal)}
                          className={cn('flex w-full min-h-11 items-center gap-3 rounded-md py-2 text-left hover:bg-accent', FOCUS)}>
                          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center text-primary">
                            <CategoryIcon iconKey={goal.category_icon_key} className="w-6 h-6" />
                          </span>
                          <span className="min-w-0 flex-1">
                            {/* Named by its own text, "Edit {title} {meta}": the spaces are real
                                text nodes, so every browser and checker reads the same name. */}
                            <span className="sr-only">Edit</span>{' '}
                            <span className="block text-sm font-semibold text-foreground break-words">{goal.title}</span>{' '}
                            <span className="block text-sm text-muted-foreground">{meta}</span>
                          </span>
                          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ) : (
              <section aria-label={name + "'s Big Goals"} data-side="goals">
                {rewardsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading Big Goals…</p>}
                {rewardsQuery.isError && !rewardsQuery.data && (
                  <div className="space-y-2">
                    <p className="text-sm text-destructive">Could not load Big Goals.</p>
                    <Button type="button" variant="outline" onClick={() => rewardsQuery.refetch()}>Try again</Button>
                  </div>
                )}
                {!!rewardsQuery.data && bigGoals.length === 0 &&
                  <p className="text-sm text-muted-foreground">No Big Goals yet for {name}.</p>}
                {bigGoals.length > 0 && (
                  <ul className="space-y-2">
                    {bigGoals.map((g) => {
                      const ready = g.saved >= g.cost;
                      return (
                        <li key={g.rewardId} className="space-y-2 rounded-lg border border-border p-3" data-big-goal={g.rewardId}>
                          {/* Two sibling controls, never one inside the other (§12 W5). */}
                          <button type="button" onClick={() => openBigGoal(g.reward)}
                            className={cn('flex w-full min-h-11 items-center gap-3 rounded-md text-left hover:bg-accent', FOCUS)}>
                            <RewardIcon reward={g.reward} size="md" />
                            <span className="min-w-0 flex-1">
                              <span className="sr-only">Edit</span>{' '}
                              <span className="block font-semibold text-foreground break-words">{g.name}</span>{' '}
                              <span className="block text-sm text-muted-foreground tabular-nums">{g.saved} of {g.cost} points saved</span>
                              {g.hidden && <>{' '}<span className="block text-xs text-muted-foreground">Hidden from children</span></>}
                            </span>
                            <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                          <div className="h-2 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                            <div className="h-full rounded-full bg-sunrise" style={{ width: pct(g.saved, g.cost) + '%' }} />
                          </div>
                          {g.asked ? (
                            <p className="text-sm text-muted-foreground">Asked for</p>
                          ) : (
                            <Button type="button" variant="outline" className="w-full"
                              aria-label={(ready ? 'Redeem ' : 'Save points for ') + g.name}
                              onClick={() => openSavings(g.rewardId)}>
                              {ready ? 'Redeem' : 'Save points'}
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </DialogBody>
          <DialogFooter>
            {side === 'wins' ? (
              <Button type="button" className="flex-1" onClick={startAdding}>
                <PercyIcon id="phosphor:plus-circle:duotone" className="h-5 w-5" /> Add Daily Win
              </Button>
            ) : (
              <Button type="button" className="flex-1" onClick={() => openBigGoal(null)}>
                <PercyIcon id="phosphor:plus-circle:duotone" className="h-5 w-5" /> Add Big Goal
              </Button>
            )}
          </DialogFooter>
        </>
      )}

      {view === 'form' && (
        <>
          <DialogHeader className="pb-2 pt-4">
            <DialogTitle ref={titleRef} tabIndex={-1} className={TITLE}>{editingGoal ? 'Edit Daily Win' : 'New Daily Win'}</DialogTitle>
            <DialogDescription>For {name}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form id="goal-form" onSubmit={save} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="goal-title">What is it?</Label>
                <Input id="goal-title" value={title} maxLength={100} required
                  placeholder="e.g. Read for 15 minutes"
                  onChange={(event) => set({ title: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-category">Points for</Label>
                <div className="relative">
                  {chosenBehaviour && (
                    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-primary">
                      <CategoryIcon iconKey={chosenBehaviour.icon_key} className="h-5 w-5" />
                    </span>
                  )}
                  <select id="goal-category" value={categoryId}
                    onChange={(event) => set({ categoryId: event.target.value })}
                    className={cn('w-full min-h-11 rounded-md border border-input bg-card pr-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      chosenBehaviour ? 'pl-10' : 'pl-3')}>
                    {available.length === 0 && <option value="">No behaviours available</option>}
                    {available.length > 0 && !categoryId && <option value="" disabled>Behaviour unavailable</option>}
                    {available.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name} · {category.points} {category.points === 1 ? 'point' : 'points'}
                      </option>
                    ))}
                  </select>
                </div>
                {available.length === 0 && <p className="text-sm text-muted-foreground">Add a behaviour in Family settings first.</p>}
              </div>
              <div className="space-y-2">
                <p id="goal-when" className="text-sm font-medium text-foreground">When</p>
                <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="goal-when">
                  <button type="button" className={choiceClass(schedule === 'weekly')}
                    aria-pressed={schedule === 'weekly'} onClick={() => set({ schedule: 'weekly' })}>Every week</button>
                  <button type="button" className={choiceClass(schedule === 'one_off')}
                    aria-pressed={schedule === 'one_off'} onClick={() => set({ schedule: 'one_off' })}>One day</button>
                </div>
                {schedule === 'one_off' ? (
                  <div className="space-y-2">
                    <Label htmlFor="goal-date">Date</Label>
                    <Input id="goal-date" type="date" value={scheduledDate || localToday} required
                      // A past one-off keeps its own date when renamed.
                      min={editingGoal?.schedule_kind === 'one_off' && scheduledDate === editingGoal.scheduled_date ? undefined : (localToday || undefined)}
                      onChange={(event) => set({ scheduledDate: event.target.value })} />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 xs:grid-cols-7 gap-2" role="group" aria-label="Repeat on">
                      {GOAL_DAYS.map((day) => (
                        <button key={day.number} type="button"
                          className={cn(choiceClass(weekdays.includes(day.number)), 'min-w-11 px-1')}
                          aria-pressed={weekdays.includes(day.number)}
                          onClick={() => toggleDay(day.number)}>{day.label}</button>
                      ))}
                    </div>
                    {weekdays.length === 0 && <p className="text-sm text-destructive">Choose at least one day.</p>}
                    {start.editable ? (
                      <div className="space-y-2">
                        <Label htmlFor="goal-start-date">Starts on</Label>
                        <Input id="goal-start-date" type="date" min={localToday || undefined}
                          value={startDate || localToday} required
                          onChange={(event) => set({ startDate: event.target.value })} />
                        {start.hint === 'newSchedule' && (
                          <p className="text-sm text-muted-foreground">The new schedule starts on {goalDateLine(startDate || localToday)}.</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Started {goalShortDate(start.value)}</p>
                    )}
                  </div>
                )}
              </div>
              {saveError && <p className="text-sm text-destructive" role="alert">{saveError}</p>}
              {editingGoal && (
                <div className="border-t border-border pt-4">
                  <Button type="button" variant="outline" onClick={() => setArchiveTarget(editingGoal)} disabled={saving}>
                    <PercyIcon id="phosphor:archive:duotone" className="h-4 w-4" /> Archive Daily Win
                  </Button>
                </div>
              )}
            </form>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" className="flex-1" onClick={backToList} disabled={saving}>Cancel</Button>
            <Button type="submit" form="goal-form" className="flex-1" disabled={!canSave}>
              {saving ? 'Saving…' : 'Save Daily Win'}
            </Button>
          </DialogFooter>
        </>
      )}

      {view === 'bigGoal' && (
        <RewardForm key={bigGoal?.id || 'new'} embedded isOpen variant="bigGoal" forChild={child} titleRef={titleRef}
          // The live copy, so the form's savings warnings use current figures.
          reward={bigGoal ? (rewards.find((r) => r.id === bigGoal.id) || bigGoal) : null}
          children={children}
          onClose={backToList}
          onSubmit={(payload) => saveReward(bigGoal?.id, payload, BIG_GOAL_WORDS)}
          onDelete={bigGoal ? async (reward, confirm) => {
            const result = await removeReward(reward, confirm, BIG_GOAL_WORDS);
            if (result === true) backToList();
            return result;
          } : undefined} />
      )}

      {view === 'savings' && (
        <SavingsDialog key={savingsFor} embedded open child={child} titleRef={titleRef}
          goalRewards={goalRewardsFor(rewards, child?.id, isAssignedTo)} initialGoalId={savingsFor}
          // After a move or a redeem the whole pop-up closes: the toast's
          // Undo cannot be used while a dialog is open (§12 W8, X14).
          onClose={(result) => { if (result?.acted) onClose(); else backToList(); }} />
      )}

      <AlertDialog open={!!archiveTarget} onOpenChange={(value) => { if (!value && !archiving) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this Daily Win?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.title} will no longer appear in Daily Wins. Previously earned points and history will stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={archiving} onClick={(event) => {
              // Keep the confirmation open on network failures.
              event.preventDefault();
              archive();
            }}>
              {archiving ? 'Archiving…' : 'Archive Daily Win'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
