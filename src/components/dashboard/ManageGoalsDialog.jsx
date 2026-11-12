import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Pencil, Plus, Repeat2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { archiveTodayGoal, GOAL_DAYS, goalSchedule, loadTodaysGoals, saveTodayGoal } from '@/lib/todaysGoals';

function allowedCategories(categories, childId) {
  return categories.filter(category =>
    !category.assigned_children?.length || category.assigned_children.includes(childId));
}

export default function ManageGoalsDialog({ open, onClose, child, categories = [], today }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [schedule, setSchedule] = useState('weekly');
  const [scheduledDate, setScheduledDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);

  const available = allowedCategories(categories, child?.id);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['todaysGoals', 'manage'],
    queryFn: () => loadTodaysGoals(true),
    enabled: open && !!child,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (open && !editingId && !categoryId && available.length) setCategoryId(available[0].id);
  }, [open, editingId, categoryId, categories, child?.id]);

  const reset = () => {
    setEditingId(null);
    setTitle('');
    setSchedule('weekly');
    setScheduledDate(today || data?.date || '');
    setStartDate(today || data?.date || '');
    setWeekdays([1, 2, 3, 4, 5]);
    setCategoryId(available[0]?.id || '');
  };

  useEffect(() => {
    if (open) {
      setEditingId(null);
      setTitle('');
      setSchedule('weekly');
      setScheduledDate(today || '');
      setStartDate(today || '');
      setWeekdays([1, 2, 3, 4, 5]);
      setCategoryId(available[0]?.id || '');
    }
  // Only reset when the dialog/child changes, not during a form edit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, child?.id, today]);

  const startEditing = (goal) => {
    setEditingId(goal.id);
    setTitle(goal.title);
    setCategoryId(goal.category_id || '');
    setSchedule(goal.schedule_kind);
    setScheduledDate(goal.scheduled_date || today || data?.date || '');
    // Editing a running routine cannot backdate its new start.
    const localDate = today || data?.date || '';
    setStartDate(goal.start_date && goal.start_date >= localDate ? goal.start_date : localDate);
    setWeekdays(goal.weekdays?.length ? goal.weekdays : [1, 2, 3, 4, 5]);
  };

  const toggleDay = (day) => setWeekdays(previous =>
    previous.includes(day) ? previous.filter(value => value !== day) : [...previous, day].sort());

  const save = async (event) => {
    event.preventDefault();
    if (!child || saving || !title.trim() || !categoryId || (schedule === 'weekly' && !weekdays.length)) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(), child_id: child.id, category_id: categoryId,
        schedule_kind: schedule,
        ...(schedule === 'one_off' ? { scheduled_date: scheduledDate }
          : { weekdays, start_date: startDate || today || data?.date }),
      };
      await saveTodayGoal(payload, editingId);
      await queryClient.invalidateQueries({ queryKey: ['todaysGoals'] });
      toast.success(editingId ? 'Goal updated.' : 'Goal added.');
      reset();
    } catch (err) {
      toast.error(err.message || 'Could not save the goal.');
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
      if (editingId === archiveTarget.id) reset();
      toast.success('Goal archived. Earned points stay in history.');
      setArchiveTarget(null);
    } catch (err) {
      toast.error(err.message || 'Could not archive the goal.');
    } finally {
      setArchiving(false);
    }
  };

  const goals = (data?.goals || []).filter(goal => goal.child_id === child?.id);

  return (
    <>
      <Dialog open={open} onOpenChange={value => { if (!value && !saving) onClose(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage goals for {child?.name || 'your child'}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Create a one-off task or a weekly routine. Completing it earns the behaviour's points.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-6">
            <form id="goal-form" onSubmit={save} className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Plus className="w-[18px] h-[18px]" aria-hidden="true" />
                {editingId ? 'Edit goal' : 'New goal'}
              </h3>
              <div className="space-y-2">
                <Label htmlFor="goal-title">Goal</Label>
                <Input id="goal-title" value={title} maxLength={100} required
                  placeholder="e.g. Read for 15 minutes"
                  onChange={event => setTitle(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-category">Behaviour and points</Label>
                <select id="goal-category" value={categoryId}
                  onChange={event => setCategoryId(event.target.value)}
                  className="w-full min-h-11 rounded-md border border-input bg-card px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {available.length === 0 && <option value="">No behaviours available</option>}
                  {available.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name} (+{category.points ?? 1})
                    </option>
                  ))}
                </select>
                {available.length === 0 &&
                  <p className="text-sm text-muted-foreground">Add a behaviour in Family settings first.</p>}
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">Schedule</legend>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={schedule === 'weekly' ? 'default' : 'outline'}
                    aria-pressed={schedule === 'weekly'} onClick={() => setSchedule('weekly')}>
                    <Repeat2 className="h-4 w-4" aria-hidden="true" /> Weekly
                  </Button>
                  <Button type="button" variant={schedule === 'one_off' ? 'default' : 'outline'}
                    aria-pressed={schedule === 'one_off'} onClick={() => setSchedule('one_off')}>
                    One-off
                  </Button>
                </div>
              </fieldset>
              {schedule === 'one_off' ? (
                <div className="space-y-2">
                  <Label htmlFor="goal-date">Date</Label>
                  <Input id="goal-date" type="date" value={scheduledDate} min={today || data?.date || undefined} required
                    onChange={event => setScheduledDate(event.target.value)} />
                </div>
              ) : (
                <div className="space-y-3">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-foreground">Repeat on</legend>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {GOAL_DAYS.map(day => (
                      <Button key={day.number} type="button" size="sm"
                        className="px-2 min-w-11"
                        aria-pressed={weekdays.includes(day.number)}
                        variant={weekdays.includes(day.number) ? 'default' : 'outline'}
                        onClick={() => toggleDay(day.number)}>{day.label}</Button>
                    ))}
                  </div>
                  {weekdays.length === 0 && <p className="text-sm text-destructive">Choose at least one day.</p>}
                </fieldset>
                <div className="space-y-2">
                  <Label htmlFor="goal-start-date">Starts on</Label>
                  <Input id="goal-start-date" type="date" min={today || data?.date || undefined}
                    value={startDate || today || data?.date || ''} required
                    onChange={event => setStartDate(event.target.value)} />
                </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving || !categoryId || !title.trim() || (schedule === 'weekly' && weekdays.length === 0)}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add goal'}
                </Button>
                {editingId && <Button type="button" variant="outline" onClick={reset}>Cancel edit</Button>}
              </div>
            </form>

            <div className="border-t border-border pt-4 space-y-3">
              <h3 className="font-semibold text-foreground">Existing goals</h3>
              {isLoading && <p className="text-sm text-muted-foreground">Loading goals…</p>}
              {isError && (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">Could not load goals.</p>
                  <Button type="button" variant="outline" onClick={() => refetch()}>Try again</Button>
                </div>
              )}
              {!isLoading && !isError && goals.length === 0 &&
                <p className="text-sm text-muted-foreground">No goals yet for {child?.name}.</p>}
              {goals.map(goal => (
                <div key={goal.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground break-words">{goal.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {goalSchedule(goal)} · {goal.category_name || 'Behaviour unavailable'}
                      {goal.completion_id ? ' · Completed today' : ''}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="icon"
                    aria-label={'Edit ' + goal.title} onClick={() => startEditing(goal)}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="outline" size="icon"
                    aria-label={'Archive ' + goal.title} onClick={() => setArchiveTarget(goal)}>
                    <Archive className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" className="w-full" onClick={onClose} disabled={saving}>Done</Button>
          </DialogFooter>
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
