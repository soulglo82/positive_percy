// V1 "Manage {Name}'s goals" and the goal form (approved design 9de1df2,
// screens "goalsmanage" and "goalform"; docs/engineering/V1-F-DESIGN.md G).
// The E05 rules are unchanged: a running routine never sends start_date, a
// completed one-off keeps its date, and the server's R1/B2 409s show inline.
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import PercyIcon from "@/components/icons/PercyIcon";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
import { FamilyStrip } from '@/components/home/HomeSections';
import { childOrder } from '@/lib/childColour';
import { StepHeading, behavioursFor } from '@/components/home/AwardPointsDialog';
import {
  archiveTodayGoal, GOAL_DAYS, loadTodaysGoals, saveTodayGoal,
  editStartDate, goalDateLine, goalRecurrenceV1, goalShortDate, pointsText,
} from '@/lib/todaysGoals';

const choiceClass = (on) => cn(
  'inline-flex items-center justify-center gap-2 min-h-11 rounded-md px-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  on ? 'border-2 border-selected-border bg-selected' : 'border border-border bg-card hover:bg-accent');

// `start` (V1-B, Children page): open on the list (default), on a new goal
// ({ view: 'form' }) or on one goal's form ({ goal }). Back from the form
// always returns to the list, as it does from Home.
export default function ManageGoalsDialog({ open, onClose, child: initialChild, children = [], categories = [], today, start: opening = null }) {
  const queryClient = useQueryClient();
  const [childId, setChildId] = useState(initialChild?.id);
  const [view, setView] = useState('list'); // 'list' | 'form'
  // Review of PR #58: swapping views unmounts the focused button, so focus
  // moves to the new view's title (announced, then Tab continues from there).
  const titleRef = useRef(null);
  const shownView = useRef(null);
  useEffect(() => {
    if (!open) { shownView.current = null; return; }
    if (shownView.current !== null && shownView.current !== view) titleRef.current?.focus();
    shownView.current = view;
  }, [open, view]);
  const [editingId, setEditingId] = useState(null);
  // E05: the goal as stored when editing began; the start-date rule compares
  // against it (docs/engineering/E05-DESIGN.md section 9).
  const [editingGoal, setEditingGoal] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [schedule, setSchedule] = useState('weekly');
  const [scheduledDate, setScheduledDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);

  const strip = children.length ? [...children].sort(childOrder) : (initialChild ? [initialChild] : []);
  const child = strip.find((c) => c.id === childId) || initialChild;
  const available = behavioursFor(categories, child?.id);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['todaysGoals', 'manage'],
    queryFn: () => loadTodaysGoals(true),
    enabled: open && !!child,
    refetchOnWindowFocus: true,
  });
  const localToday = today || data?.date || '';

  const clearForm = (behaviours = available) => {
    setEditingId(null);
    setEditingGoal(null);
    setSaveError('');
    setTitle('');
    setSchedule('weekly');
    setScheduledDate(localToday);
    setStartDate(localToday);
    setWeekdays([1, 2, 3, 4, 5]);
    setCategoryId(behaviours[0]?.id || '');
  };

  // Each opening starts where it was asked to, for the child it was opened for.
  useEffect(() => {
    if (!open) return;
    setChildId(initialChild?.id);
    // The behaviours are those of the child being opened for, not of the
    // child the dialog showed last time (state updates after this render).
    // (code review of #61: both the edit and the add path need this).
    const behaviours = behavioursFor(categories, initialChild?.id);
    if (opening?.goal) startEditing(opening.goal, behaviours);
    else if (opening?.view === 'form') startAdding(behaviours);
    else setView('list');
  }, [open, initialChild?.id, opening]);

  const backToList = () => { clearForm(); setView('list'); };

  const startAdding = (behaviours = available) => { clearForm(behaviours); setView('form'); };

  const startEditing = (goal, behaviours = available) => {
    setEditingId(goal.id);
    setEditingGoal(goal);
    setSaveError('');
    setTitle(goal.title);
    // A behaviour since removed or reassigned cannot be kept: the parent
    // chooses again (review finding 3); saving waits for that choice.
    setCategoryId(behaviours.some((c) => c.id === goal.category_id) ? goal.category_id : '');
    setSchedule(goal.schedule_kind);
    setScheduledDate(goal.scheduled_date || localToday);
    const days = goal.weekdays?.length ? goal.weekdays : [1, 2, 3, 4, 5];
    setWeekdays(days);
    // E05 Q6: keep the stored start; the old clamp to today is gone.
    setStartDate(editStartDate(goal.schedule_kind === 'weekly' ? goal : null, days, localToday).value);
    setView('form');
  };

  // The start-date state for the current form (mirrors the server rule).
  const start = editStartDate(editingGoal, weekdays, localToday);

  const toggleDay = (day) => setWeekdays(previous => {
    const next = previous.includes(day) ? previous.filter(value => value !== day) : [...previous, day].sort();
    if (editingGoal) setStartDate(editStartDate(editingGoal, next, localToday).value);
    return next;
  });

  const save = async (event) => {
    event.preventDefault();
    if (!child || saving || !title.trim() || !categoryId || (schedule === 'weekly' && !weekdays.length)) return;
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        title: title.trim(), child_id: child.id, category_id: categoryId,
        schedule_kind: schedule,
        ...(schedule === 'one_off' ? { scheduled_date: scheduledDate }
          // A running routine's start is never sent: the server keeps it.
          : { weekdays, ...(start.editable ? { start_date: startDate || localToday } : {}) }),
      };
      await saveTodayGoal(payload, editingId);
      await queryClient.invalidateQueries({ queryKey: ['todaysGoals'] });
      toast.success(editingId ? 'Goal updated.' : 'Goal added.');
      backToList();
    } catch (err) {
      // Shown once, inline, so the form stays open (design N4, E04 R1/B2).
      setSaveError(err.message || 'Could not save the goal.');
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
      toast.success('Goal archived. Earned points stay in history.');
      setArchiveTarget(null);
      backToList();
    } catch (err) {
      toast.error(err.message || 'Could not archive the goal.');
    } finally {
      setArchiving(false);
    }
  };

  const goals = (data?.goals || []).filter(goal => goal.child_id === child?.id);
  const name = child?.name || 'your child';
  const canSave = !saving && !!categoryId && !!title.trim() && !(schedule === 'weekly' && weekdays.length === 0);

  return (
    <>
      <Dialog open={open} onOpenChange={value => { if (!value && !saving) onClose(); }}>
        <DialogContent className="sm:max-w-lg">
          {view === 'list' ? (
            <>
              <DialogHeader>
                <DialogTitle ref={titleRef} tabIndex={-1} className="text-title font-extrabold text-primary focus-visible:outline-none">Manage {name}'s goals</DialogTitle>
                <DialogDescription>Create routines, update schedules or archive goals safely.</DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-4">
                {strip.length > 1 && <FamilyStrip children={strip} selectedId={child?.id} onSelect={setChildId} />}
                <section className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display font-bold text-lg text-primary">Current goals</h3>
                      {!isLoading && !isError && goals.length > 0 && (
                        <p className="text-sm text-muted-foreground">{goals.length} {goals.length === 1 ? 'goal' : 'goals'} for {name}</p>
                      )}
                    </div>
                    <Button type="button" onClick={() => startAdding()}>
                      <PercyIcon id="phosphor:plus-circle:duotone" className="h-5 w-5" /> Add goal
                    </Button>
                  </div>
                  {isLoading && <p className="text-sm text-muted-foreground">Loading goals…</p>}
                  {isError && (
                    <div className="space-y-2">
                      <p className="text-sm text-destructive">Could not load goals.</p>
                      <Button type="button" variant="outline" onClick={() => refetch()}>Try again</Button>
                    </div>
                  )}
                  {!isLoading && !isError && goals.length === 0 &&
                    <p className="text-sm text-muted-foreground">No goals yet for {name}.</p>}
                  {goals.length > 0 && (
                    <ul className="divide-y divide-border border-t border-border">
                      {goals.map(goal => (
                        <li key={goal.id} className="flex items-center gap-3 py-3">
                          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center text-primary">
                            <CategoryIcon iconKey={goal.category_icon_key} className="w-6 h-6" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground break-words">{goal.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {[goal.category_name || 'Behaviour unavailable', goalRecurrenceV1(goal, localToday),
                                goal.category_points ? pointsText(goal.category_points) : null].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <Button type="button" variant="outline" size="goal" className="shrink-0 px-5 text-primary"
                            aria-label={'Edit ' + goal.title} onClick={() => startEditing(goal)}>
                            Edit
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="border-t border-border pt-3 text-sm text-muted-foreground">
                    Existing completions and earned points remain safe when a goal is edited or archived.
                  </p>
                </section>
              </DialogBody>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle ref={titleRef} tabIndex={-1} className="text-title font-extrabold text-primary focus-visible:outline-none">{editingId ? 'Edit goal' : 'New goal'}</DialogTitle>
                <DialogDescription>For {name} · earned points are awarded when you mark a goal complete</DialogDescription>
              </DialogHeader>
              <DialogBody>
                <form id="goal-form" onSubmit={save} className="space-y-5">
                  <section className="space-y-3">
                    <StepHeading n={1} title="Goal details" hint="Give the goal a name your child understands." />
                    <div className="space-y-2">
                      <Label htmlFor="goal-title">Goal name</Label>
                      <Input id="goal-title" value={title} maxLength={100} required
                        placeholder="e.g. Read for 15 minutes"
                        onChange={event => setTitle(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="goal-category">Positive behaviour</Label>
                      <select id="goal-category" value={categoryId}
                        onChange={event => setCategoryId(event.target.value)}
                        className="w-full min-h-11 rounded-md border border-input bg-card px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {available.length === 0 && <option value="">No behaviours available</option>}
                        {available.length > 0 && !categoryId && <option value="" disabled>Behaviour unavailable</option>}
                        {available.map(category => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>
                      <p className="text-sm text-muted-foreground">
                        {available.length === 0 ? 'Add a behaviour in Family settings first.' : 'Point value comes from the selected behaviour.'}
                      </p>
                    </div>
                  </section>
                  <section className="space-y-3 border-t border-border pt-5">
                    <StepHeading n={2} title="When should it happen?" hint="Choose a routine or a one-off achievement." />
                    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Schedule">
                      <button type="button" className={choiceClass(schedule === 'weekly')}
                        aria-pressed={schedule === 'weekly'} onClick={() => setSchedule('weekly')}>
                        <PercyIcon id="phosphor:repeat:duotone" className="h-5 w-5 text-primary" /> Repeat weekly
                      </button>
                      <button type="button" className={choiceClass(schedule === 'one_off')}
                        aria-pressed={schedule === 'one_off'} onClick={() => setSchedule('one_off')}>
                        <PercyIcon id="phosphor:target:duotone" className="h-5 w-5 text-primary" /> One-off
                      </button>
                    </div>
                    {schedule === 'one_off' ? (
                      <div className="space-y-2">
                        <Label htmlFor="goal-date">Date</Label>
                        <Input id="goal-date" type="date" value={scheduledDate} required
                          // A past one-off keeps its own date when renamed.
                          min={editingGoal?.schedule_kind === 'one_off' && scheduledDate === editingGoal.scheduled_date ? undefined : (localToday || undefined)}
                          onChange={event => setScheduledDate(event.target.value)} />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-4 xs:grid-cols-7 gap-2" role="group" aria-label="Repeat on">
                          {GOAL_DAYS.map(day => (
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
                              onChange={event => setStartDate(event.target.value)} />
                            {start.hint === 'newSchedule' && (
                              <p className="text-sm text-muted-foreground">The new schedule starts on {goalDateLine(startDate || localToday)}.</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Started {goalShortDate(start.value)}</p>
                        )}
                      </div>
                    )}
                  </section>
                  {saveError && <p className="text-sm text-destructive" role="alert">{saveError}</p>}
                  {editingGoal && (
                    <div className="border-t border-border pt-4">
                      <Button type="button" variant="outline" onClick={() => setArchiveTarget(editingGoal)} disabled={saving}>
                        <PercyIcon id="phosphor:archive:duotone" className="h-4 w-4" /> Archive goal
                      </Button>
                    </div>
                  )}
                </form>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" className="flex-1" onClick={backToList} disabled={saving}>Cancel</Button>
                <Button type="submit" form="goal-form" className="flex-1" disabled={!canSave}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create goal'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archiveTarget} onOpenChange={value => { if (!value && !archiving) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this goal?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.title} will no longer appear in daily goals. Previously earned points and history will stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={archiving} onClick={event => {
              // Keep the confirmation open on network failures.
              event.preventDefault();
              archive();
            }}>
              {archiving ? 'Archiving…' : 'Archive goal'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
